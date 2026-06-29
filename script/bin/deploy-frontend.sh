#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/script/docker/docker-compose.yml"
NGINX_CONF_SOURCE="${REPO_ROOT}/script/docker/nginx/conf/nginx.conf"
FRONTEND_SERVICES=(infoq-frontend-vue infoq-frontend-react infoq-frontend-react-pro nginx-web)
DEFAULT_DEPLOY_ROOT="/infoq"
DEPLOY_ROOT=""
COMPOSE_CMD=()

usage() {
  cat <<'EOF'
用法: bash script/bin/deploy-frontend.sh {prepare|build|deploy|start|stop|restart|status|logs} [vue|react|react-pro|nginx|all]

命令说明:
  prepare   创建前端与网关所需宿主机目录，并同步 nginx.conf
  build     顺序构建 Vue、React 与 React Pro 前端镜像
  deploy    prepare + 顺序构建前端镜像 + 启动 Vue、React、React Pro 与 nginx-web
  start     启动 Vue、React、React Pro 与 nginx-web
  stop      停止 Vue、React、React Pro 与 nginx-web
  restart   重启 Vue、React、React Pro 与 nginx-web
  status    查看前端相关服务状态
  logs      查看日志，默认 all，可选 vue|react|react-pro|nginx|all
EOF
}

require_command() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "[frontend] 缺少命令: $name" >&2
    exit 1
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

  echo "[frontend] 缺少 Docker Compose CLI: 需要 docker compose 或 docker-compose" >&2
  exit 1
}

compose() {
  resolve_compose_command
  # Compose interpolates every service before applying the requested service list.
  # Frontend commands never start infoq-admin, so this placeholder only satisfies parsing.
  local compose_security_token_secret="${SECURITY_TOKEN_SECRET:-frontend-compose-placeholder-token-secret-20260601}"
  INFOQ_DEPLOY_ROOT="${DEPLOY_ROOT}" SECURITY_TOKEN_SECRET="${compose_security_token_secret}" "${COMPOSE_CMD[@]}" -f "${COMPOSE_FILE}" "$@"
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

prepare_dirs() {
  local dirs=(
    "${DEPLOY_ROOT}/nginx/cert"
    "${DEPLOY_ROOT}/nginx/conf"
    "${DEPLOY_ROOT}/nginx/log"
    "${DEPLOY_ROOT}/vue"
    "${DEPLOY_ROOT}/vue/logs"
    "${DEPLOY_ROOT}/react"
    "${DEPLOY_ROOT}/react/logs"
    "${DEPLOY_ROOT}/react-pro"
    "${DEPLOY_ROOT}/react-pro/logs"
  )

  for dir in "${dirs[@]}"; do
    mkdir -p "${dir}"
    chmod 777 "${dir}" || true
  done

  cp -f "${NGINX_CONF_SOURCE}" "${DEPLOY_ROOT}/nginx/conf/nginx.conf"
  echo "[frontend] 使用部署根目录: ${DEPLOY_ROOT}"
  echo "[frontend] 目录和 nginx.conf 已同步完成"
}

build_frontends() {
  resolve_compose_command
  echo "[frontend] 构建 Vue 前端镜像"
  compose build infoq-frontend-vue
  echo "[frontend] 构建 React 前端镜像"
  compose build infoq-frontend-react
  echo "[frontend] 构建 React Pro 前端镜像"
  compose build infoq-frontend-react-pro
}

deploy_frontends() {
  resolve_compose_command
  prepare_dirs
  build_frontends
  compose up -d --no-deps "${FRONTEND_SERVICES[@]}"
  echo "[frontend] 部署完成"
  echo "[frontend] 网关入口: http://localhost/vue/、http://localhost/react/ 和 http://localhost/react-pro/"
  echo "[frontend] 直连端口: Vue=9091 React=9092 ReactPro=9093"
}

start_frontends() {
  resolve_compose_command
  prepare_dirs
  compose up -d --no-deps "${FRONTEND_SERVICES[@]}"
}

stop_frontends() {
  resolve_compose_command
  compose stop "${FRONTEND_SERVICES[@]}"
}

restart_frontends() {
  resolve_compose_command
  compose restart "${FRONTEND_SERVICES[@]}"
}

status_frontends() {
  resolve_compose_command
  compose ps "${FRONTEND_SERVICES[@]}"
}

show_logs() {
  case "${1:-all}" in
    vue)
      compose logs -f infoq-frontend-vue
      ;;
    react)
      compose logs -f infoq-frontend-react
      ;;
    react-pro)
      compose logs -f infoq-frontend-react-pro
      ;;
    nginx)
      compose logs -f nginx-web
      ;;
    all)
      compose logs -f infoq-frontend-vue infoq-frontend-react infoq-frontend-react-pro nginx-web
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

case "${1:-}" in
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
