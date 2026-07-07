#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/script/docker/docker-compose.yml"
REDIS_CONF_SOURCE="${REPO_ROOT}/script/docker/redis/conf/redis.conf"
SERVER_CONFIG_TEMPLATE="${REPO_ROOT}/script/docker/server/application-prod.yml"
IP2REGION_V6_SOURCE="${REPO_ROOT}/script/docker/server/ip2region/ip2region_v6.xdb"
SQL_DIR="${REPO_ROOT}/sql"
SQL_INIT_REL="sql/infoq_scaffold_2.0.0.sql"
SQL_INIT_FILE="${REPO_ROOT}/${SQL_INIT_REL}"
BACKEND_DIR="${REPO_ROOT}/infoq-scaffold-backend"
ADMIN_JAR="${BACKEND_DIR}/infoq-admin/target/infoq-admin.jar"
BACKEND_SERVICES=(mysql redis minio infoq-admin)
DEFAULT_DEPLOY_ROOT="/infoq"
DEFAULT_ENV_FILE="/etc/infoq-scaffold-ai/deploy.env"
DEPLOY_ROOT=""
COMPOSE_CMD=()
DEPLOY_ID="${DEPLOY_ID:-}"
INFOQ_OSS_BUCKET="${INFOQ_OSS_BUCKET:-infoq}"

usage() {
  cat <<'EOF'
用法: bash script/bin/infoq.sh {prepare|package|build-image|deploy|start|stop|restart|status|logs} [service]

命令说明:
  prepare      创建后端及依赖服务所需宿主机目录，并同步 redis.conf 与 application-prod.yml
  package      执行后端 prod 打包
  build-image  仅构建 infoq-admin 镜像
  deploy       prepare + package + 启动依赖服务 + 自动初始化数据库 + 启动 infoq-admin
  start        启动现有 mysql、redis、minio、infoq-admin 容器
  stop         停止 mysql、redis、minio、infoq-admin
  restart      重启现有 infoq-admin 容器
  status       查看后端相关服务状态
  logs         查看服务日志，默认 infoq-admin，可选 mysql|redis|minio|infoq-admin
EOF
}

require_command() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "[backend] 缺少命令: $name" >&2
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
      echo "[backend] 指定的环境文件不存在: ${env_file}" >&2
      exit 1
    fi
    set -a
    # shellcheck disable=SC1090
    . "${env_file}"
    set +a
    INFOQ_ENV_FILE="${env_file}"
  fi

  INFOQ_OSS_BUCKET="${INFOQ_OSS_BUCKET:-infoq}"
}

