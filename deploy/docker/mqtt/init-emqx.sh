#!/usr/bin/env bash
set -euo pipefail

mode="${1:?mode is required}"
secrets_dir=/run/secrets

write_config() {
  config_dir=/opt/infoq-mqtt-config
  certs_dir="${secrets_dir}/certs"
  [ -r "${certs_dir}/ca/ca.crt" ] || { echo "MQTT CA certificate is unavailable" >&2; exit 78; }
  [ -r "${certs_dir}/mqtt-broker/tls.crt" ] || { echo "MQTT TLS certificate is unavailable" >&2; exit 78; }
  [ -r "${certs_dir}/mqtt-broker/tls.key" ] || { echo "MQTT TLS private key is unavailable" >&2; exit 78; }
  mkdir -p "${config_dir}" /opt/infoq-mqtt-data
  chown -R 1000:1000 /opt/infoq-mqtt-data
  cat > "${config_dir}/base.hocon" <<'EOF'
listeners.tcp.default {
  enable = false
  bind = "0.0.0.0:1883"
}

listeners.ssl.default {
  enable = true
  bind = "0.0.0.0:8883"
  ssl_options {
    cacertfile = "/opt/emqx/etc/certs/ca/ca.crt"
    certfile = "/opt/emqx/etc/certs/mqtt-broker/tls.crt"
    keyfile = "/opt/emqx/etc/certs/mqtt-broker/tls.key"
    versions = ["tlsv1.2", "tlsv1.3"]
    verify = verify_none
    fail_if_no_peer_cert = false
  }
}

authentication = [
  {
    mechanism = password_based
    backend = built_in_database
    user_id_type = username
    password_hash_algorithm {
      name = sha256
      salt_position = suffix
    }
  }
]

authorization.no_match = deny
authorization.deny_action = disconnect
EOF
  chmod 0644 "${config_dir}/base.hocon"
}

login() {
  local response
  response="$(curl --fail --silent --show-error --retry 30 --retry-connrefused --retry-delay 1 \
    -H 'content-type: application/json' \
    -X POST \
    --data "{\"username\":\"${MQTT_ADMIN_USERNAME}\",\"password\":\"${MQTT_ADMIN_PASSWORD}\"}" \
    http://mqtt-broker:18083/api/v5/login)"
  token="$(printf '%s' "${response}" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')"
  [ -n "${token}" ] || { echo "EMQX dashboard login did not return a token" >&2; exit 78; }
}

api() {
  curl --fail --silent --show-error \
    -H "Authorization: Bearer ${token}" \
    -H 'content-type: application/json' \
    "$@"
}

escape_json_string() {
  awk 'BEGIN { ORS="" } { gsub(/\\/, "\\\\"); gsub(/"/, "\\\""); if (NR > 1) printf "\\n"; printf "%s", $0 } END { printf "\\n" }'
}

ensure_authenticator() {
  api http://mqtt-broker:18083/api/v5/authentication | grep -F '"id":"password_based:built_in_database"' >/dev/null \
    || { echo "EMQX built-in database authenticator is unavailable" >&2; exit 78; }
}
add_user() {
  local username="$1"
  local password_file="$2"
  local password status payload
  password="$(<"${secrets_dir}/${password_file}")"
  payload="{\"user_id\":\"${username}\",\"password\":\"${password}\"}"
  status="$(curl --silent --show-error -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer ${token}" -H 'content-type: application/json' \
    -X POST --data "${payload}" \
    http://mqtt-broker:18083/api/v5/authentication/password_based:built_in_database/users)"
  if [ "${status}" = 201 ]; then
    return
  fi
  if [ "${status}" = 409 ]; then
    api -X PUT --data "{\"password\":\"${password}\"}" \
      "http://mqtt-broker:18083/api/v5/authentication/password_based:built_in_database/users/${username}" >/dev/null
    return
  fi
  echo "EMQX user initialization failed with HTTP ${status}" >&2
  exit 78
}

write_acl() {
  local base="infoq/it/${MIDDLEWARE_RUN_ID}"
  local rules payload
  rules="$(cat <<EOF
{allow, {username, "${MQTT_V3_USERNAME}"}, subscribe, ["${base}/v3/in/#"]}.
{allow, {username, "${MQTT_V3_USERNAME}"}, publish, ["${base}/v3/out/#"]}.
{allow, {username, "${MQTT_V5_USERNAME}"}, subscribe, ["${base}/v5/in/#"]}.
{allow, {username, "${MQTT_V5_USERNAME}"}, publish, ["${base}/v5/out/#"]}.
{allow, {username, "${MQTT_PROBE_USERNAME}"}, all, ["${base}/#"]}.
{deny, {username, "${MQTT_DENIED_USERNAME}"}, all, ["${base}/#"]}.
{deny, all}.
EOF
)"
  payload="$(printf '%s' "${rules}" | escape_json_string)"
  printf '{"type":"file","enable":true,"rules":"%s"}' "${payload}" >/tmp/emqx-file-acl.json
  api -X PUT --data-binary @/tmp/emqx-file-acl.json http://mqtt-broker:18083/api/v5/authorization/sources/file >/dev/null
}

configure_security() {
  : "${MIDDLEWARE_RUN_ID:?MIDDLEWARE_RUN_ID is required}"
  : "${MQTT_ADMIN_USERNAME:?MQTT_ADMIN_USERNAME is required}"
  : "${MQTT_ADMIN_PASSWORD:?MQTT_ADMIN_PASSWORD is required}"
  : "${MQTT_V3_USERNAME:?MQTT_V3_USERNAME is required}"
  : "${MQTT_V5_USERNAME:?MQTT_V5_USERNAME is required}"
  : "${MQTT_PROBE_USERNAME:?MQTT_PROBE_USERNAME is required}"
  : "${MQTT_DENIED_USERNAME:?MQTT_DENIED_USERNAME is required}"
  login
  ensure_authenticator
  add_user "${MQTT_V3_USERNAME}" mqtt-v3.password
  add_user "${MQTT_V5_USERNAME}" mqtt-v5.password
  add_user "${MQTT_PROBE_USERNAME}" mqtt-probe.password
  add_user "${MQTT_DENIED_USERNAME}" mqtt-denied.password
  write_acl
  echo "EMQX community edition authentication and ACL initialization completed"
}

case "${mode}" in
  config) write_config ;;
  security) configure_security ;;
  *) echo "Unsupported EMQX initialization mode: ${mode}" >&2; exit 64 ;;
esac