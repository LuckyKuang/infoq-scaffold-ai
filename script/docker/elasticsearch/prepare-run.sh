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
  echo "Refusing to overwrite an existing Elasticsearch run env file" >&2
  exit 73
fi

truststore_password="$(secret)"
es_bootstrap_password="$(secret)"
es_it_password="$(secret)"

cat > "${env_file}" <<EOF
MIDDLEWARE_RUN_ID=${MIDDLEWARE_RUN_ID}
MIDDLEWARE_PROJECT_NAME=infoq-elasticsearch-it-${MIDDLEWARE_RUN_ID}
MIDDLEWARE_SECRET_DIR=${MIDDLEWARE_SECRET_DIR}
MIDDLEWARE_MAVEN_REPO=${MIDDLEWARE_MAVEN_REPO}
INFOQ_DEPLOY_ROOT=${INFOQ_DEPLOY_ROOT}
MIDDLEWARE_TRUSTSTORE_PASSWORD=${truststore_password}
ES_BOOTSTRAP_PASSWORD=${es_bootstrap_password}
ES_IT_USERNAME=infoq_it_${MIDDLEWARE_RUN_ID//-/_}
ES_IT_PASSWORD=${es_it_password}
MYSQL_ROOT_PASSWORD=$(secret)
REDIS_PASSWORD=$(secret)
MINIO_ROOT_USER=elasticsearch-it
MINIO_ROOT_PASSWORD=$(secret)
INFOQ_PUBLIC_BASE_URL=http://127.0.0.1
SECURITY_TOKEN_SECRET=$(secret)
INFOQ_DB_USERNAME=infoq
INFOQ_DB_PASSWORD=$(secret)
EOF
chmod 0600 "${env_file}"

export MIDDLEWARE_TRUSTSTORE_PASSWORD="${truststore_password}"
/opt/infoq-elasticsearch/generate-certificates.sh elasticsearch

test "$(stat -c '%a' /run/secrets)" = 700
test "$(stat -c '%a' "${env_file}")" = 600
test "$(stat -c '%a' /run/secrets/truststore.p12)" = 600
printf 'run_id=%s\nsecret_directory_mode=%s\nenv_file_mode=%s\ntruststore_mode=%s\n' \
  "${MIDDLEWARE_RUN_ID}" "$(stat -c '%a' /run/secrets)" "$(stat -c '%a' "${env_file}")" \
  "$(stat -c '%a' /run/secrets/truststore.p12)"