require_env_vars() {
  local missing=()
  local name

  for name in "$@"; do
    if [[ -z "${!name:-}" ]]; then
      missing+=("${name}")
    fi
  done

  if (( ${#missing[@]} > 0 )); then
    echo "[backend] 缺少部署环境变量: ${missing[*]}" >&2
    echo "[backend] 请先执行 deploy/install.sh 生成 /etc/infoq-scaffold-ai/deploy.env，或显式设置这些变量" >&2
    exit 1
  fi
}

require_runtime_env() {
  require_env_vars \
    MYSQL_ROOT_PASSWORD \
    INFOQ_DB_USERNAME \
    INFOQ_DB_PASSWORD \
    REDIS_PASSWORD \
    MINIO_ROOT_USER \
    MINIO_ROOT_PASSWORD \
    INFOQ_PUBLIC_BASE_URL \
    SECURITY_TOKEN_SECRET
}

require_personalization_env() {
  require_env_vars INFOQ_ADMIN_USERNAME INFOQ_ADMIN_PASSWORD INFOQ_OSS_BUCKET
}

sql_escape() {
  printf '%s' "$1" | sed "s/\\\\/\\\\\\\\/g; s/'/''/g"
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
    echo "[backend] Docker 配置 ${docker_config_file} 引用了 ${helper_command}，但当前 PATH 中找不到该 helper" >&2
    echo "[backend] 使用 Colima 且不依赖 Docker Desktop 时，请清理 Docker config 中失效的 credsStore/credHelpers；一次性验证可临时设置 DOCKER_CONFIG 指向不包含该 helper 的配置目录，并设置 DOCKER_HOST 指向 Colima socket 后重试" >&2
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

  echo "[backend] 缺少 Docker Compose CLI: 需要 docker compose 或 docker-compose" >&2
  exit 1
}

compose() {
  resolve_compose_command
  INFOQ_DEPLOY_ROOT="${DEPLOY_ROOT}" \
    DEPLOY_ID="${DEPLOY_ID:-}" \
    MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-}" \
    INFOQ_DB_USERNAME="${INFOQ_DB_USERNAME:-}" \
    INFOQ_DB_PASSWORD="${INFOQ_DB_PASSWORD:-}" \
    REDIS_PASSWORD="${REDIS_PASSWORD:-}" \
    MINIO_ROOT_USER="${MINIO_ROOT_USER:-}" \
    MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-}" \
    INFOQ_PUBLIC_BASE_URL="${INFOQ_PUBLIC_BASE_URL:-}" \
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

prepare_dirs() {
  local dirs=(
    "${DEPLOY_ROOT}/mysql/data"
    "${DEPLOY_ROOT}/mysql/conf"
    "${DEPLOY_ROOT}/redis/conf"
    "${DEPLOY_ROOT}/redis/data"
    "${DEPLOY_ROOT}/minio/data"
    "${DEPLOY_ROOT}/server/config"
    "${DEPLOY_ROOT}/server/logs"
    "${DEPLOY_ROOT}/server/temp"
    "${DEPLOY_ROOT}/server/ip2region"
  )

  for dir in "${dirs[@]}"; do
    mkdir -p "${dir}"
    chmod 777 "${dir}" || true
  done

  require_env_vars REDIS_PASSWORD
  awk -v password="${REDIS_PASSWORD}" '{ gsub(/__REDIS_PASSWORD__/, password); print }' "${REDIS_CONF_SOURCE}" > "${DEPLOY_ROOT}/redis/conf/redis.conf"

  if [[ ! -f "${IP2REGION_V6_SOURCE}" ]]; then
    echo "[backend] 缺少 IPv6 地址库源文件: ${IP2REGION_V6_SOURCE}" >&2
    exit 1
  fi
  if [[ ! -f "${DEPLOY_ROOT}/server/ip2region/ip2region_v6.xdb" ]]; then
    cp -f "${IP2REGION_V6_SOURCE}" "${DEPLOY_ROOT}/server/ip2region/ip2region_v6.xdb"
    chmod 644 "${DEPLOY_ROOT}/server/ip2region/ip2region_v6.xdb" || true
    echo "[backend] 已同步 ${DEPLOY_ROOT}/server/ip2region/ip2region_v6.xdb"
  else
    echo "[backend] 保留现有 ${DEPLOY_ROOT}/server/ip2region/ip2region_v6.xdb"
  fi

  if [[ ! -f "${DEPLOY_ROOT}/server/config/application-prod.yml" ]]; then
    cp -f "${SERVER_CONFIG_TEMPLATE}" "${DEPLOY_ROOT}/server/config/application-prod.yml"
    echo "[backend] 已初始化 ${DEPLOY_ROOT}/server/config/application-prod.yml"
  elif grep -q "password: root\\|password: '123456'\\|username: root" "${DEPLOY_ROOT}/server/config/application-prod.yml"; then
    cp -f "${SERVER_CONFIG_TEMPLATE}" "${DEPLOY_ROOT}/server/config/application-prod.yml"
    echo "[backend] 已替换旧默认凭据配置 ${DEPLOY_ROOT}/server/config/application-prod.yml"
  else
    echo "[backend] 保留现有 ${DEPLOY_ROOT}/server/config/application-prod.yml"
  fi

  echo "[backend] 使用部署根目录: ${DEPLOY_ROOT}"
  echo "[backend] 目录和配置已同步完成"
}

backend_revision() {
  local revision
  revision="$(sed -n 's/.*<revision>\(.*\)<\/revision>.*/\1/p' "${BACKEND_DIR}/pom.xml" | head -n 1)"
  if [[ -z "${revision}" ]]; then
    revision="unknown"
  fi
  printf '%s' "${revision}"
}

generate_deploy_id() {
  printf '%s-%s' "$(backend_revision)" "$(date +%Y%m%d%H%M%S)"
}

validate_deploy_id() {
  if [[ -z "${DEPLOY_ID//[[:space:]]/}" ]]; then
    echo "[backend] DEPLOY_ID 不能为空。生产同一批 backend 节点必须使用同一个 DEPLOY_ID" >&2
    exit 1
  fi
}

persist_deploy_id() {
  local deploy_id_file="${DEPLOY_ROOT}/server/config/deploy-id"
  printf '%s\n' "${DEPLOY_ID}" > "${deploy_id_file}"
  echo "[backend] 当前部署批次 DEPLOY_ID=${DEPLOY_ID}"
}

load_existing_deploy_id() {
  local deploy_id_file="${DEPLOY_ROOT}/server/config/deploy-id"
  if [[ ! -f "${deploy_id_file}" ]]; then
    echo "[backend] 缺少 ${deploy_id_file}，请先执行 deploy 或显式设置 DEPLOY_ID" >&2
    exit 1
  fi
  IFS= read -r DEPLOY_ID < "${deploy_id_file}"
  validate_deploy_id
}

prepare_new_deploy_id() {
  if [[ -z "${DEPLOY_ID//[[:space:]]/}" ]]; then
    DEPLOY_ID="$(generate_deploy_id)"
  fi
  validate_deploy_id
  persist_deploy_id
}

prepare_existing_deploy_id() {
  if [[ -n "${DEPLOY_ID//[[:space:]]/}" ]]; then
    validate_deploy_id
    echo "[backend] 使用外部 DEPLOY_ID=${DEPLOY_ID}"
    return
  fi
  load_existing_deploy_id
  echo "[backend] 复用部署批次 DEPLOY_ID=${DEPLOY_ID}"
}

package_backend() {
  require_command mvn
  (
    cd "${BACKEND_DIR}"
    mvn clean package -P prod -pl infoq-admin -am
  )
}

build_image() {
  require_runtime_env
  validate_docker_credential_helpers
  resolve_compose_command
  compose build infoq-admin
}

wait_for_mysql() {
  local max_attempts=60
  local attempt=1

  echo "[backend] 等待 MySQL 就绪..."
  until compose exec -T mysql mysqladmin ping -h 127.0.0.1 -uroot -p"${MYSQL_ROOT_PASSWORD}" --silent >/dev/null 2>&1; do
    if (( attempt >= max_attempts )); then
      echo "[backend] MySQL 启动超时" >&2
      exit 1
    fi
    attempt=$((attempt + 1))
    sleep 2
  done
}

wait_for_redis() {
  local max_attempts=60
  local attempt=1

  echo "[backend] 等待 Redis 就绪..."
  until compose exec -T redis redis-cli -a "${REDIS_PASSWORD}" ping 2>/dev/null | grep -q '^PONG$'; do
    if (( attempt >= max_attempts )); then
      echo "[backend] Redis 启动超时" >&2
      exit 1
    fi
    attempt=$((attempt + 1))
    sleep 2
  done
}

mysql_query() {
  local sql="$1"
  compose exec -T mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -Nse "${sql}" 2>/dev/null | tr -d '\r'
}

mysql_exec_root() {
  local sql="$1"
  compose exec -T mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -e "${sql}"
}

mysql_exec_infoq_file() {
  local sql_file="$1"
  local label="$2"

  if [[ ! -f "${sql_file}" ]]; then
    echo "[backend] 缺少 SQL 文件: ${sql_file}" >&2
    exit 1
  fi

  echo "[backend] 导入 ${label}: ${sql_file##${REPO_ROOT}/}"
  compose exec -T mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" infoq < "${sql_file}"
}

discover_sql_update_files() {
  local files=()
  local file

  shopt -s nullglob
  for file in "${SQL_DIR}"/infoq_scaffold_update_*.sql; do
    files+=("${file}")
  done
  shopt -u nullglob

  if (( ${#files[@]} == 0 )); then
    echo "[backend] 未发现 SQL 增量脚本: ${SQL_DIR}/infoq_scaffold_update_*.sql" >&2
    exit 1
  fi

  printf '%s\n' "${files[@]}"
}

table_exists() {
  local table_name="$1"
  mysql_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='infoq' AND LOWER(table_name)=LOWER('${table_name}');"
}

column_count() {
  local table_name="$1"
  local column_list="$2"
  mysql_query "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='infoq' AND LOWER(table_name)=LOWER('${table_name}') AND column_name IN (${column_list});"
}

menu_count() {
  mysql_query "SELECT COUNT(*) FROM infoq.sys_menu WHERE menu_id IN (2026042910,2026042911,2026042920,2026042921);"
}

ensure_base_schema() {
  if [[ "$(table_exists sys_oss_config)" == "1" ]]; then
    return
  fi

  mysql_exec_infoq_file "${SQL_INIT_FILE}" "基础库"
}

ensure_scheduler_schema() {
  local job_table_exists
  local quartz_lock_exists

  job_table_exists="$(table_exists sys_job)"
  quartz_lock_exists="$(table_exists qrtz_locks)"

  if [[ "${job_table_exists}" == "1" && "${quartz_lock_exists}" == "1" ]]; then
    return
  fi

  mysql_exec_infoq_file "${SQL_DIR}/infoq_scaffold_update_20260425.sql" "定时任务与 Quartz 表"
}

ensure_monitor_menu_data() {
  if [[ "$(menu_count)" == "4" ]]; then
    return
  fi

  mysql_exec_infoq_file "${SQL_DIR}/infoq_scaffold_update_20260429.sql" "监控菜单数据"
}

ensure_config_metadata_columns() {
  local expected_count=6
  local actual_count
  local metadata_columns="'value_type','default_value','group_key','display_order','options_json','ui_props_json'"

  actual_count="$(column_count sys_config "${metadata_columns}")"
  if [[ "${actual_count}" == "${expected_count}" ]]; then
    return
  fi

  if [[ "${actual_count}" != "0" ]]; then
    echo "[backend] 检测到 sys_config 配置元数据列处于部分迁移状态，请人工检查后重试" >&2
    exit 1
  fi

  mysql_exec_infoq_file "${SQL_DIR}/infoq_scaffold_update_20260526.sql" "配置元数据列"
}

oauth_schema_ready() {
  local oauth_tables_count
  local oauth_dict_count
  local oauth_client_count

  oauth_tables_count="$(mysql_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='infoq' AND LOWER(table_name) IN ('sys_oauth_provider','sys_oauth_identity');")"
  oauth_dict_count="$(mysql_query "SELECT COUNT(*) FROM infoq.sys_dict_data WHERE dict_type='sys_grant_type' AND dict_value='oauth';")"
  oauth_client_count="$(mysql_query "SELECT COUNT(*) FROM infoq.sys_client WHERE client_id='e5cd7e4891bf95d1d19206ce24a7b32e' AND FIND_IN_SET('oauth', REPLACE(COALESCE(grant_type, ''), ' ', '')) > 0;")"

  [[ "${oauth_tables_count}" == "2" && "${oauth_dict_count}" == "1" && "${oauth_client_count}" == "1" ]]
}

ensure_oauth_schema() {
  if oauth_schema_ready; then
    return
  fi

  mysql_exec_infoq_file "${SQL_DIR}/infoq_scaffold_update_20260529.sql" "OAuth 登录表与授权类型"

  if ! oauth_schema_ready; then
    echo "[backend] OAuth 增量 SQL 校验失败，请检查 sys_oauth_provider、sys_oauth_identity、sys_grant_type=oauth 与 sys_client.grant_type" >&2
    exit 1
  fi
}

ensure_sql_update_applied() {
  local sql_file="$1"

  case "${sql_file##*/}" in
    infoq_scaffold_update_20260425.sql)
      ensure_scheduler_schema
      ;;
    infoq_scaffold_update_20260429.sql)
      ensure_monitor_menu_data
      ;;
    infoq_scaffold_update_20260526.sql)
      ensure_config_metadata_columns
      ;;
    infoq_scaffold_update_20260529.sql)
      ensure_oauth_schema
      ;;
    *)
      echo "[backend] 发现未接入校验逻辑的 SQL 增量脚本: ${sql_file##${REPO_ROOT}/}" >&2
      echo "[backend] 请先在 script/bin/infoq.sh 增加幂等执行和执行后校验规则，避免部分迁移状态" >&2
      exit 1
      ;;
  esac
}

