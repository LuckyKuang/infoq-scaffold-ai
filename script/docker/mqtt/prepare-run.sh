#!/usr/bin/env bash
set -euo pipefail

: "${MIDDLEWARE_RUN_ID:?MIDDLEWARE_RUN_ID is required}"
: "${MIDDLEWARE_SECRET_DIR:?MIDDLEWARE_SECRET_DIR is required}"
: "${MIDDLEWARE_MAVEN_REPO:?MIDDLEWARE_MAVEN_REPO is required}"
: "${INFOQ_DEPLOY_ROOT:?INFOQ_DEPLOY_ROOT is required}"

secret() { openssl rand -hex 24; }

umask 077
mkdir -p /run/secrets
chmod 0700 /run/secrets
env_file=/run/secrets/compose.env
if [[ -e "${env_file}" ]]; then
  echo "Refusing to overwrite an existing MQTT run env file" >&2
  exit 73
fi

truststore_password="$(secret)"
mqtt_v3_password="$(secret)"
mqtt_v5_password="$(secret)"
mqtt_probe_password="$(secret)"
mqtt_denied_password="$(secret)"
mqtt_admin_password="$(secret)"
mqtt_node_cookie="$(secret)"
mqtt_runtime_root="${INFOQ_DEPLOY_ROOT}/mqtt-it/${MIDDLEWARE_RUN_ID}"

cat > "${env_file}" <<EOF
MIDDLEWARE_RUN_ID=${MIDDLEWARE_RUN_ID}
MIDDLEWARE_PROJECT_NAME=infoq-mqtt-it-${MIDDLEWARE_RUN_ID}
MIDDLEWARE_SECRET_DIR=${MIDDLEWARE_SECRET_DIR}
MIDDLEWARE_MAVEN_REPO=${MIDDLEWARE_MAVEN_REPO}
INFOQ_DEPLOY_ROOT=${INFOQ_DEPLOY_ROOT}
MIDDLEWARE_MQTT_CONFIG_DIR=${mqtt_runtime_root}/config
MIDDLEWARE_MQTT_DATA_DIR=${mqtt_runtime_root}/data
MIDDLEWARE_TRUSTSTORE_PASSWORD=${truststore_password}
MQTT_NODE_COOKIE=${mqtt_node_cookie}
MQTT_ADMIN_USERNAME=mqtt-it-admin
MQTT_ADMIN_PASSWORD=${mqtt_admin_password}
MQTT_V3_USERNAME=app-v3
MQTT_V3_PASSWORD=${mqtt_v3_password}
MQTT_V5_USERNAME=app-v5
MQTT_V5_PASSWORD=${mqtt_v5_password}
MQTT_PROBE_USERNAME=probe-allowed
MQTT_PROBE_PASSWORD=${mqtt_probe_password}
MQTT_DENIED_USERNAME=probe-denied
MQTT_DENIED_PASSWORD=${mqtt_denied_password}
MYSQL_ROOT_PASSWORD=$(secret)
REDIS_PASSWORD=$(secret)
MINIO_ROOT_USER=mqtt-it
MINIO_ROOT_PASSWORD=$(secret)
INFOQ_PUBLIC_BASE_URL=http://127.0.0.1
SECURITY_TOKEN_SECRET=$(secret)
INFOQ_DB_USERNAME=infoq
INFOQ_DB_PASSWORD=$(secret)
EOF
chmod 0600 "${env_file}"
printf '%s\n' "${mqtt_v3_password}" > /run/secrets/mqtt-v3.password
printf '%s\n' "${mqtt_v5_password}" > /run/secrets/mqtt-v5.password
printf '%s\n' "${mqtt_probe_password}" > /run/secrets/mqtt-probe.password
printf '%s\n' "${mqtt_denied_password}" > /run/secrets/mqtt-denied.password
printf '%s\n' "${mqtt_admin_password}" > /run/secrets/mqtt-admin.password
chmod 0600 /run/secrets/mqtt-*.password

export MIDDLEWARE_TRUSTSTORE_PASSWORD="${truststore_password}"
/opt/infoq-mqtt/generate-certificates.sh mqtt-broker

test "$(stat -c '%a' /run/secrets)" = 700
test "$(stat -c '%a' "${env_file}")" = 600
test "$(stat -c '%a' /run/secrets/truststore.p12)" = 600
printf 'run_id=%s\nsecret_directory_mode=%s\nenv_file_mode=%s\ntruststore_mode=%s\n' \
  "${MIDDLEWARE_RUN_ID}" "$(stat -c '%a' /run/secrets)" "$(stat -c '%a' "${env_file}")" \
  "$(stat -c '%a' /run/secrets/truststore.p12)"