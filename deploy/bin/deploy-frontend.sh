#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy-paths.sh
. "${SCRIPT_DIR}/deploy-paths.sh"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
. "${SCRIPT_DIR}/runtime-env.sh"
COMPOSE_FILE="${REPO_ROOT}/deploy/docker/docker-compose.yml"
DEFAULT_DEPLOY_ROOT="/infoq"
DEFAULT_ENV_FILE="/etc/infoq-scaffold-ai/deploy.env"
DEPLOY_ROOT=""
FRONTEND_TARGET=""
TARGET_FRONTEND_SERVICES=()
TARGET_FRONTEND_DIRS=()
TARGET_FRONTEND_LABEL=""
COMPOSE_CMD=()

usage() {
  cat <<'EOF'
用法: bash deploy/bin/deploy-frontend.sh {prepare|build|deploy|start|stop|restart|status|logs} [vue|react|nginx|all]

命令说明:
  prepare   创建目标前端与网关所需宿主机目录，并生成 nginx.conf
  build     构建目标前端镜像；目标为 all 时构建 Vue 与 React
  deploy    prepare + build + 启动目标前端与 nginx-web
  start     准备目录并重新生成 nginx.conf，再启动目标前端与 nginx-web
  stop      停止目标前端与 nginx-web
  restart   重新渲染受控 TLS，nginx -t 通过后重建目标前端与网关
  status    查看目标前端与 nginx-web 服务状态
  logs      查看日志，默认 all，可选 vue|react|nginx|all
EOF
}

normalize_frontend_target() {
  case "$1" in
    vue|react|all)
      printf '%s' "$1"
      ;;
    1)
      printf 'react'
      ;;
    2)
      printf 'vue'
      ;;
    3)
      printf 'all'
      ;;
    *)
      echo "[frontend] 无效前端目标: $1，请使用 1|2|3 或 vue|react|all" >&2
      exit 1
      ;;
  esac
}

set_target_resources() {
  TARGET_FRONTEND_SERVICES=()
  TARGET_FRONTEND_DIRS=()
  TARGET_FRONTEND_LABEL=""

  case "${FRONTEND_TARGET}" in
    all)
      TARGET_FRONTEND_SERVICES=(infoq-frontend-vue infoq-frontend-react)
      TARGET_FRONTEND_DIRS=(vue react)
      TARGET_FRONTEND_LABEL="Vue、React"
      ;;
    vue)
      TARGET_FRONTEND_SERVICES=(infoq-frontend-vue)
      TARGET_FRONTEND_DIRS=(vue)
      TARGET_FRONTEND_LABEL="Vue"
      ;;
    react)
      TARGET_FRONTEND_SERVICES=(infoq-frontend-react)
      TARGET_FRONTEND_DIRS=(react)
      TARGET_FRONTEND_LABEL="React"
      ;;
    *)
      echo "[frontend] 无效前端目标: ${FRONTEND_TARGET}" >&2
      exit 1
      ;;
  esac
}

require_command() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "[frontend] 缺少命令: $name" >&2
    exit 1
  fi
}

load_deploy_env() {
  local env_file="${INFOQ_ENV_FILE:-}"

  if [[ -z "${env_file}" && -f "${DEFAULT_ENV_FILE}" ]]; then
    env_file="${DEFAULT_ENV_FILE}"
  fi

  if [[ -n "${env_file}" ]]; then
    if [[ ! -f "${env_file}" ]]; then
      echo "[frontend] 指定的环境文件不存在: ${env_file}" >&2
      exit 1
    fi
    load_runtime_env_data "${env_file}"
    INFOQ_ENV_FILE="${env_file}"
  fi
  if [[ -z "${env_file}" && -n "${INFOQ_PRODUCTION_CONFIG_FILE:-}" ]]; then
    load_runtime_env_data "${INFOQ_PRODUCTION_CONFIG_FILE}"
  fi
}

validate_docker_credential_helper() {
  local helper="$1"
  local docker_config_file="$2"
  local helper_command

  if [[ -z "${helper}" ]]; then
    return
  fi

  helper_command="docker-credential-${helper}"
  if ! command -v "${helper_command}" >/dev/null 2>&1; then
    echo "[frontend] Docker 配置 ${docker_config_file} 引用了 ${helper_command}，但当前 PATH 中找不到该 helper" >&2
    echo "[frontend] 使用 Colima 且不依赖 Docker Desktop 时，请清理 Docker config 中失效的 credsStore/credHelpers；一次性验证可临时设置 DOCKER_CONFIG 指向不包含该 helper 的配置目录，并设置 DOCKER_HOST 指向 Colima socket 后重试" >&2
    exit 1
  fi
}