ensure_sql_updates() {
  local sql_file

  while IFS= read -r sql_file; do
    ensure_sql_update_applied "${sql_file}"
  done < <(discover_sql_update_files)
}

validate_database_initialized() {
  local required_tables_count
  local monitor_menu_count
  local metadata_columns_count
  local oauth_tables_count
  local oauth_dict_count
  local oauth_client_count
  local metadata_columns="'value_type','default_value','group_key','display_order','options_json','ui_props_json'"

  required_tables_count="$(mysql_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='infoq' AND LOWER(table_name) IN ('sys_oss_config','sys_job','qrtz_locks','sys_oauth_provider','sys_oauth_identity');")"
  monitor_menu_count="$(menu_count)"
  metadata_columns_count="$(column_count sys_config "${metadata_columns}")"
  oauth_tables_count="$(mysql_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='infoq' AND LOWER(table_name) IN ('sys_oauth_provider','sys_oauth_identity');")"
  oauth_dict_count="$(mysql_query "SELECT COUNT(*) FROM infoq.sys_dict_data WHERE dict_type='sys_grant_type' AND dict_value='oauth';")"
  oauth_client_count="$(mysql_query "SELECT COUNT(*) FROM infoq.sys_client WHERE client_id='e5cd7e4891bf95d1d19206ce24a7b32e' AND FIND_IN_SET('oauth', REPLACE(COALESCE(grant_type, ''), ' ', '')) > 0;")"

  if [[ "${required_tables_count}" != "5" || "${monitor_menu_count}" != "4" || "${metadata_columns_count}" != "6" || "${oauth_tables_count}" != "2" || "${oauth_dict_count}" != "1" || "${oauth_client_count}" != "1" ]]; then
    echo "[backend] 数据库初始化校验失败: required_tables=${required_tables_count}, monitor_menus=${monitor_menu_count}, sys_config_metadata_columns=${metadata_columns_count}, oauth_tables=${oauth_tables_count}, oauth_dict=${oauth_dict_count}, oauth_client_grant=${oauth_client_count}" >&2
    exit 1
  fi
}

