#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BASE_COMPOSE_FILE="${REPO_ROOT}/script/docker/docker-compose.yml"
DEFAULT_DEPLOY_ROOT="/infoq"
DEFAULT_ENV_FILE="/etc/infoq-scaffold-ai/deploy.env"
COMPONENT="${1:-}"
TOPOLOGY="${2:-}"
ACTION="${3:-}"
DEPLOY_ROOT=""
OVERLAY_FILE=""
COMPOSE_CMD=()
TARGET_SERVICES=()
ES_CLUSTER_INITIAL_MASTER_NODES_VALUE=""

usage() {
  cat <<'EOF'
用法: bash script/bin/deploy-middleware.sh <mqtt|elasticsearch> <single|cluster> <prepare|config|deploy|bootstrap|status|stop>

示例:
  bash script/bin/deploy-middleware.sh mqtt single config
  bash script/bin/deploy-middleware.sh mqtt cluster deploy
  bash script/bin/deploy-middleware.sh elasticsearch cluster bootstrap
  bash script/bin/deploy-middleware.sh elasticsearch cluster status

命令说明:
  prepare    创建所选拓扑的缺失数据目录；不生成证书、不创建账户、不启动容器
  config     校验所选生产材料并渲染 Compose；不创建容器或目录
  deploy     准备数据目录并启动所选节点；ES cluster 不注入初始主节点列表
  bootstrap  仅 Elasticsearch cluster 首次建群可用；要求三个 data 目录均为空后才注入初始主节点列表
  status     查看所选节点状态
  stop       仅停止所选节点；不删除容器、网络、volume 或宿主机数据

约束:
  - MQTT 与 Elasticsearch 始终是可选服务；基础部署不会调用本脚本。
  - single 与 cluster 均为 production overlay，禁止使用 docker-compose.*-it.yml。
  - cluster 是同一 Docker Compose 主机内的三个节点，不等同于跨主机高可用。
EOF
}

fail() {
  echo "[middleware] $*" >&2
  exit 1
}

require_command() {
  local name="$1"
  command -v "${name}" >/dev/null 2>&1 || fail "缺少命令: ${name}"
}

load_deploy_env() {
  local env_file="${INFOQ_ENV_FILE:-}"

  if [[ -z "${env_file}" && -f "${DEFAULT_ENV_FILE}" ]]; then
    env_file="${DEFAULT_ENV_FILE}"
  fi

  if [[ -n "${env_file}" ]]; then
    [[ -f "${env_file}" ]] || fail "指定的环境文件不存在: ${env_file}"
    set -a
    # shellcheck disable=SC1090
    . "${env_file}"
    set +a
    INFOQ_ENV_FILE="${env_file}"
  fi
}

