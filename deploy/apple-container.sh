#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${INFOQ_ENV_FILE:-${SCRIPT_DIR}/.env}"

STACK_LABEL_KEY="org.infoq.stack"
STACK_LABEL_VALUE="apple-container"
NETWORK_NAME="infoq-apple"
MYSQL_CONTAINER="infoq-apple-mysql"
REDIS_CONTAINER="infoq-apple-redis"
ADMIN_CONTAINER="infoq-apple-admin"
MYSQL_VOLUME="infoq-apple-mysql-data"
REDIS_VOLUME="infoq-apple-redis-data"
PLATFORM="linux/arm64"
BUILD_DIR="${REPO_ROOT}/tmp/deploy-cli/apple-build"
SQL_INIT_FILE="${REPO_ROOT}/sql/infoq_scaffold_3.0.0.sql"
RUNTIME_DOCKERFILE="${SCRIPT_DIR}/Dockerfile.apple"

TEMP_DIR=""
LOCK_DIR="${TMPDIR:-/tmp}/infoq-apple-container.lock"
LOCK_ACQUIRED=false

MYSQL_IMAGE=""
REDIS_IMAGE=""
ADMIN_IMAGE=""
BIND_HOST=""
HOST_PORT=""
ACCESS_HOST=""
NETWORK_SUBNET=""
DEPLOY_ROOT=""
MYSQL_ROOT_PASSWORD=""
INFOQ_DB_USERNAME=""
INFOQ_DB_PASSWORD=""
REDIS_PASSWORD=""
SECURITY_TOKEN_SECRET=""
INFOQ_API_REQUEST_PRIVATE_KEY=""
INFOQ_API_RESPONSE_PUBLIC_KEY=""
DEPLOY_ID=""
TZ_VALUE=""
MYSQL_ADDRESS=""
REDIS_ADDRESS=""
ADMIN_ENV_FILE=""

info() {
    printf '[INFO] %s\n' "$*"
}

warn() {
    printf '[WARN] %s\n' "$*" >&2
}

die() {
    printf '[ERROR] %s\n' "$*" >&2
    exit 1
}

usage() {
    cat <<'USAGE'
Usage: ./apple-container.sh <command> [options]

Commands:
  init                       Create deploy/.env and generate secrets
  build [--from-existing-jar]
                             Package the backend and build the runtime image
  up [--recreate]            Create and start MySQL, Redis, and infoq-admin
  down                       Stop the stack and preserve data
  restart                    Restart the stack in dependency order
  status                     Show container and workload health
  logs <mysql|redis|admin>   Show logs for one service
  pull                       Pull MySQL, Redis, and runtime base images
  destroy [--volumes] [--yes]
                             Delete owned infoq-apple containers and network

Environment:
  INFOQ_ENV_FILE             Path to the deployment env file (default: deploy/.env)
  INFOQ_DEPLOY_MODE          Must be development in the env file; production uses Linux Docker

init generates two independent 2048-bit RSA pairs and local credentials. It never prints secrets.
USAGE
}

cleanup() {
    local exit_code=$?
    if [[ -n "${TEMP_DIR}" && -d "${TEMP_DIR}" ]]; then
        rm -rf "${TEMP_DIR}"
    fi
    if [[ "${LOCK_ACQUIRED}" == true && -d "${LOCK_DIR}" ]]; then
        rm -f "${LOCK_DIR}/pid"
        rmdir "${LOCK_DIR}" 2>/dev/null || true
    fi
    exit "${exit_code}"
}

acquire_lock() {
    if [[ "${LOCK_ACQUIRED}" == true ]]; then
        return
    fi
    if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
        local owner_pid=""
        if [[ -f "${LOCK_DIR}/pid" ]]; then
            owner_pid="$(<"${LOCK_DIR}/pid")"
        fi
        if [[ "${owner_pid}" =~ ^[0-9]+$ ]] && ! kill -0 "${owner_pid}" 2>/dev/null; then
            rm -rf "${LOCK_DIR}"
            mkdir "${LOCK_DIR}" || die "Failed to reclaim stale operation lock."
        else
            die "Another InfoQ Apple container operation is already running."
        fi
    fi
    printf '%s\n' "$$" >"${LOCK_DIR}/pid"
    LOCK_ACQUIRED=true
    trap cleanup EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM
    trap 'exit 129' HUP
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

assert_infoq_apple_name() {
    local name=$1
    [[ "${name}" == infoq-apple* ]] || die "Refusing unmanaged name '${name}'."
}

json_extract() {
    local spec=$1
    local mode=${2:-raw}
    python3 -c '
import json
import sys

spec = sys.argv[1]
mode = sys.argv[2]
try:
    data = json.load(sys.stdin)
    for part in spec.split("."):
        if isinstance(data, list):
            data = data[int(part)]
        elif isinstance(data, dict):
            data = data[part]
        else:
            raise KeyError(part)
except Exception:
    raise SystemExit(1)
if mode == "json" or isinstance(data, (dict, list)):
    json.dump(data, sys.stdout, separators=(",", ":"))
elif data is None:
    pass
else:
    sys.stdout.write(str(data))
' "${spec}" "${mode}"
}

require_container_version() {
    local version_output major minor
    require_command container
    require_command python3
    version_output="$(container --version)"
    if [[ ! "${version_output}" =~ ([0-9]+)\.([0-9]+)\.([0-9]+) ]]; then
        die "Unable to parse Apple container version: ${version_output}"
    fi
    major="${BASH_REMATCH[1]}"
    minor="${BASH_REMATCH[2]}"
    if (( major < 1 || (major == 1 && minor < 1) )); then
        die "Apple container 1.1.0 or newer is required; found ${version_output}."
    fi
}

system_is_running() {
    container system status >/dev/null 2>&1
}

start_system() {
    if ! system_is_running; then
        info "Starting Apple container services..."
        container system start --enable-kernel-install
    fi
}

list_resource_ids() {
    case "$1" in
        container) container list --all --quiet ;;
        network) container network list --quiet ;;
        volume) container volume list --quiet ;;
        *) die "Unknown resource type: $1" ;;
    esac
}

