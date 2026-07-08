#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/script/docker/docker-compose.yml"
NGINX_CONF_SOURCE="${REPO_ROOT}/script/docker/nginx/conf/nginx.conf"
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
用法: bash script/bin/deploy-frontend.sh {prepare|build|deploy|start|stop|restart|status|logs} [vue|react|react-pro|nginx|all]

命令说明:
  prepare   创建目标前端与网关所需宿主机目录，并生成 nginx.conf
  build     构建目标前端镜像；目标为 all 时构建 Vue、React 与 React Pro
  deploy    prepare + build + 启动目标前端与 nginx-web
  start     启动目标前端与 nginx-web
  stop      停止目标前端与 nginx-web
  restart   重启目标前端与 nginx-web
  status    查看目标前端与 nginx-web 服务状态
  logs      查看日志，默认 all，可选 vue|react|react-pro|nginx|all
EOF
}

normalize_frontend_target() {
  case "$1" in
    vue|react|react-pro|all)
      printf '%s' "$1"
      ;;
    1)
      printf 'react'
      ;;
    2)
      printf 'react-pro'
      ;;
    3)
      printf 'vue'
      ;;
    4)
      printf 'all'
      ;;
    *)
      echo "[frontend] 无效前端目标: $1，请使用 1|2|3|4 或 vue|react|react-pro|all" >&2
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
      TARGET_FRONTEND_SERVICES=(infoq-frontend-vue infoq-frontend-react infoq-frontend-react-pro)
      TARGET_FRONTEND_DIRS=(vue react react-pro)
      TARGET_FRONTEND_LABEL="Vue、React、React Pro"
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
    react-pro)
      TARGET_FRONTEND_SERVICES=(infoq-frontend-react-pro)
      TARGET_FRONTEND_DIRS=(react-pro)
      TARGET_FRONTEND_LABEL="React Pro"
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
    set -a
    # shellcheck disable=SC1090
    . "${env_file}"
    set +a
    INFOQ_ENV_FILE="${env_file}"
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
  # Compose interpolates every service before applying the requested service list.
  # Frontend commands never start infoq-admin, so this placeholder only satisfies parsing.
  local compose_security_token_secret="${SECURITY_TOKEN_SECRET:-frontend-compose-placeholder-token-secret-20260601}"
  local vue_context_path="${INFOQ_VUE_CONTEXT_PATH:-/vue/}"
  local react_context_path="${INFOQ_REACT_CONTEXT_PATH:-/react/}"
  local react_pro_context_path="${INFOQ_REACT_PRO_CONTEXT_PATH:-/react-pro/}"

  case "${FRONTEND_TARGET:-all}" in
    vue)
      vue_context_path="/"
      ;;
    react)
      react_context_path="/"
      ;;
    react-pro)
      react_pro_context_path="/"
      ;;
  esac

  INFOQ_DEPLOY_ROOT="${DEPLOY_ROOT}" \
    COMPOSE_PROJECT_NAME="${INFOQ_COMPOSE_PROJECT_NAME:-${COMPOSE_PROJECT_NAME:-infoq-scaffold-ai}}" \
    DEPLOY_ID="${DEPLOY_ID:-frontend-compose-placeholder-deploy-id}" \
    MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-frontend-compose-placeholder-mysql-root}" \
    INFOQ_DB_USERNAME="${INFOQ_DB_USERNAME:-frontend_placeholder_app}" \
    INFOQ_DB_PASSWORD="${INFOQ_DB_PASSWORD:-frontend-compose-placeholder-db-password}" \
    REDIS_PASSWORD="${REDIS_PASSWORD:-frontend-compose-placeholder-redis-password}" \
    MINIO_ROOT_USER="${MINIO_ROOT_USER:-frontend_placeholder_minio}" \
    MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-frontend-compose-placeholder-minio-password}" \
    INFOQ_PUBLIC_BASE_URL="${INFOQ_PUBLIC_BASE_URL:-http://localhost}" \
    INFOQ_VUE_CONTEXT_PATH="${vue_context_path}" \
    INFOQ_REACT_CONTEXT_PATH="${react_context_path}" \
    INFOQ_REACT_PRO_CONTEXT_PATH="${react_pro_context_path}" \
    SECURITY_TOKEN_SECRET="${compose_security_token_secret}" \
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

render_single_frontend_nginx_conf() {
  local frontend_service
  local frontend_port

  case "${FRONTEND_TARGET}" in
    vue)
      frontend_service="infoq-frontend-vue"
      frontend_port="9091"
      ;;
    react)
      frontend_service="infoq-frontend-react"
      frontend_port="9092"
      ;;
    react-pro)
      frontend_service="infoq-frontend-react-pro"
      frontend_port="9093"
      ;;
    *)
      echo "[frontend] 单前端 nginx 配置不支持目标: ${FRONTEND_TARGET}" >&2
      exit 1
      ;;
  esac

  cat > "${DEPLOY_ROOT}/nginx/conf/nginx.conf" <<EOF
worker_processes  1;

error_log  /var/log/nginx/error.log warn;
pid        /var/run/nginx.pid;