validate_docker_credential_helpers() {
  local docker_config_file="${DOCKER_CONFIG:-${HOME}/.docker}/config.json"
  local docker_config_content
  local creds_store
  local cred_helpers
  local helper

  if [[ ! -f "${docker_config_file}" ]]; then
    return
  fi

  docker_config_content="$(tr -d '\n\r' < "${docker_config_file}")"
  creds_store="$(printf '%s' "${docker_config_content}" | sed -nE 's/.*"credsStore"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' | head -n 1)"
  validate_docker_credential_helper "${creds_store}" "${docker_config_file}"

  cred_helpers="$(
    printf '%s' "${docker_config_content}" |
      sed -nE 's/.*"credHelpers"[[:space:]]*:[[:space:]]*\{([^}]*)\}.*/\1/p' |
      grep -oE ':[[:space:]]*"[^"]+"' |
      sed -E 's/.*"([^"]+)".*/\1/' |
      sort -u || true
  )"
  while IFS= read -r helper; do
    validate_docker_credential_helper "${helper}" "${docker_config_file}"
  done <<< "${cred_helpers}"
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

  echo "[frontend] 缺少 Docker Compose CLI: 需要 docker compose 或 docker-compose" >&2
  exit 1
}

compose() {
  resolve_compose_command
  local vue_context_path="${INFOQ_VUE_CONTEXT_PATH:-/vue/}"
  local react_context_path="${INFOQ_REACT_CONTEXT_PATH:-/react/}"

  case "${FRONTEND_TARGET:-all}" in
    vue)
      vue_context_path="/"
      ;;
    react)
      react_context_path="/"
      ;;
  esac

  INFOQ_DEPLOY_ROOT="${DEPLOY_ROOT}" \
    COMPOSE_PROJECT_NAME="${INFOQ_COMPOSE_PROJECT_NAME:-${COMPOSE_PROJECT_NAME:-infoq-scaffold-ai}}" \
    DEPLOY_ID="${DEPLOY_ID:-}" \
    MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-}" \
    INFOQ_DB_USERNAME="${INFOQ_DB_USERNAME:-}" \
    INFOQ_DB_PASSWORD="${INFOQ_DB_PASSWORD:-}" \
    REDIS_PASSWORD="${REDIS_PASSWORD:-}" \
    MINIO_ROOT_USER="${MINIO_ROOT_USER:-}" \
    MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-}" \
    INFOQ_PUBLIC_BASE_URL="${INFOQ_PUBLIC_BASE_URL:-http://localhost}" \
    INFOQ_VUE_CONTEXT_PATH="${vue_context_path}" \
    INFOQ_REACT_CONTEXT_PATH="${react_context_path}" \
    SECURITY_TOKEN_SECRET="${SECURITY_TOKEN_SECRET:-}" \
    "${COMPOSE_CMD[@]}" -f "${COMPOSE_FILE}" "$@"
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

render_nginx_conf() {
  INFOQ_DEPLOY_ROOT="${DEPLOY_ROOT}" INFOQ_FRONTEND_TARGET="${FRONTEND_TARGET}" \
    node "${SCRIPT_DIR}/render-gateway.mjs" render --execute
}

prepare_dirs() {
  DEPLOY_ROOT="${DEPLOY_ROOT%/}"
  local dirs=(
    "${DEPLOY_ROOT}/nginx/cert"
    "${DEPLOY_ROOT}/nginx/conf"
    "${DEPLOY_ROOT}/nginx/log"
  )
  local frontend_dir
  local dir

  for frontend_dir in "${TARGET_FRONTEND_DIRS[@]}"; do
    dirs+=("${DEPLOY_ROOT}/${frontend_dir}/logs")
  done

  prepare_deploy_dir "${DEPLOY_ROOT}"
  prepare_deploy_service_dir "${DEPLOY_ROOT}/nginx"
  for frontend_dir in "${TARGET_FRONTEND_DIRS[@]}"; do
    prepare_deploy_service_dir "${DEPLOY_ROOT}/${frontend_dir}"
  done
  for dir in "${dirs[@]}"; do
    prepare_deploy_dir "${dir}"
  done

  deploy_assert_file_target "${DEPLOY_ROOT}/nginx/conf/nginx.conf"
  render_nginx_conf
  echo "[frontend] 使用部署根目录: ${DEPLOY_ROOT}"
  echo "[frontend] 目标前端: ${FRONTEND_TARGET}"
  echo "[frontend] 目录和 nginx.conf 已准备完成"
}

build_frontends() {
  local service config_digest current_digest

  validate_docker_credential_helpers
  resolve_compose_command
  config_digest="$(node "${REPO_ROOT}/tools/production_config.mjs" frontend-cache-key)"
  export INFOQ_FRONTEND_CONFIG_DIGEST="${config_digest}"
  for service in "${TARGET_FRONTEND_SERVICES[@]}"; do
    echo "[frontend] 构建前端镜像: ${service}"
    compose build "${service}"
    current_digest="$(node "${REPO_ROOT}/tools/production_config.mjs" frontend-cache-key)"
    if [[ "${current_digest}" != "${config_digest}" ]]; then
      echo "[frontend] 受控浏览器配置在构建期间发生变化；停止部署，请使用同一份稳定配置重新构建" >&2
      exit 1
    fi
  done
}