resource_exists() {
    local resource_type=$1
    local resource_name=$2
    local output line
    if ! output="$(list_resource_ids "${resource_type}")"; then
        die "Failed to list Apple container ${resource_type} resources."
    fi
    while IFS= read -r line; do
        if [[ "${line}" == "${resource_name}" ]]; then
            return 0
        fi
    done <<<"${output}"
    return 1
}

inspect_resource() {
    case "$1" in
        container) container inspect "$2" ;;
        network) container network inspect "$2" ;;
        volume) container volume inspect "$2" ;;
        *) die "Unknown resource type: $1" ;;
    esac
}

assert_resource_owned() {
    local resource_type=$1
    local resource_name=$2
    local inspection compact
    assert_infoq_apple_name "${resource_name}"
    inspection="$(inspect_resource "${resource_type}" "${resource_name}" | \
        json_extract 0.configuration.labels json)" || \
        die "Failed to inspect ${resource_type} ${resource_name}."
    compact="$(printf '%s' "${inspection}" | tr -d '[:space:]')"
    if [[ "${compact}" != *"\"${STACK_LABEL_KEY}\":\"${STACK_LABEL_VALUE}\""* ]]; then
        die "Refusing to manage existing ${resource_type} '${resource_name}' because it is not owned by this stack."
    fi
}

preflight_stack_ownership() {
    local resource_name
    for resource_name in "${ADMIN_CONTAINER}" "${REDIS_CONTAINER}" "${MYSQL_CONTAINER}"; do
        if resource_exists container "${resource_name}"; then
            assert_resource_owned container "${resource_name}"
        fi
    done
    if resource_exists network "${NETWORK_NAME}"; then
        assert_resource_owned network "${NETWORK_NAME}"
    fi
    for resource_name in "${MYSQL_VOLUME}" "${REDIS_VOLUME}"; do
        if resource_exists volume "${resource_name}"; then
            assert_resource_owned volume "${resource_name}"
        fi
    done
}

warn_foreign_stacks() {
    local output
    output="$(container list --all 2>/dev/null || true)"
    if printf '%s\n' "${output}" | awk 'NR > 1 && $1 != "buildkit" && $1 !~ /^infoq-apple/ { found = 1 } END { exit(found ? 0 : 1) }'; then
        info "Detected other Apple container workloads; only infoq-apple* resources are managed."
    fi
}

ensure_network() {
    local existing_subnet
    if resource_exists network "${NETWORK_NAME}"; then
        assert_resource_owned network "${NETWORK_NAME}"
        existing_subnet="$(inspect_resource network "${NETWORK_NAME}" | \
            json_extract 0.status.ipv4Subnet)" || \
            die "Unable to read the IPv4 subnet for ${NETWORK_NAME}."
        if [[ "${existing_subnet}" != "${NETWORK_SUBNET}" ]]; then
            die "Existing network '${NETWORK_NAME}' uses subnet '${existing_subnet}', but APPLE_CONTAINER_NETWORK_SUBNET is '${NETWORK_SUBNET}'."
        fi
        return
    fi
    info "Creating network ${NETWORK_NAME}..."
    container network create \
        --label "${STACK_LABEL_KEY}=${STACK_LABEL_VALUE}" \
        --subnet "${NETWORK_SUBNET}" \
        "${NETWORK_NAME}" >/dev/null
}

ensure_volume() {
    local volume_name=$1
    assert_infoq_apple_name "${volume_name}"
    if resource_exists volume "${volume_name}"; then
        assert_resource_owned volume "${volume_name}"
        return
    fi
    info "Creating volume ${volume_name}..."
    container volume create \
        --label "${STACK_LABEL_KEY}=${STACK_LABEL_VALUE}" \
        "${volume_name}" >/dev/null
}

image_exists() {
    container image inspect "$1" >/dev/null 2>&1
}

ensure_image_available() {
    local image=$1
    if image_exists "${image}"; then
        return
    fi
    info "Pulling ${image}..."
    container image pull --platform "${PLATFORM}" "${image}"
}