events {
    worker_connections  1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile        on;
    keepalive_timeout  65;
    keepalive_requests 100000;
    client_max_body_size 100m;
    client_header_buffer_size 32k;
    client_body_buffer_size   512k;
    gzip_static on;
    limit_conn_zone \$binary_remote_addr zone=perip:10m;
    limit_conn_zone \$server_name zone=perserver:10m;
    server_tokens off;

    log_format  main  '\$remote_addr - \$remote_user [\$time_local] "\$request" '
                          '\$status \$body_bytes_sent "\$http_referer" '
                          '"\$http_user_agent" "\$http_x_forwarded_for"';

    access_log  /var/log/nginx/access.log  main;

    upstream backend_server {
        server infoq-admin:9090 max_fails=3 fail_timeout=10s;
    }

    upstream frontend_server {
        server ${frontend_service}:${frontend_port};
    }

    upstream minio_api_server {
        server minio:9000;
    }

    upstream minio_console_server {
        server minio:9001;
    }

    server {
        listen       80;
        server_name  localhost;

        location = /vue {
            return 302 /;
        }

        location ^~ /vue/ {
            return 302 /;
        }

        location = /react {
            return 302 /;
        }

        location ^~ /react/ {
            return 302 /;
        }

        location = /react-pro {
            return 302 /;
        }

        location ^~ /react-pro/ {
            return 302 /;
        }

        location = /console-oss {
            return 302 /console-oss/;
        }

        location = /oss {
            return 302 /oss/;
        }

        location ^~ /prod-api/ {
            proxy_set_header Host \$http_host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header REMOTE-HOST \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_read_timeout 86400s;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_buffering off;
            proxy_cache off;
            rewrite ^/prod-api/(.*)$ /\$1 break;
            proxy_pass http://backend_server;
        }

        location ^~ /console-oss/ {
            proxy_set_header Host \$http_host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header REMOTE-HOST \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_set_header X-Forwarded-Host \$host;
            proxy_set_header X-Forwarded-Prefix /console-oss;
            proxy_read_timeout 86400s;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_buffering off;
            proxy_pass http://minio_console_server/;
        }

        location ^~ /oss/ {
            proxy_set_header Host \$http_host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header REMOTE-HOST \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            client_max_body_size 200m;
            proxy_pass http://minio_api_server/;
        }

        location ^~ /dev-api/ {
            proxy_set_header Host \$http_host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header REMOTE-HOST \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_read_timeout 86400s;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_buffering off;
            proxy_cache off;
            rewrite ^/dev-api/(.*)$ /\$1 break;
            proxy_pass http://backend_server;
        }

        location / {
            proxy_set_header Host \$http_host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header REMOTE-HOST \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_pass http://frontend_server;
        }

        error_page   500 502 503 504  /50x.html;
        location = /50x.html {
            root   html;
        }
    }
}
EOF
}

render_nginx_conf() {
  if [[ "${FRONTEND_TARGET}" == "all" ]]; then
    cp -f "${NGINX_CONF_SOURCE}" "${DEPLOY_ROOT}/nginx/conf/nginx.conf"
  else
    render_single_frontend_nginx_conf
  fi
}

prepare_dirs() {
  local dirs=(
    "${DEPLOY_ROOT}/nginx/cert"
    "${DEPLOY_ROOT}/nginx/conf"
    "${DEPLOY_ROOT}/nginx/log"
  )
  local frontend_dir

  for frontend_dir in "${TARGET_FRONTEND_DIRS[@]}"; do
    dirs+=("${DEPLOY_ROOT}/${frontend_dir}" "${DEPLOY_ROOT}/${frontend_dir}/logs")
  done

  for dir in "${dirs[@]}"; do
    mkdir -p "${dir}"
    chmod 777 "${dir}" || true
  done

  render_nginx_conf
  echo "[frontend] 使用部署根目录: ${DEPLOY_ROOT}"
  echo "[frontend] 目标前端: ${FRONTEND_TARGET}"
  echo "[frontend] 目录和 nginx.conf 已准备完成"
}

build_frontends() {
  local service

  validate_docker_credential_helpers
  resolve_compose_command
  for service in "${TARGET_FRONTEND_SERVICES[@]}"; do
    echo "[frontend] 构建前端镜像: ${service}"
    compose build "${service}"
  done
}

deploy_frontends() {
  local public_base_url="${INFOQ_PUBLIC_BASE_URL:-http://localhost}"
  public_base_url="${public_base_url%/}"

  resolve_compose_command
  prepare_dirs
  build_frontends
  compose up -d --no-deps "${TARGET_FRONTEND_SERVICES[@]}"
  # Frontend containers are recreated during deploy; restart nginx afterwards so upstream DNS is refreshed.
  compose up -d --no-deps --force-recreate nginx-web
  echo "[frontend] 部署完成"
  if [[ "${FRONTEND_TARGET}" == "all" ]]; then
    echo "[frontend] 网关入口: ${public_base_url}/vue/、${public_base_url}/react/、${public_base_url}/react-pro/、${public_base_url}/console-oss/ 和 ${public_base_url}/oss/"
    echo "[frontend] 直连端口: Vue=9091 React=9092 ReactPro=9093"
  else
    echo "[frontend] 网关入口: ${public_base_url}/、${public_base_url}/console-oss/ 和 ${public_base_url}/oss/"
    echo "[frontend] 已安装前端: ${TARGET_FRONTEND_LABEL}"
  fi
}

start_frontends() {
  resolve_compose_command
  prepare_dirs
  compose up -d --no-deps "${TARGET_FRONTEND_SERVICES[@]}" nginx-web
}

stop_frontends() {
  resolve_compose_command
  compose stop "${TARGET_FRONTEND_SERVICES[@]}" nginx-web
}

restart_frontends() {
  resolve_compose_command
  compose restart "${TARGET_FRONTEND_SERVICES[@]}" nginx-web
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
    react-pro)
      compose logs -f infoq-frontend-react-pro
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