require_env_vars() {
  local missing=()
  local name

  for name in "$@"; do
    [[ -n "${!name:-}" ]] || missing+=("${name}")
  done

  if (( ${#missing[@]} > 0 )); then
    fail "缺少部署环境变量: ${missing[*]}；请使用受保护的 INFOQ_ENV_FILE 提供生产值"
  fi
}

resolve_deploy_root() {
  if [[ -n "${INFOQ_DEPLOY_ROOT:-}" ]]; then
    DEPLOY_ROOT="${INFOQ_DEPLOY_ROOT}"
  elif [[ -d "${DEFAULT_DEPLOY_ROOT}" || -w "/" ]]; then
    DEPLOY_ROOT="${DEFAULT_DEPLOY_ROOT}"
  else
    DEPLOY_ROOT="${HOME}/infoq"
  fi
}

resolve_compose_command() {
  if (( ${#COMPOSE_CMD[@]} > 0 )); then
    return
  fi

  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker compose)
    return
  fi

  if command -v docker-compose >/dev/null 2>&1 && docker-compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker-compose)
    return
  fi

  fail "缺少 Docker Compose CLI: 需要 docker compose 或 docker-compose"
}

select_topology() {
  case "${COMPONENT}:${TOPOLOGY}" in
    mqtt:single)
      OVERLAY_FILE="${REPO_ROOT}/script/docker/docker-compose.mqtt.yml"
      TARGET_SERVICES=(mqtt-broker)
      ;;
    mqtt:cluster)
      OVERLAY_FILE="${REPO_ROOT}/script/docker/docker-compose.mqtt-cluster.yml"
      TARGET_SERVICES=(mqtt-broker-1 mqtt-broker-2 mqtt-broker-3)
      ;;
    elasticsearch:single)
      OVERLAY_FILE="${REPO_ROOT}/script/docker/docker-compose.elasticsearch.yml"
      TARGET_SERVICES=(elasticsearch)
      ;;
    elasticsearch:cluster)
      OVERLAY_FILE="${REPO_ROOT}/script/docker/docker-compose.elasticsearch-cluster.yml"
      TARGET_SERVICES=(es01 es02 es03)
      ;;
    *)
      usage >&2
      fail "不支持的组件或拓扑: ${COMPONENT} ${TOPOLOGY}"
      ;;
  esac

  [[ -f "${OVERLAY_FILE}" ]] || fail "缺少 production overlay: ${OVERLAY_FILE}"
}

validate_action() {
  case "${ACTION}" in
    prepare|config|deploy|status|stop)
      ;;
    bootstrap)
      [[ "${COMPONENT}:${TOPOLOGY}" == "elasticsearch:cluster" ]] || fail "bootstrap 仅允许 elasticsearch cluster"
      ;;
    *)
      usage >&2
      fail "不支持的操作: ${ACTION}"
      ;;
  esac
}

require_compose_environment() {
  require_env_vars \
    INFOQ_DEPLOY_ROOT \
    MYSQL_ROOT_PASSWORD \
    INFOQ_DB_USERNAME \
    INFOQ_DB_PASSWORD \
    REDIS_PASSWORD \
    MINIO_ROOT_USER \
    MINIO_ROOT_PASSWORD \
    INFOQ_PUBLIC_BASE_URL \
    SECURITY_TOKEN_SECRET

  case "${COMPONENT}" in
    mqtt)
      require_env_vars MQTT_NODE_COOKIE MQTT_ADMIN_USERNAME MQTT_ADMIN_PASSWORD
      ;;
    elasticsearch)
      require_env_vars ES_BOOTSTRAP_PASSWORD
      ;;
  esac
}

require_file() {
  local path="$1"
  [[ -f "${path}" && -r "${path}" ]] || fail "缺少或不可读的生产材料: ${path}"
}

require_data_dir() {
  local path="$1"
  [[ -d "${path}" ]] || fail "缺少数据目录: ${path}；先执行 prepare 或由运维预创建并设置容器写入权限"
}

prepare_data_dir() {
  local path="$1"
  if [[ -e "${path}" ]]; then
    [[ -d "${path}" ]] || fail "数据路径不是目录: ${path}"
    return 0
  fi

  if [[ "$(id -u)" != "0" ]]; then
    fail "缺失数据目录只能由 root 创建并设置容器写入权限: ${path}；请由运维预创建，或以 root 执行 prepare"
  fi

  mkdir -p "${path}"
  chown 1000:0 "${path}"
  chmod 0750 "${path}"
}

is_empty_dir() {
  local path="$1"
  [[ -d "${path}" ]] || return 1
  [[ -z "$(find "${path}" -mindepth 1 -maxdepth 1 -print -quit)" ]]
}

mqtt_data_dirs() {
  if [[ "${TOPOLOGY}" == "single" ]]; then
    printf '%s\n' "${DEPLOY_ROOT}/mqtt/data"
  else
    printf '%s\n' \
      "${DEPLOY_ROOT}/mqtt/data/mqtt-broker-1" \
      "${DEPLOY_ROOT}/mqtt/data/mqtt-broker-2" \
      "${DEPLOY_ROOT}/mqtt/data/mqtt-broker-3"
  fi
}