container_is_running() {
    local container_name=$1
    local output line
    output="$(container list --quiet)" || die "Failed to list running Apple containers."
    while IFS= read -r line; do
        if [[ "${line}" == "${container_name}" ]]; then
            return 0
        fi
    done <<<"${output}"
    return 1
}

ensure_system() {
    require_container_version
    require_command curl
    start_system
}

container_ipv4_address() {
    local container_name=$1
    local address
    address="$(container inspect "${container_name}" | \
        json_extract 0.status.networks.0.ipv4Address raw)" || \
        die "Unable to read the network address for ${container_name}."
    address="${address%%/*}"
    [[ "${address}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || \
        die "Apple container returned an invalid IPv4 address for ${container_name}: ${address}"
    printf '%s\n' "${address}"
}

read_env_value() {
    node --input-type=module - "${REPO_ROOT}/tools/production_config.mjs" "${ENV_FILE}" "$1" "${2-}" <<'NODE'
import {pathToFileURL} from 'node:url';
const {readProductionConfig} = await import(pathToFileURL(process.argv[2]));
const values = readProductionConfig(process.argv[3]);
process.stdout.write(values[process.argv[4]] ?? process.argv[5]);
NODE
}

replace_env_value() {
    local key=$1
    local value=$2
    INFOQ_VALUE_TO_WRITE="${value}" python3 -c '
import os
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
key = sys.argv[2]
value = os.environ["INFOQ_VALUE_TO_WRITE"]
lines = path.read_text(encoding="utf-8").splitlines()
replaced = False
output = []
for line in lines:
    if line.startswith(key + "="):
        output.append(f"{key}={value}")
        replaced = True
    else:
        output.append(line)
if not replaced:
    if output and output[-1] != "":
        output.append("")
    output.append(f"{key}={value}")
path.write_text("\n".join(output) + "\n", encoding="utf-8")
' "${ENV_FILE}" "${key}"
}

generate_secret() {
    openssl rand -hex 32
}

validate_port() {
    local port=$1
    [[ "${port}" =~ ^[0-9]+$ ]] || die "Invalid port: ${port}"
    (( port > 1024 && port <= 65535 )) || die "Host port must be between 1025 and 65535: ${port}"
}

validate_ipv4_address() {
    local address=$1
    python3 -c 'import ipaddress,sys; ipaddress.IPv4Address(sys.argv[1])' "${address}" >/dev/null 2>&1 || die "Invalid IPv4 address: ${address}"
}

file_mode() {
    python3 -c 'import os,sys; print(oct(os.stat(sys.argv[1]).st_mode & 0o777))' "$1"
}

validate_env_file_security() {
    local mode
    [[ -f "${ENV_FILE}" ]] || die "Env file not found: ${ENV_FILE}. Run './apple-container.sh init' first."
    mode="$(file_mode "${ENV_FILE}")"
    if [[ "${mode}" != "0o600" && "${mode}" != "0600" ]]; then
        die "Env file ${ENV_FILE} must be mode 600; found ${mode}."
    fi
}

cmd_init() {
    local example_file="${SCRIPT_DIR}/.env.example"
    local created=false
    [[ -f "${example_file}" ]] || die "Missing ${example_file}."
    require_command openssl
    require_command node
    if [[ ! -f "${ENV_FILE}" ]]; then
        cp "${example_file}" "${ENV_FILE}"
        created=true
        info "Created ${ENV_FILE} from .env.example."
    fi
    chmod 600 "${ENV_FILE}"
    if [[ "${created}" != true && -n "$(read_env_value INFOQ_DEPLOY_MODE)" && "$(read_env_value INFOQ_DEPLOY_MODE)" != "development" ]]; then
        die "Apple local stack requires explicit INFOQ_DEPLOY_MODE=development; use Linux Docker for production."
    fi
    replace_env_value INFOQ_DEPLOY_MODE development
    node --input-type=module - "${REPO_ROOT}/tools/production_config.mjs" "${ENV_FILE}" <<'NODE'
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {generateKeyPairSync} from 'node:crypto';
const {readProductionConfig} = await import(pathToFileURL(process.argv[2]));
const file = process.argv[3], env = readProductionConfig(file);
const names = ['VITE_APP_RSA_PUBLIC_KEY', 'INFOQ_API_REQUEST_PRIVATE_KEY', 'VITE_APP_RSA_PRIVATE_KEY', 'INFOQ_API_RESPONSE_PUBLIC_KEY'];
if (names.some((name) => env[name]) && !names.every((name) => env[name])) throw new Error('RSA 配置不完整；拒绝自动轮换已有密钥，请提供四项配对配置');
if (!names.every((name) => env[name])) {
  let text = fs.readFileSync(file, 'utf8');
  for (const [publicName, privateName] of [[names[0], names[1]], [names[3], names[2]]]) {
    const pair = generateKeyPairSync('rsa', {modulusLength: 2048, publicKeyEncoding: {format: 'der', type: 'spki'}, privateKeyEncoding: {format: 'der', type: 'pkcs8'}});
    for (const [name, value] of [[publicName, pair.publicKey], [privateName, pair.privateKey]]) {
      text = text.replace(new RegExp(`^${name}=.*(?:\\r?\\n|$)`, 'mu'), '');
      text += `\n${name}=${value.toString('base64')}\n`;
    }
  }
  fs.writeFileSync(file, text, {encoding: 'utf8', mode: 0o600});
}
NODE
    if [[ "$(read_env_value MYSQL_ROOT_PASSWORD)" == change-me-* || -z "$(read_env_value MYSQL_ROOT_PASSWORD)" ]]; then
        replace_env_value MYSQL_ROOT_PASSWORD "$(generate_secret)"
    fi
    if [[ "$(read_env_value INFOQ_DB_PASSWORD)" == change-me-* || -z "$(read_env_value INFOQ_DB_PASSWORD)" ]]; then
        replace_env_value INFOQ_DB_PASSWORD "$(generate_secret)"
    fi
    if [[ "$(read_env_value REDIS_PASSWORD)" == change-me-* || -z "$(read_env_value REDIS_PASSWORD)" ]]; then
        replace_env_value REDIS_PASSWORD "$(generate_secret)"
    fi
    if [[ "$(read_env_value SECURITY_TOKEN_SECRET)" == change-me-* || -z "$(read_env_value SECURITY_TOKEN_SECRET)" ]]; then
        replace_env_value SECURITY_TOKEN_SECRET "$(generate_secret)"
    fi
    if [[ -z "$(read_env_value INFOQ_DB_USERNAME)" ]]; then
        replace_env_value INFOQ_DB_USERNAME infoq_app
    fi
    replace_env_value APPLE_CONTAINER_BIND_HOST "$(read_env_value APPLE_CONTAINER_BIND_HOST 127.0.0.1)"
    replace_env_value APPLE_CONTAINER_HOST_PORT "$(read_env_value APPLE_CONTAINER_HOST_PORT 19090)"
    replace_env_value APPLE_CONTAINER_NETWORK_SUBNET "$(read_env_value APPLE_CONTAINER_NETWORK_SUBNET 192.168.66.0/24)"
    replace_env_value APPLE_CONTAINER_MYSQL_IMAGE "$(read_env_value APPLE_CONTAINER_MYSQL_IMAGE mysql:8.0.42)"
    replace_env_value APPLE_CONTAINER_REDIS_IMAGE "$(read_env_value APPLE_CONTAINER_REDIS_IMAGE redis:7.2.8)"
    replace_env_value APPLE_CONTAINER_ADMIN_IMAGE "$(read_env_value APPLE_CONTAINER_ADMIN_IMAGE localhost/infoq-admin:3.0.0-apple)"
    if [[ -z "$(read_env_value APPLE_CONTAINER_DEPLOY_ROOT)" ]]; then
        replace_env_value APPLE_CONTAINER_DEPLOY_ROOT "${HOME}/infoq-apple"
    fi
    if [[ -z "$(read_env_value DEPLOY_ID)" || "$(read_env_value DEPLOY_ID)" == "3.0.0-local" ]]; then
        replace_env_value DEPLOY_ID "3.0.0-apple-$(date +%Y%m%d%H%M%S)"
    fi
    node "${REPO_ROOT}/tools/production_config.mjs" check --scope apple --env-file "${ENV_FILE}"
    info "Apple container env is ready: ${ENV_FILE}"
}

prepare_environment() {
    validate_env_file_security
    require_command node
    node "${REPO_ROOT}/tools/production_config.mjs" check --scope apple --env-file "${ENV_FILE}"
    MYSQL_IMAGE="$(read_env_value APPLE_CONTAINER_MYSQL_IMAGE mysql:8.0.42)"
    REDIS_IMAGE="$(read_env_value APPLE_CONTAINER_REDIS_IMAGE redis:7.2.8)"
    ADMIN_IMAGE="$(read_env_value APPLE_CONTAINER_ADMIN_IMAGE localhost/infoq-admin:3.0.0-apple)"
    BIND_HOST="$(read_env_value APPLE_CONTAINER_BIND_HOST 127.0.0.1)"
    HOST_PORT="$(read_env_value APPLE_CONTAINER_HOST_PORT 19090)"
    NETWORK_SUBNET="$(read_env_value APPLE_CONTAINER_NETWORK_SUBNET 192.168.66.0/24)"
    DEPLOY_ROOT="$(read_env_value APPLE_CONTAINER_DEPLOY_ROOT "${HOME}/infoq-apple")"
    MYSQL_ROOT_PASSWORD="$(read_env_value MYSQL_ROOT_PASSWORD)"
    INFOQ_DB_USERNAME="$(read_env_value INFOQ_DB_USERNAME infoq_app)"
    INFOQ_DB_PASSWORD="$(read_env_value INFOQ_DB_PASSWORD)"
    REDIS_PASSWORD="$(read_env_value REDIS_PASSWORD)"
    SECURITY_TOKEN_SECRET="$(read_env_value SECURITY_TOKEN_SECRET)"
    INFOQ_API_REQUEST_PRIVATE_KEY="$(read_env_value INFOQ_API_REQUEST_PRIVATE_KEY)"
    INFOQ_API_RESPONSE_PUBLIC_KEY="$(read_env_value INFOQ_API_RESPONSE_PUBLIC_KEY)"
    DEPLOY_ID="$(read_env_value DEPLOY_ID 3.0.0-apple)"
    TZ_VALUE="$(read_env_value TZ Asia/Shanghai)"
    ACCESS_HOST="${BIND_HOST}"
    if [[ "${ACCESS_HOST}" == "0.0.0.0" ]]; then
        ACCESS_HOST="127.0.0.1"
    fi
    [[ -n "${MYSQL_ROOT_PASSWORD}" ]] || die "MYSQL_ROOT_PASSWORD is required."
    [[ -n "${INFOQ_DB_PASSWORD}" ]] || die "INFOQ_DB_PASSWORD is required."
    [[ -n "${REDIS_PASSWORD}" ]] || die "REDIS_PASSWORD is required."
    [[ -n "${SECURITY_TOKEN_SECRET}" ]] || die "SECURITY_TOKEN_SECRET is required."
    [[ "${#SECURITY_TOKEN_SECRET}" -ge 32 ]] || die "SECURITY_TOKEN_SECRET must be at least 32 characters."
    validate_port "${HOST_PORT}"
    validate_ipv4_address "${BIND_HOST}"
    [[ "${DEPLOY_ROOT}" != "${HOME}/infoq" && "${DEPLOY_ROOT}" != "/infoq" ]] || \
        die "APPLE_CONTAINER_DEPLOY_ROOT must not reuse /infoq or \$HOME/infoq."
    [[ "${NETWORK_NAME}" == "infoq-apple" ]] || die "Network name is not overridable."
}

ensure_deploy_dirs() {
    mkdir -p \
        "${DEPLOY_ROOT}/server/config" \
        "${DEPLOY_ROOT}/server/logs" \
        "${DEPLOY_ROOT}/server/temp"
    chmod 700 "${DEPLOY_ROOT}"
}

write_admin_config() {
    local config_file="${DEPLOY_ROOT}/server/config/application-prod.yml"
    python3 -c '
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
mysql_ip, redis_ip, db_user, db_password, redis_password, deploy_id = sys.argv[2:]
path.write_text(
    "\n".join([
        "---",
        "server:",
        "  shutdown: graceful",
        "spring:",
        "  lifecycle:",
        "    timeout-per-shutdown-phase: 30s",
        "  datasource:",
        "    dynamic:",
        "      datasource:",
        "        master:",
        f"          url: jdbc:mysql://{mysql_ip}:3306/infoq?useUnicode=true&characterEncoding=utf8&zeroDateTimeBehavior=convertToNull&useSSL=true&serverTimezone=GMT%2B8&autoReconnect=true&rewriteBatchedStatements=true&allowPublicKeyRetrieval=true&nullCatalogMeansCurrent=true&connectTimeout=10000&socketTimeout=30000&tcpKeepAlive=true",
        f"          username: {json.dumps(db_user, ensure_ascii=False)}",
        f"          password: {json.dumps(db_password, ensure_ascii=False)}",
        "spring.data:",
        "  redis:",
        f"    host: {redis_ip}",
        "    port: 6379",
        f"    password: {json.dumps(redis_password, ensure_ascii=False)}",
        "infoq:",
        "  quartz:",
        "    bootstrap:",
        f"      deploy-id: {json.dumps(deploy_id, ensure_ascii=False)}",
        "spring.servlet.multipart.location: /infoq/server/temp",
        "",
    ]),
    encoding="utf-8",
)
' "${config_file}" "${MYSQL_ADDRESS}" "${REDIS_ADDRESS}" "${INFOQ_DB_USERNAME}" \
        "${INFOQ_DB_PASSWORD}" "${REDIS_PASSWORD}" "${DEPLOY_ID}"
    chmod 600 "${config_file}"
}

write_admin_env_file() {
    ADMIN_ENV_FILE="${TEMP_DIR}/admin.env"
    cat >"${ADMIN_ENV_FILE}" <<ENV
TZ=${TZ_VALUE}
SERVER_PORT=9090
SPRING_PROFILES_ACTIVE=prod
SPRING_CONFIG_ADDITIONAL_LOCATION=file:/infoq/server/config/
SECURITY_TOKEN_SECRET=${SECURITY_TOKEN_SECRET}
INFOQ_API_REQUEST_PRIVATE_KEY=${INFOQ_API_REQUEST_PRIVATE_KEY}
INFOQ_API_RESPONSE_PUBLIC_KEY=${INFOQ_API_RESPONSE_PUBLIC_KEY}
INFOQ_DB_USERNAME=${INFOQ_DB_USERNAME}
INFOQ_DB_PASSWORD=${INFOQ_DB_PASSWORD}
REDIS_PASSWORD=${REDIS_PASSWORD}
DEPLOY_ID=${DEPLOY_ID}
JAVA_OPTS=-Xms512m -Xmx1024m
ENV
    chmod 600 "${ADMIN_ENV_FILE}"
}

create_mysql_container() {
    info "Creating MySQL container..."
    container create \
        --name "${MYSQL_CONTAINER}" \
        --label "${STACK_LABEL_KEY}=${STACK_LABEL_VALUE}" \
        --network "${NETWORK_NAME}" \
        --platform "${PLATFORM}" \
        --cpus 2 \
        --memory 2G \
        --env TZ="${TZ_VALUE}" \
        --env MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD}" \
        --env MYSQL_DATABASE=infoq \
        --volume "${MYSQL_VOLUME}:/var/lib/mysql" \
        --mount "type=bind,source=${REPO_ROOT}/sql,target=/docker-entrypoint-initdb.d,readonly" \
        "${MYSQL_IMAGE}" \
        --default-authentication-plugin=mysql_native_password \
        --character-set-server=utf8mb4 \
        --collation-server=utf8mb4_general_ci \
        --explicit_defaults_for_timestamp=true \
        --lower_case_table_names=1 \
        >/dev/null
}

create_redis_container() {
    info "Creating Redis container..."
    container create \
        --name "${REDIS_CONTAINER}" \
        --label "${STACK_LABEL_KEY}=${STACK_LABEL_VALUE}" \
        --network "${NETWORK_NAME}" \
        --platform "${PLATFORM}" \
        --cpus 1 \
        --memory 512M \
        --env TZ="${TZ_VALUE}" \
        --volume "${REDIS_VOLUME}:/data" \
        "${REDIS_IMAGE}" \
        redis-server --appendonly yes --requirepass "${REDIS_PASSWORD}" \
        >/dev/null
}

create_admin_container() {
    info "Creating infoq-admin container..."
    container create \
        --name "${ADMIN_CONTAINER}" \
        --label "${STACK_LABEL_KEY}=${STACK_LABEL_VALUE}" \
        --network "${NETWORK_NAME}" \
        --platform "${PLATFORM}" \
        --cpus 2 \
        --memory 2G \
        --publish "${BIND_HOST}:${HOST_PORT}:9090/tcp" \
        --env-file "${ADMIN_ENV_FILE}" \
        --mount "type=bind,source=${DEPLOY_ROOT}/server/config,target=/infoq/server/config,readonly" \
        --mount "type=bind,source=${DEPLOY_ROOT}/server/logs,target=/infoq/server/logs" \
        --mount "type=bind,source=${DEPLOY_ROOT}/server/temp,target=/infoq/server/temp" \
        "${ADMIN_IMAGE}" \
        >/dev/null
}

start_container_if_needed() {
    local container_name=$1
    if container_is_running "${container_name}"; then
        return
    fi
    info "Starting ${container_name}..."
    container start "${container_name}" >/dev/null
}

stop_container_if_running() {
    local container_name=$1
    if container_is_running "${container_name}"; then
        info "Stopping ${container_name}..."
        container stop "${container_name}" >/dev/null
    fi
}

delete_container_if_present() {
    local container_name=$1
    if resource_exists container "${container_name}"; then
        assert_resource_owned container "${container_name}"
        info "Deleting ${container_name}..."
        container delete --force "${container_name}" >/dev/null 2>&1 || container rm --force "${container_name}" >/dev/null
    fi
}

delete_volume_if_present() {
    local volume_name=$1
    if resource_exists volume "${volume_name}"; then
        assert_resource_owned volume "${volume_name}"
        info "Deleting volume ${volume_name}..."
        container volume delete "${volume_name}" >/dev/null
    fi
}

delete_network_if_present() {
    if resource_exists network "${NETWORK_NAME}"; then
        assert_resource_owned network "${NETWORK_NAME}"
        info "Deleting network ${NETWORK_NAME}..."
        container network delete "${NETWORK_NAME}" >/dev/null
    fi
}

run_with_timeout() {
    local timeout_seconds=$1
    shift
    "$@" &
    local command_pid=$!
    local elapsed=0
    while kill -0 "${command_pid}" 2>/dev/null; do
        if (( elapsed >= timeout_seconds )); then
            kill -TERM "${command_pid}" 2>/dev/null || true
            sleep 1
            if kill -0 "${command_pid}" 2>/dev/null; then
                kill -KILL "${command_pid}" 2>/dev/null || true
            fi
            wait "${command_pid}" 2>/dev/null || true
            return 124
        fi
        sleep 1
        ((elapsed += 1))
    done
    wait "${command_pid}"
}

wait_for_probe() {
    local description=$1
    local attempts=$2
    shift 2
    local attempt
    for ((attempt = 1; attempt <= attempts; attempt++)); do
        if "$@" >/dev/null 2>&1; then
            info "${description} is ready."
            return 0
        fi
        sleep 1
    done
    return 1
}

probe_mysql() {
    run_with_timeout 30 container exec \
        --env MYSQL_PWD="${MYSQL_ROOT_PASSWORD}" \
        "${MYSQL_CONTAINER}" \
        mysqladmin ping -h 127.0.0.1 -uroot --silent
}

probe_redis() {
    run_with_timeout 30 container exec "${REDIS_CONTAINER}" \
        redis-cli -a "${REDIS_PASSWORD}" --no-auth-warning ping
}

probe_admin() {
    probe_host_admin
}

probe_host_admin() {
    curl --noproxy '*' --fail --silent --show-error --max-time 5 \
        "http://${ACCESS_HOST}:${HOST_PORT}/monitor/health/readiness"
}

show_failure_logs() {
    local container_name=$1
    warn "Last logs from ${container_name}:"
    container logs -n 80 "${container_name}" >&2 || true
}

ensure_mysql_app_user() {
    local db_user db_password
    db_user="$(printf '%s' "${INFOQ_DB_USERNAME}" | sed "s/'/''/g")"
    db_password="$(printf '%s' "${INFOQ_DB_PASSWORD}" | sed "s/'/''/g")"
    run_with_timeout 30 container exec \
        --env MYSQL_PWD="${MYSQL_ROOT_PASSWORD}" \
        "${MYSQL_CONTAINER}" \
        mysql -uroot -e "SET SESSION sql_mode='NO_BACKSLASH_ESCAPES'; CREATE USER IF NOT EXISTS '${db_user}'@'%' IDENTIFIED BY '${db_password}'; ALTER USER '${db_user}'@'%' IDENTIFIED BY '${db_password}'; GRANT ALL PRIVILEGES ON infoq.* TO '${db_user}'@'%'; FLUSH PRIVILEGES;"
}

cmd_build() {
    local from_existing=false
    local jar_file="${REPO_ROOT}/backend/infoq-admin/target/infoq-admin.jar"
    if [[ $# -gt 1 || ($# -eq 1 && "${1-}" != "--from-existing-jar") ]]; then
        usage
        exit 2
    fi
    if [[ "${1-}" == "--from-existing-jar" ]]; then
        from_existing=true
    fi
    prepare_environment
    ensure_system
    mkdir -p "${BUILD_DIR}"
    if [[ "${from_existing}" == true ]]; then
        [[ -f "${jar_file}" ]] || die "Missing ${jar_file}. Package the backend first."
    else
        require_command node
        info "Packaging infoq-admin with host Maven..."
        node "${REPO_ROOT}/tools/backend_mvn.mjs" -- \
            -B -ntp -P prod -pl infoq-admin -am -DskipTests package
    fi
    cp "${jar_file}" "${BUILD_DIR}/app.jar"
    info "Building ${ADMIN_IMAGE}..."
    container build \
        --platform "${PLATFORM}" \
        --cpus 4 \
        --memory 4G \
        --tag "${ADMIN_IMAGE}" \
        --file "${RUNTIME_DOCKERFILE}" \
        "${BUILD_DIR}"
}

cmd_pull() {
    prepare_environment
    ensure_system
    ensure_image_available "${MYSQL_IMAGE}"
    ensure_image_available "${REDIS_IMAGE}"
    ensure_image_available "bellsoft/liberica-openjdk-rocky:21.0.12-cds"
}

cmd_up() {
    local recreate=false
    if [[ $# -gt 1 || ($# -eq 1 && "${1-}" != "--recreate") ]]; then
        usage
        exit 2
    fi
    if [[ "${1-}" == "--recreate" ]]; then
        recreate=true
    fi
    prepare_environment
    acquire_lock
    TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/infoq-apple.XXXXXX")"
    ensure_system
    warn_foreign_stacks
    preflight_stack_ownership
    [[ -f "${SQL_INIT_FILE}" ]] || die "Missing SQL baseline ${SQL_INIT_FILE}."
    ensure_deploy_dirs
    ensure_network
    ensure_volume "${MYSQL_VOLUME}"
    ensure_volume "${REDIS_VOLUME}"
    ensure_image_available "${MYSQL_IMAGE}"
    ensure_image_available "${REDIS_IMAGE}"
    if ! image_exists "${ADMIN_IMAGE}"; then
        info "Admin image ${ADMIN_IMAGE} is missing; building it."
        cmd_build
    fi
    if [[ "${recreate}" == true ]]; then
        delete_container_if_present "${ADMIN_CONTAINER}"
        delete_container_if_present "${REDIS_CONTAINER}"
        delete_container_if_present "${MYSQL_CONTAINER}"
    fi
    if ! resource_exists container "${MYSQL_CONTAINER}"; then
        create_mysql_container
    fi
    if ! resource_exists container "${REDIS_CONTAINER}"; then
        create_redis_container
    fi
    start_container_if_needed "${MYSQL_CONTAINER}"
    if ! wait_for_probe "MySQL" 90 probe_mysql; then
        show_failure_logs "${MYSQL_CONTAINER}"
        die "MySQL did not become ready."
    fi
    ensure_mysql_app_user
    start_container_if_needed "${REDIS_CONTAINER}"
    if ! wait_for_probe "Redis" 60 probe_redis; then
        show_failure_logs "${REDIS_CONTAINER}"
        die "Redis did not become ready."
    fi
    MYSQL_ADDRESS="$(container_ipv4_address "${MYSQL_CONTAINER}")"
    REDIS_ADDRESS="$(container_ipv4_address "${REDIS_CONTAINER}")"
    write_admin_config
    write_admin_env_file
    if ! resource_exists container "${ADMIN_CONTAINER}"; then
        create_admin_container
    fi
    start_container_if_needed "${ADMIN_CONTAINER}"
    if ! wait_for_probe "infoq-admin" 180 probe_admin; then
        show_failure_logs "${ADMIN_CONTAINER}"
        die "infoq-admin did not become ready."
    fi
    if ! wait_for_probe "infoq-admin host port" 20 probe_host_admin; then
        die "Host port forwarding failed. In System Settings > Privacy & Security > Local Network, allow container-runtime-linux, then retry."
    fi
    info "InfoQ Apple container stack is ready at http://${ACCESS_HOST}:${HOST_PORT}/monitor/health/readiness"
}

cmd_down() {
    prepare_environment
    acquire_lock
    ensure_system
    preflight_stack_ownership
    stop_container_if_running "${ADMIN_CONTAINER}"
    stop_container_if_running "${REDIS_CONTAINER}"
    stop_container_if_running "${MYSQL_CONTAINER}"
    info "Stopped the InfoQ Apple container stack."
}

cmd_restart() {
    cmd_down
    cmd_up
}

print_container_status() {
    local container_name=$1
    if ! resource_exists container "${container_name}"; then
        printf '%-22s missing\n' "${container_name}"
        return
    fi
    if container_is_running "${container_name}"; then
        printf '%-22s running  %s\n' "${container_name}" "$(container_ipv4_address "${container_name}")"
    else
        printf '%-22s stopped\n' "${container_name}"
    fi
}

cmd_status() {
    prepare_environment
    ensure_system
    warn_foreign_stacks
    print_container_status "${MYSQL_CONTAINER}"
    print_container_status "${REDIS_CONTAINER}"
    print_container_status "${ADMIN_CONTAINER}"
    if container_is_running "${ADMIN_CONTAINER}"; then
        if probe_host_admin >/dev/null 2>&1; then
            info "Host readiness probe passed."
        else
            warn "Host readiness probe failed."
            return 1
        fi
    fi
}

cmd_logs() {
    local service=${1-}
    local follow=${2-}
    local container_name=""
    case "${service}" in
        mysql) container_name="${MYSQL_CONTAINER}" ;;
        redis) container_name="${REDIS_CONTAINER}" ;;
        admin) container_name="${ADMIN_CONTAINER}" ;;
        *) usage; exit 2 ;;
    esac
    prepare_environment
    ensure_system
    assert_infoq_apple_name "${container_name}"
    if [[ "${follow}" == "-f" ]]; then
        container logs --follow "${container_name}"
    elif [[ -n "${follow}" ]]; then
        usage
        exit 2
    else
        container logs -n 100 "${container_name}"
    fi
}

confirm_destroy() {
    local include_volumes=$1
    local answer
    if [[ "${include_volumes}" == true ]]; then
        printf 'Delete the InfoQ Apple stack and persistent volumes? [y/N] '
    else
        printf 'Delete InfoQ Apple containers and network, preserving volumes? [y/N] '
    fi
    read -r answer
    [[ "${answer}" == "y" || "${answer}" == "Y" ]]
}

cmd_destroy() {
    local include_volumes=false
    local assume_yes=false
    local argument
    for argument in "$@"; do
        case "${argument}" in
            --volumes) include_volumes=true ;;
            --yes) assume_yes=true ;;
            *) usage; exit 2 ;;
        esac
    done
    acquire_lock
    ensure_system
    if [[ -f "${ENV_FILE}" ]]; then
        prepare_environment
    fi
    preflight_stack_ownership
    if [[ "${assume_yes}" != true ]] && ! confirm_destroy "${include_volumes}"; then
        info "Cancelled."
        return
    fi
    delete_container_if_present "${ADMIN_CONTAINER}"
    delete_container_if_present "${REDIS_CONTAINER}"
    delete_container_if_present "${MYSQL_CONTAINER}"
    if [[ "${include_volumes}" == true ]]; then
        delete_volume_if_present "${MYSQL_VOLUME}"
        delete_volume_if_present "${REDIS_VOLUME}"
    fi
    delete_network_if_present
    info "Destroyed owned infoq-apple resources."
}

main() {
    local command=${1-}
    shift || true
    case "${command}" in
        init) cmd_init "$@" ;;
        build) cmd_build "$@" ;;
        pull) cmd_pull "$@" ;;
        up) cmd_up "$@" ;;
        down) cmd_down "$@" ;;
        restart) cmd_restart "$@" ;;
        status) cmd_status "$@" ;;
        logs) cmd_logs "$@" ;;
        destroy) cmd_destroy "$@" ;;
        -h|--help|help|"") usage ;;
        *) usage; exit 2 ;;
    esac
}

main "$@"