ensure_mysql_app_user() {
  local db_user
  local db_password

  db_user="$(sql_escape "${INFOQ_DB_USERNAME}")"
  db_password="$(sql_escape "${INFOQ_DB_PASSWORD}")"
  mysql_exec_root "CREATE USER IF NOT EXISTS '${db_user}'@'%' IDENTIFIED BY '${db_password}'; ALTER USER '${db_user}'@'%' IDENTIFIED BY '${db_password}'; GRANT ALL PRIVILEGES ON infoq.* TO '${db_user}'@'%'; FLUSH PRIVILEGES;"
  echo "[backend] MySQL 应用账号已同步: ${INFOQ_DB_USERNAME}"
}

public_base_url() {
  printf '%s' "${INFOQ_PUBLIC_BASE_URL%/}"
}

public_base_is_https() {
  if [[ "$(public_base_url)" == https://* ]]; then
    printf 'Y'
  else
    printf 'N'
  fi
}

sync_oss_config() {
  local access_key
  local secret_key
  local bucket_name
  local endpoint
  local domain
  local is_https
  local reset_oss="${INFOQ_RESET_OSS:-0}"
  local custom_count
  local update_filter
  local synced_count
  local minio_active_count

  access_key="$(sql_escape "${MINIO_ROOT_USER}")"
  secret_key="$(sql_escape "${MINIO_ROOT_PASSWORD}")"
  bucket_name="$(sql_escape "${INFOQ_OSS_BUCKET}")"
  endpoint="minio:9000"
  domain="$(sql_escape "$(public_base_url)/oss")"
  is_https="$(public_base_is_https)"

  custom_count="$(mysql_query "SELECT COUNT(*) FROM infoq.sys_oss_config WHERE config_key IN ('minio','image') AND NOT ((access_key='infoq' AND secret_key='infoq123') OR (access_key='${access_key}' AND secret_key='${secret_key}' AND bucket_name='${bucket_name}' AND endpoint='${endpoint}' AND domain='${domain}' AND is_https='${is_https}'));")"
  if [[ "${custom_count}" != "0" && "${reset_oss}" != "1" ]]; then
    echo "[backend] 检测到 sys_oss_config 中 minio/image 已有非默认配置，未设置 INFOQ_RESET_OSS=1，停止覆盖" >&2
    exit 1
  fi

  if [[ "${reset_oss}" == "1" ]]; then
    update_filter="config_key IN ('minio','image')"
  else
    update_filter="config_key IN ('minio','image') AND ((access_key='infoq' AND secret_key='infoq123') OR access_key='${access_key}')"
  fi

  mysql_exec_root "UPDATE infoq.sys_oss_config SET access_key='${access_key}', secret_key='${secret_key}', bucket_name='${bucket_name}', endpoint='${endpoint}', domain='${domain}', is_https='${is_https}', status=CASE WHEN config_key='minio' THEN '0' ELSE status END, update_by=-1, update_time=now() WHERE ${update_filter};"
  synced_count="$(mysql_query "SELECT COUNT(*) FROM infoq.sys_oss_config WHERE config_key IN ('minio','image') AND access_key='${access_key}' AND secret_key='${secret_key}' AND bucket_name='${bucket_name}' AND endpoint='${endpoint}' AND domain='${domain}' AND is_https='${is_https}';")"
  minio_active_count="$(mysql_query "SELECT COUNT(*) FROM infoq.sys_oss_config WHERE config_key='minio' AND status='0';")"
  if [[ "${synced_count}" != "2" || "${minio_active_count}" != "1" ]]; then
    echo "[backend] OSS 配置同步校验失败: synced=${synced_count}, minio_active=${minio_active_count}" >&2
    exit 1
  fi
  echo "[backend] OSS 配置已同步: domain=$(public_base_url)/oss, bucket=${INFOQ_OSS_BUCKET}"
}

hash_admin_password() {
  require_command java
  if [[ ! -f "${ADMIN_JAR}" ]]; then
    echo "[backend] 缺少后端 Jar，无法生成管理员 BCrypt 密码: ${ADMIN_JAR}" >&2
    exit 1
  fi
  printf '%s' "${INFOQ_ADMIN_PASSWORD}" | java -jar "${ADMIN_JAR}" --infoq-bcrypt-hash-stdin
}

sync_admin_credentials() {
  local reset_admin="${INFOQ_RESET_ADMIN:-0}"
  local current_user
  local duplicate_count
  local admin_user
  local admin_hash
  local synced_count

  current_user="$(mysql_query "SELECT user_name FROM infoq.sys_user WHERE user_id=1 AND del_flag='0';")"
  if [[ -z "${current_user}" ]]; then
    echo "[backend] 未找到可更新的默认管理员记录: sys_user.user_id=1" >&2
    exit 1
  fi

  if [[ "${current_user}" == "${INFOQ_ADMIN_USERNAME}" && "${reset_admin}" != "1" ]]; then
    echo "[backend] 默认管理员账号已是部署凭据账号: ${INFOQ_ADMIN_USERNAME}"
    return
  fi

  if [[ "${current_user}" != "admin" && "${current_user}" != "${INFOQ_ADMIN_USERNAME}" && "${reset_admin}" != "1" ]]; then
    echo "[backend] 默认管理员账号已被修改为 ${current_user}，未设置 INFOQ_RESET_ADMIN=1，停止覆盖" >&2
    exit 1
  fi

  admin_user="$(sql_escape "${INFOQ_ADMIN_USERNAME}")"
  duplicate_count="$(mysql_query "SELECT COUNT(*) FROM infoq.sys_user WHERE user_name='${admin_user}' AND user_id<>1 AND del_flag='0';")"
  if [[ "${duplicate_count}" != "0" ]]; then
    echo "[backend] 管理员随机账号已被其他用户占用: ${INFOQ_ADMIN_USERNAME}" >&2
    exit 1
  fi

  admin_hash="$(sql_escape "$(hash_admin_password)")"
  mysql_exec_root "UPDATE infoq.sys_user SET user_name='${admin_user}', nick_name='系统管理员', password='${admin_hash}', update_by=-1, update_time=now() WHERE user_id=1 AND del_flag='0';"
  synced_count="$(mysql_query "SELECT COUNT(*) FROM infoq.sys_user WHERE user_id=1 AND del_flag='0' AND user_name='${admin_user}' AND password='${admin_hash}';")"
  if [[ "${synced_count}" != "1" ]]; then
    echo "[backend] 默认管理员账号同步校验失败: ${INFOQ_ADMIN_USERNAME}" >&2
    exit 1
  fi
  echo "[backend] 默认管理员账号已同步: ${INFOQ_ADMIN_USERNAME}"
}

ensure_minio_bucket() {
  local max_attempts=60
  local attempt=1

  require_command docker
  validate_docker_credential_helpers
  echo "[backend] 等待 MinIO 就绪并确认 bucket..."
  until docker run --rm --network container:minio --entrypoint /bin/sh minio/mc:latest -c 'mc alias set local "$1" "$2" "$3" >/dev/null && mc mb --ignore-existing "local/$4" >/dev/null && mc anonymous set download "local/$4" >/dev/null' sh "http://127.0.0.1:9000" "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" "${INFOQ_OSS_BUCKET}"; do
    if (( attempt >= max_attempts )); then
      echo "[backend] MinIO bucket 初始化超时" >&2
      exit 1
    fi
    attempt=$((attempt + 1))
    sleep 2
  done
  echo "[backend] MinIO bucket 已确认: ${INFOQ_OSS_BUCKET}"
}

ensure_database_initialized() {
  if [[ ! -f "${SQL_INIT_FILE}" ]]; then
    echo "[backend] 缺少 SQL 初始化文件: ${SQL_INIT_FILE}" >&2
    exit 1
  fi

  mysql_exec_root "CREATE DATABASE IF NOT EXISTS infoq CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;"
  ensure_base_schema
  ensure_sql_updates
  validate_database_initialized
  echo "[backend] 数据库初始化和增量 SQL 校验完成"
}

start_dependencies() {
  require_runtime_env
  compose up -d mysql redis minio
  wait_for_mysql
  wait_for_redis
  ensure_database_initialized
  ensure_mysql_app_user
  sync_oss_config
  ensure_minio_bucket
}

deploy_backend() {
  require_runtime_env
  require_personalization_env
  validate_docker_credential_helpers
  resolve_compose_command
  prepare_dirs
  prepare_new_deploy_id
  package_backend
  start_dependencies
  sync_admin_credentials
  compose up -d --build infoq-admin
  echo "[backend] 部署完成，访问端口: 9090"
}

start_backend() {
  resolve_compose_command
  prepare_dirs
  prepare_existing_deploy_id
  start_dependencies
  compose start infoq-admin
  echo "[backend] 服务已启动，访问端口: 9090"
}

stop_backend() {
  require_runtime_env
  resolve_compose_command
  compose stop "${BACKEND_SERVICES[@]}"
}

restart_backend() {
  require_runtime_env
  resolve_compose_command
  prepare_existing_deploy_id
  compose restart infoq-admin
}

status_backend() {
  require_runtime_env
  resolve_compose_command
  compose ps "${BACKEND_SERVICES[@]}"
}

show_logs() {
  require_runtime_env
  resolve_compose_command
  local service="${1:-infoq-admin}"
  compose logs -f "${service}"
}

load_deploy_env

case "${1:-}" in
  prepare)
    resolve_deploy_root
    prepare_dirs
    ;;
  package)
    package_backend
    ;;
  build-image)
    resolve_deploy_root
    build_image
    ;;
  deploy)
    resolve_deploy_root
    deploy_backend
    ;;
  start)
    resolve_deploy_root
    start_backend
    ;;
  stop)
    resolve_deploy_root
    stop_backend
    ;;
  restart)
    resolve_deploy_root
    restart_backend
    ;;
  status)
    resolve_deploy_root
    status_backend
    ;;
  logs)
    resolve_deploy_root
    show_logs "${2:-infoq-admin}"
    ;;
  *)
    usage
    exit 1
    ;;
esac