elasticsearch_data_dirs() {
  if [[ "${TOPOLOGY}" == "single" ]]; then
    printf '%s\n' "${DEPLOY_ROOT}/elasticsearch/data"
  else
    printf '%s\n' \
      "${DEPLOY_ROOT}/elasticsearch/data/es01" \
      "${DEPLOY_ROOT}/elasticsearch/data/es02" \
      "${DEPLOY_ROOT}/elasticsearch/data/es03"
  fi
}

prepare_data_dirs() {
  local path
  if [[ "${COMPONENT}" == "mqtt" ]]; then
    while IFS= read -r path; do
      prepare_data_dir "${path}"
    done < <(mqtt_data_dirs)
  else
    while IFS= read -r path; do
      prepare_data_dir "${path}"
    done < <(elasticsearch_data_dirs)
  fi
}

validate_data_dirs() {
  local path
  if [[ "${COMPONENT}" == "mqtt" ]]; then
    while IFS= read -r path; do
      require_data_dir "${path}"
    done < <(mqtt_data_dirs)
  else
    while IFS= read -r path; do
      require_data_dir "${path}"
    done < <(elasticsearch_data_dirs)
  fi
}

validate_mqtt_material() {
  require_file "${DEPLOY_ROOT}/mqtt/certs/ca.crt"
  if [[ "${TOPOLOGY}" == "single" ]]; then
    require_file "${DEPLOY_ROOT}/mqtt/certs/tls.crt"
    require_file "${DEPLOY_ROOT}/mqtt/certs/tls.key"
    return
  fi

  local node
  for node in mqtt-broker-1 mqtt-broker-2 mqtt-broker-3; do
    require_file "${DEPLOY_ROOT}/mqtt/certs/${node}/tls.crt"
    require_file "${DEPLOY_ROOT}/mqtt/certs/${node}/tls.key"
  done
}

validate_elasticsearch_material() {
  require_file "${DEPLOY_ROOT}/elasticsearch/certs/ca.crt"
  if [[ "${TOPOLOGY}" == "single" ]]; then
    require_file "${DEPLOY_ROOT}/elasticsearch/certs/tls.crt"
    require_file "${DEPLOY_ROOT}/elasticsearch/certs/tls.key"
    return
  fi

  local node
  for node in es01 es02 es03; do
    require_file "${DEPLOY_ROOT}/elasticsearch/certs/${node}/tls.crt"
    require_file "${DEPLOY_ROOT}/elasticsearch/certs/${node}/tls.key"
  done
}

validate_certificate_material() {
  if [[ "${COMPONENT}" == "mqtt" ]]; then
    validate_mqtt_material
  else
    validate_elasticsearch_material
  fi
}

validate_production_material() {
  validate_certificate_material
  validate_data_dirs
}

validate_elasticsearch_host() {
  [[ "${COMPONENT}" == "elasticsearch" ]] || return 0
  local max_map_count_file="/proc/sys/vm/max_map_count"
  local max_map_count

  if [[ -r "${max_map_count_file}" ]]; then
    max_map_count="$(<"${max_map_count_file}")"
    if [[ "${max_map_count}" =~ ^[0-9]+$ ]] && (( max_map_count < 262144 )); then
      fail "vm.max_map_count=${max_map_count}，Elasticsearch 至少需要 262144；请由运维修复宿主机参数后重试"
    fi
  fi
}

validate_cluster_bootstrap() {
  [[ "${COMPONENT}:${TOPOLOGY}" == "elasticsearch:cluster" ]] || fail "内部错误：bootstrap 拓扑不匹配"
  local path
  while IFS= read -r path; do
    if ! is_empty_dir "${path}"; then
      fail "Elasticsearch cluster bootstrap 只允许空数据目录；${path} 已有内容，请使用 deploy，脚本不会删除数据"
    fi
  done < <(elasticsearch_data_dirs)
}

