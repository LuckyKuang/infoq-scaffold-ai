#!/usr/bin/env bash
set -euo pipefail

service_name="${1:?service name is required}"
case "${service_name}" in
  elasticsearch) ;;
  *) echo "Unsupported certificate service: ${service_name}" >&2; exit 64 ;;
esac

secrets_dir="/run/secrets"
certs_dir="${secrets_dir}/certs"
ca_dir="${certs_dir}/ca"
service_dir="${certs_dir}/${service_name}"
truststore="${secrets_dir}/truststore.p12"
lock_dir="${secrets_dir}/.certificate-init.lock"

if [[ -z "${MIDDLEWARE_TRUSTSTORE_PASSWORD:-}" ]]; then
  echo "MIDDLEWARE_TRUSTSTORE_PASSWORD is required" >&2
  exit 64
fi

umask 077
mkdir -p "${secrets_dir}" "${certs_dir}" "${ca_dir}" "${service_dir}"
chmod 0700 "${secrets_dir}"

for attempt in $(seq 1 60); do
  if mkdir "${lock_dir}" 2>/dev/null; then
    trap 'rmdir "${lock_dir}"' EXIT
    break
  fi
  [[ "${attempt}" == "60" ]] && { echo "Timed out waiting for certificate initialization lock" >&2; exit 75; }
  sleep 1
done

if [[ ! -s "${ca_dir}/ca.key" || ! -s "${ca_dir}/ca.crt" ]]; then
  rm -f "${ca_dir}/ca.key" "${ca_dir}/ca.crt"
  openssl req -x509 -newkey rsa:3072 -sha256 -nodes -days 2 \
    -subj "/CN=infoq-elasticsearch-it-ca" \
    -keyout "${ca_dir}/ca.key" -out "${ca_dir}/ca.crt"
fi

if [[ ! -s "${service_dir}/tls.key" || ! -s "${service_dir}/tls.crt" ]]; then
  extension_file="$(mktemp)"
  trap 'rm -f "${extension_file}"; rmdir "${lock_dir}"' EXIT
  cat > "${extension_file}" <<EOF
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:${service_name},DNS:localhost,IP:127.0.0.1
EOF
  openssl req -newkey rsa:3072 -nodes -subj "/CN=${service_name}" \
    -keyout "${service_dir}/tls.key" -out "${service_dir}/tls.csr"
  openssl x509 -req -sha256 -days 2 -in "${service_dir}/tls.csr" \
    -CA "${ca_dir}/ca.crt" -CAkey "${ca_dir}/ca.key" -CAcreateserial \
    -out "${service_dir}/tls.crt" -extfile "${extension_file}"
  rm -f "${service_dir}/tls.csr"
fi

if [[ ! -s "${truststore}" ]]; then
  keytool -importcert -noprompt -storetype PKCS12 -alias infoq-elasticsearch-it-ca \
    -file "${ca_dir}/ca.crt" -keystore "${truststore}" \
    -storepass "${MIDDLEWARE_TRUSTSTORE_PASSWORD}"
fi

chmod 0400 "${ca_dir}/ca.key" "${service_dir}/tls.key"
chmod 0444 "${ca_dir}/ca.crt" "${service_dir}/tls.crt"
chmod 0600 "${truststore}"
chown -R 1000:0 "${service_dir}"

openssl verify -CAfile "${ca_dir}/ca.crt" "${service_dir}/tls.crt" >/dev/null
keytool -list -storetype PKCS12 -keystore "${truststore}" \
  -storepass "${MIDDLEWARE_TRUSTSTORE_PASSWORD}" -alias infoq-elasticsearch-it-ca >/dev/null
printf 'service=%s\nsubject_alt_name=%s,localhost,127.0.0.1\n' "${service_name}" "${service_name}" > "${service_dir}/metadata.txt"
chmod 0600 "${service_dir}/metadata.txt"