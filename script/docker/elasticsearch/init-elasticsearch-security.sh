#!/usr/bin/env bash
set -euo pipefail

: "${MIDDLEWARE_RUN_ID:?MIDDLEWARE_RUN_ID is required}"
: "${ES_BOOTSTRAP_PASSWORD:?ES_BOOTSTRAP_PASSWORD is required}"
: "${ES_IT_USERNAME:?ES_IT_USERNAME is required}"
: "${ES_IT_PASSWORD:?ES_IT_PASSWORD is required}"

base="infoq_elasticsearch_it_${MIDDLEWARE_RUN_ID}_*"
role="infoq_it_${MIDDLEWARE_RUN_ID}"
ca=/run/certs/ca.crt
curl_args=(--silent --show-error --cacert "${ca}" -u "elastic:${ES_BOOTSTRAP_PASSWORD}")

put_security_resource() {
  local resource="$1"
  local payload="$2"
  local response=/tmp/security-response.json
  local status
  local curl_status
  set +e
  status="$(curl "${curl_args[@]}" -H 'Content-Type: application/json' -X PUT \
    "https://elasticsearch:9200/_security/${resource}" --data-binary "@${payload}" \
    --output "${response}" --write-out '%{http_code}')"
  curl_status=$?
  set -e
  if [ "${curl_status}" -ne 0 ] || [[ ! "${status}" =~ ^2 ]]; then
    [ -s "${response}" ] && cat "${response}" >&2
    return 22
  fi
  cat "${response}"
}

cat >/tmp/role.json <<EOF
{"cluster":["monitor"],"indices":[{"names":["${base}"],"privileges":["create_index","write","read","view_index_metadata","manage","delete_index"]}]}
EOF
put_security_resource "role/${role}" /tmp/role.json
cat >/tmp/user.json <<EOF
{"password":"${ES_IT_PASSWORD}","roles":["${role}"],"full_name":"InfoQ Elasticsearch integration verifier"}
EOF
put_security_resource "user/${ES_IT_USERNAME}" /tmp/user.json
rm -f /tmp/role.json /tmp/user.json /tmp/security-response.json