compose() {
  resolve_compose_command
  INFOQ_DEPLOY_ROOT="${DEPLOY_ROOT}" \
    COMPOSE_PROJECT_NAME="${INFOQ_COMPOSE_PROJECT_NAME:-${COMPOSE_PROJECT_NAME:-infoq-scaffold-ai}}" \
    DEPLOY_ID="${DEPLOY_ID:-}" \
    MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-}" \
    INFOQ_DB_USERNAME="${INFOQ_DB_USERNAME:-}" \
    INFOQ_DB_PASSWORD="${INFOQ_DB_PASSWORD:-}" \
    REDIS_PASSWORD="${REDIS_PASSWORD:-}" \
    MINIO_ROOT_USER="${MINIO_ROOT_USER:-}" \
    MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-}" \
    INFOQ_PUBLIC_BASE_URL="${INFOQ_PUBLIC_BASE_URL:-}" \
    SECURITY_TOKEN_SECRET="${SECURITY_TOKEN_SECRET:-}" \
    MQTT_NODE_COOKIE="${MQTT_NODE_COOKIE:-}" \
    MQTT_ADMIN_USERNAME="${MQTT_ADMIN_USERNAME:-}" \
    MQTT_ADMIN_PASSWORD="${MQTT_ADMIN_PASSWORD:-}" \
    ES_BOOTSTRAP_PASSWORD="${ES_BOOTSTRAP_PASSWORD:-}" \
    ES_CLUSTER_INITIAL_MASTER_NODES="${ES_CLUSTER_INITIAL_MASTER_NODES_VALUE}" \
    "${COMPOSE_CMD[@]}" -f "${BASE_COMPOSE_FILE}" -f "${OVERLAY_FILE}" "$@"
}

render_config() {
  compose config >/dev/null
  echo "[middleware] Compose 配置渲染成功: ${COMPONENT} ${TOPOLOGY}"
}

prepare_topology() {
  require_compose_environment
  validate_certificate_material
  prepare_data_dirs
  validate_data_dirs
  echo "[middleware] 生产材料和数据目录已确认: ${COMPONENT} ${TOPOLOGY}"
}

deploy_topology() {
  prepare_topology
  validate_elasticsearch_host
  ES_CLUSTER_INITIAL_MASTER_NODES_VALUE=""
  render_config
  compose up -d --no-deps "${TARGET_SERVICES[@]}"
  compose ps "${TARGET_SERVICES[@]}"
  echo "[middleware] 已请求部署: ${COMPONENT} ${TOPOLOGY}"
}

bootstrap_elasticsearch_cluster() {
  prepare_topology
  validate_cluster_bootstrap
  validate_elasticsearch_host
  ES_CLUSTER_INITIAL_MASTER_NODES_VALUE="es01,es02,es03"
  render_config
  compose up -d --no-deps "${TARGET_SERVICES[@]}"
  compose ps "${TARGET_SERVICES[@]}"
  echo "[middleware] 已请求 Elasticsearch cluster 首次 bootstrap；后续重启必须使用 deploy"
}

status_topology() {
  require_compose_environment
  compose ps "${TARGET_SERVICES[@]}"
}

stop_topology() {
  require_compose_environment
  compose stop "${TARGET_SERVICES[@]}"
  echo "[middleware] 已停止所选节点；未删除容器、网络、volume 或数据目录"
}

if (( $# != 3 )); then
  usage >&2
  exit 1
fi

load_deploy_env
resolve_deploy_root
select_topology
validate_action

case "${ACTION}" in
  prepare)
    prepare_topology
    ;;
  config)
    require_compose_environment
    validate_production_material
    render_config
    ;;
  deploy)
    deploy_topology
    ;;
  bootstrap)
    bootstrap_elasticsearch_cluster
    ;;
  status)
    status_topology
    ;;
  stop)
    stop_topology
    ;;
esac