verify_volume_users() {
  local dir service
  local services="nginx-web"
  local args=()
  for service in "${TARGET_FRONTEND_SERVICES[@]}"; do services="${services},${service}"; done
  args=(--services "${services}" --execute)
  for dir in "${INFOQ_NEW_DEPLOY_DIRS[@]:-}"; do
    if [[ -d "${dir}" && -z "$(find "${dir}" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then args+=(--new-dir "${dir}"); fi
  done
  INFOQ_DEPLOY_ROOT="${DEPLOY_ROOT}" node "${SCRIPT_DIR}/prepare-volume-users.mjs" "${args[@]}"
}

deploy_frontends() {
  local public_base_url="${INFOQ_PUBLIC_BASE_URL:-http://localhost}"
  public_base_url="${public_base_url%/}"

  resolve_compose_command
  prepare_dirs
  build_frontends
  compose pull nginx-web
  verify_volume_users
  compose up -d --no-deps "${TARGET_FRONTEND_SERVICES[@]}"
  compose run --rm --no-deps nginx-web nginx -t
  # Recreate only after nginx accepts the generated configuration.
  compose up -d --no-deps --force-recreate nginx-web
  echo "[frontend] 部署完成"
  if [[ "${FRONTEND_TARGET}" == "all" ]]; then
    echo "[frontend] 网关入口: ${public_base_url}/vue/、${public_base_url}/react/、${public_base_url}/console-oss/ 和 ${INFOQ_OSS_PUBLIC_ORIGIN}/"
    echo "[frontend] 直连端口: Vue=9091 React=9092"
  else
    echo "[frontend] 网关入口: ${public_base_url}/、${public_base_url}/console-oss/ 和 ${INFOQ_OSS_PUBLIC_ORIGIN}/"
    echo "[frontend] 已安装前端: ${TARGET_FRONTEND_LABEL}"
  fi
}

start_frontends() {
  resolve_compose_command
  prepare_dirs
  verify_volume_users
  compose up -d --no-deps "${TARGET_FRONTEND_SERVICES[@]}"
  compose run --rm --no-deps nginx-web nginx -t
  compose up -d --no-deps --force-recreate nginx-web
}

stop_frontends() {
  resolve_compose_command
  compose stop "${TARGET_FRONTEND_SERVICES[@]}" nginx-web
}

restart_frontends() {
  prepare_dirs
  resolve_compose_command
  verify_volume_users
  compose up -d --no-deps --force-recreate "${TARGET_FRONTEND_SERVICES[@]}"
  compose run --rm --no-deps nginx-web nginx -t
  compose up -d --no-deps --force-recreate nginx-web
}

status_frontends() {
  resolve_compose_command
  compose ps "${TARGET_FRONTEND_SERVICES[@]}" nginx-web
}

show_logs() {
  case "${1:-all}" in
    vue)
      compose logs -f infoq-frontend-vue
      ;;
    react)
      compose logs -f infoq-frontend-react
      ;;
    nginx)
      compose logs -f nginx-web
      ;;
    all)
      compose logs -f "${TARGET_FRONTEND_SERVICES[@]}" nginx-web
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

load_deploy_env

COMMAND="${1:-}"
if [[ "${COMMAND}" == "logs" ]]; then
  FRONTEND_TARGET="$(normalize_frontend_target "${INFOQ_FRONTEND_TARGET:-all}")"
else
  FRONTEND_TARGET="$(normalize_frontend_target "${2:-${INFOQ_FRONTEND_TARGET:-all}}")"
fi
set_target_resources

case "${COMMAND}" in
  prepare|build|deploy|start|restart)
    require_command node
    node "${REPO_ROOT}/tools/production_config.mjs" check --scope deploy
    resolve_deploy_root
    INFOQ_DEPLOY_ROOT="${DEPLOY_ROOT}" INFOQ_FRONTEND_TARGET="${FRONTEND_TARGET}" node "${SCRIPT_DIR}/render-gateway.mjs" check
    ;;
esac

case "${COMMAND}" in
  prepare)
    resolve_deploy_root
    prepare_dirs
    ;;
  build)
    resolve_deploy_root
    build_frontends
    ;;
  deploy)
    resolve_deploy_root
    deploy_frontends
    ;;
  start)
    resolve_deploy_root
    start_frontends
    ;;
  stop)
    resolve_deploy_root
    stop_frontends
    ;;
  restart)
    resolve_deploy_root
    restart_frontends
    ;;
  status)
    resolve_deploy_root
    status_frontends
    ;;
  logs)
    resolve_deploy_root
    show_logs "${2:-all}"
    ;;
  *)
    usage
    exit 1
    ;;
esac
