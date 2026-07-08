#!/usr/bin/env bash
set -euo pipefail

INFOQ_REPO_URL="${INFOQ_REPO_URL:-https://github.com/LuckyKuang/infoq-scaffold-ai}"
INFOQ_VERSION="${INFOQ_VERSION:-main}"
INFOQ_INSTALL_DIR="${INFOQ_INSTALL_DIR:-/opt/infoq-scaffold-ai}"
INFOQ_CONFIG_DIR="${INFOQ_CONFIG_DIR:-/etc/infoq-scaffold-ai}"
INFOQ_DEPLOY_ROOT="${INFOQ_DEPLOY_ROOT:-/infoq}"
INFOQ_OSS_BUCKET="${INFOQ_OSS_BUCKET:-infoq}"
INFOQ_PRINT_SECRETS="${INFOQ_PRINT_SECRETS:-1}"
INFOQ_RESET_ADMIN="${INFOQ_RESET_ADMIN:-0}"
INFOQ_RESET_OSS="${INFOQ_RESET_OSS:-0}"
INFOQ_INSTALL_DOCKER="${INFOQ_INSTALL_DOCKER:-0}"
INFOQ_ALLOW_NON_ROOT="${INFOQ_ALLOW_NON_ROOT:-0}"
INFOQ_ENV_FILE="${INFOQ_ENV_FILE:-${INFOQ_CONFIG_DIR}/deploy.env}"
INFOQ_CREDENTIALS_FILE="${INFOQ_CREDENTIALS_FILE:-${INFOQ_CONFIG_DIR}/credentials.txt}"
SOURCE_DIR=""

log() {
  printf '[install] %s\n' "$*"
}

fail() {
  printf '[install] %s\n' "$*" >&2
  exit 1
}

require_root() {
  if [[ "$(id -u)" == "0" ]]; then
    return
  fi

  if [[ "${INFOQ_ALLOW_NON_ROOT}" != "1" ]]; then
    fail "请使用 root 权限执行，例如 curl ... | sudo bash"
  fi

  if [[ "${INFOQ_INSTALL_DIR}" == "/opt/infoq-scaffold-ai" || "${INFOQ_CONFIG_DIR}" == "/etc/infoq-scaffold-ai" || "${INFOQ_DEPLOY_ROOT}" == "/infoq" ]]; then
    fail "INFOQ_ALLOW_NON_ROOT=1 仅用于本地验证，必须显式设置非默认 INFOQ_INSTALL_DIR、INFOQ_CONFIG_DIR 和 INFOQ_DEPLOY_ROOT"
  fi
  log "INFOQ_ALLOW_NON_ROOT=1，本地验证模式将使用当前用户可写目录；生产安装仍应使用 sudo/root"
}

require_command() {
  local name="$1"
  if ! command -v "${name}" >/dev/null 2>&1; then
    fail "缺少命令: ${name}"
  fi
}

require_runtime() {
  require_command curl
  require_command tar
  require_command openssl
  require_command docker

  if ! docker compose version >/dev/null 2>&1 && ! command -v docker-compose >/dev/null 2>&1; then
    fail "缺少 Docker Compose CLI: 需要 docker compose 或 docker-compose"
  fi

  if [[ "${INFOQ_INSTALL_DOCKER}" == "1" ]]; then
    log "INFOQ_INSTALL_DOCKER=1 已设置，但当前版本只执行 Docker 检测，不静默安装系统依赖"
  fi
}

random_chars() {
  local count="$1"
  local charset="$2"
  local value
  value="$(LC_ALL=C tr -dc "${charset}" < /dev/urandom | head -c "${count}" || true)"
  if [[ "${#value}" != "${count}" ]]; then
    fail "随机值生成失败"
  fi
  printf '%s' "${value}"
}

random_alnum() {
  random_chars "$1" 'A-Za-z0-9'
}

random_lower_alnum() {
  random_chars "$1" 'a-z0-9'
}

generate_admin_password() {
  printf 'A%s1@%s' "$(random_lower_alnum 8)" "$(random_alnum 8)"
}

detect_public_base_url() {
  if [[ -n "${INFOQ_PUBLIC_BASE_URL:-}" ]]; then
    INFOQ_PUBLIC_BASE_URL="${INFOQ_PUBLIC_BASE_URL%/}"
    return
  fi

  local first_ip
  first_ip="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  if [[ -z "${first_ip}" ]]; then
    first_ip="127.0.0.1"
  fi
  INFOQ_PUBLIC_BASE_URL="http://${first_ip}"
  log "未显式设置 INFOQ_PUBLIC_BASE_URL，使用探测值: ${INFOQ_PUBLIC_BASE_URL}"
}

write_env_line() {
  local name="$1"
  local value="$2"
  local escaped
  escaped="$(printf '%s' "${value}" | sed "s/'/'\\\\''/g")"
  printf "%s='%s'\n" "${name}" "${escaped}"
}

secure_private_file() {
  local file="$1"
  if [[ "$(id -u)" == "0" ]]; then
    chown 0:0 "${file}"
  fi
  chmod 600 "${file}"
}

write_credentials() {
  (
    umask 077
    {
      printf 'InfoQ Scaffold credentials\n\n'
      printf 'URLs:\n'
      printf '  Vue Admin:       %s/vue/\n' "${INFOQ_PUBLIC_BASE_URL}"
      printf '  React Admin:     %s/react/\n' "${INFOQ_PUBLIC_BASE_URL}"
      printf '  React Pro Admin: %s/react-pro/\n' "${INFOQ_PUBLIC_BASE_URL}"
      printf '  Backend Health:  %s/prod-api/monitor/health/readiness\n' "${INFOQ_PUBLIC_BASE_URL}"
      printf '  MinIO Console:   %s/console-oss/\n' "${INFOQ_PUBLIC_BASE_URL}"
      printf '  MinIO OSS:       %s/oss/\n\n' "${INFOQ_PUBLIC_BASE_URL}"
      printf 'Generated credentials:\n'
      printf '  Admin username:      %s\n' "${INFOQ_ADMIN_USERNAME}"
      printf '  Admin password:      %s\n\n' "${INFOQ_ADMIN_PASSWORD}"
      printf '  MySQL root user:     root\n'
      printf '  MySQL root password: %s\n' "${MYSQL_ROOT_PASSWORD}"
      printf '  MySQL app user:      %s\n' "${INFOQ_DB_USERNAME}"
      printf '  MySQL app password:  %s\n\n' "${INFOQ_DB_PASSWORD}"
      printf '  Redis password:      %s\n\n' "${REDIS_PASSWORD}"
      printf '  MinIO root user:     %s\n' "${MINIO_ROOT_USER}"
      printf '  MinIO root password: %s\n' "${MINIO_ROOT_PASSWORD}"
    } > "${INFOQ_CREDENTIALS_FILE}"
  )
  secure_private_file "${INFOQ_CREDENTIALS_FILE}"
}

write_env_file() {
  (
    umask 077
    {
      write_env_line INFOQ_VERSION "${INFOQ_VERSION}"
      write_env_line INFOQ_PUBLIC_BASE_URL "${INFOQ_PUBLIC_BASE_URL}"
      write_env_line INFOQ_DEPLOY_ROOT "${INFOQ_DEPLOY_ROOT}"
      write_env_line MYSQL_ROOT_PASSWORD "${MYSQL_ROOT_PASSWORD}"
      write_env_line INFOQ_DB_USERNAME "${INFOQ_DB_USERNAME}"
      write_env_line INFOQ_DB_PASSWORD "${INFOQ_DB_PASSWORD}"
      write_env_line REDIS_PASSWORD "${REDIS_PASSWORD}"
      write_env_line MINIO_ROOT_USER "${MINIO_ROOT_USER}"
      write_env_line MINIO_ROOT_PASSWORD "${MINIO_ROOT_PASSWORD}"
      write_env_line INFOQ_OSS_BUCKET "${INFOQ_OSS_BUCKET}"
      write_env_line SECURITY_TOKEN_SECRET "${SECURITY_TOKEN_SECRET}"
      write_env_line DEPLOY_ID "${DEPLOY_ID}"
      write_env_line INFOQ_ADMIN_USERNAME "${INFOQ_ADMIN_USERNAME}"
      write_env_line INFOQ_ADMIN_PASSWORD "${INFOQ_ADMIN_PASSWORD}"
    } > "${INFOQ_ENV_FILE}"
  )
  secure_private_file "${INFOQ_ENV_FILE}"
}

generate_env_file() {
  local revision="unknown"

  if [[ -f "${SOURCE_DIR}/infoq-scaffold-backend/pom.xml" ]]; then
    revision="$(sed -n 's/.*<revision>\(.*\)<\/revision>.*/\1/p' "${SOURCE_DIR}/infoq-scaffold-backend/pom.xml" | head -n 1)"
    revision="${revision:-unknown}"
  fi

  MYSQL_ROOT_PASSWORD="$(random_alnum 32)"
  INFOQ_DB_USERNAME="infoq_app_$(random_lower_alnum 12)"
  INFOQ_DB_PASSWORD="$(random_alnum 32)"
  REDIS_PASSWORD="$(random_alnum 32)"
  MINIO_ROOT_USER="minio_$(random_lower_alnum 12)"
  MINIO_ROOT_PASSWORD="$(random_alnum 32)"
  SECURITY_TOKEN_SECRET="$(openssl rand -hex 32)"
  DEPLOY_ID="${revision}-$(date +%Y%m%d%H%M%S)-$(random_lower_alnum 8)"
  INFOQ_ADMIN_USERNAME="admin_$(random_lower_alnum 12)"
  INFOQ_ADMIN_PASSWORD="$(generate_admin_password)"

  write_env_file
  write_credentials
}

load_env_file() {
  set -a
  # shellcheck disable=SC1090
  . "${INFOQ_ENV_FILE}"
  set +a
}

require_env_values() {
  local missing=()
  local name

  for name in "$@"; do
    if [[ -z "${!name:-}" ]]; then
      missing+=("${name}")
    fi
  done

  if (( ${#missing[@]} > 0 )); then
    fail "环境文件 ${INFOQ_ENV_FILE} 缺少必需变量: ${missing[*]}"
  fi
}

data_dir_has_content() {
  local first_entry
  [[ -d "${INFOQ_DEPLOY_ROOT}/mysql/data" ]] || return 1
  first_entry="$(find "${INFOQ_DEPLOY_ROOT}/mysql/data" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)"
  [[ -n "${first_entry}" ]]
}

prepare_directories() {
  mkdir -p "${INFOQ_INSTALL_DIR}" "${INFOQ_CONFIG_DIR}" "${INFOQ_DEPLOY_ROOT}"
  chmod 700 "${INFOQ_CONFIG_DIR}"
}

resolve_local_source() {
  local script_path="${BASH_SOURCE[0]:-}"
  local candidate

  if [[ -n "${INFOQ_SOURCE_DIR:-}" ]]; then
    SOURCE_DIR="${INFOQ_SOURCE_DIR}"
    return
  fi

  if [[ -n "${script_path}" && -f "${script_path}" ]]; then
    candidate="$(cd "$(dirname "${script_path}")/.." && pwd)"
    if [[ -f "${candidate}/script/bin/infoq.sh" && -f "${candidate}/script/docker/docker-compose.yml" ]]; then
      SOURCE_DIR="${candidate}"
      return
    fi
  fi
}

download_source() {
  local archive_url
  local tmp_dir="${INFOQ_INSTALL_DIR}/source.tmp"

  if [[ -n "${SOURCE_DIR}" ]]; then
    log "使用本地源码目录: ${SOURCE_DIR}"
    return
  fi

  if [[ "${INFOQ_VERSION}" == "main" || "${INFOQ_VERSION}" == "master" ]]; then
    archive_url="${INFOQ_REPO_URL}/archive/refs/heads/${INFOQ_VERSION}.tar.gz"
  else
    archive_url="${INFOQ_REPO_URL}/archive/refs/tags/${INFOQ_VERSION}.tar.gz"
  fi

  log "下载源码: ${archive_url}"
  rm -rf "${tmp_dir}"
  mkdir -p "${tmp_dir}"
  curl -fsSL "${archive_url}" | tar -xz --strip-components=1 -C "${tmp_dir}"
  rm -rf "${INFOQ_INSTALL_DIR}/source"
  mv "${tmp_dir}" "${INFOQ_INSTALL_DIR}/source"
  SOURCE_DIR="${INFOQ_INSTALL_DIR}/source"
}

reset_admin_credentials() {
  INFOQ_ADMIN_USERNAME="admin_$(random_lower_alnum 12)"
  INFOQ_ADMIN_PASSWORD="$(generate_admin_password)"
  write_env_file
  write_credentials
}

prepare_credentials() {
  if [[ -f "${INFOQ_ENV_FILE}" ]]; then
    log "复用已有环境文件: ${INFOQ_ENV_FILE}"
    secure_private_file "${INFOQ_ENV_FILE}"
    load_env_file
    require_env_values INFOQ_VERSION INFOQ_PUBLIC_BASE_URL INFOQ_DEPLOY_ROOT MYSQL_ROOT_PASSWORD INFOQ_DB_USERNAME INFOQ_DB_PASSWORD REDIS_PASSWORD MINIO_ROOT_USER MINIO_ROOT_PASSWORD INFOQ_OSS_BUCKET SECURITY_TOKEN_SECRET DEPLOY_ID
    if [[ "${INFOQ_RESET_ADMIN}" == "1" ]]; then
      log "INFOQ_RESET_ADMIN=1，重新生成默认管理员凭据"
      reset_admin_credentials
      load_env_file
      return
    fi
    require_env_values INFOQ_ADMIN_USERNAME INFOQ_ADMIN_PASSWORD
    if [[ ! -f "${INFOQ_CREDENTIALS_FILE}" ]]; then
      log "凭据留存文件缺失，按环境文件重建: ${INFOQ_CREDENTIALS_FILE}"
      write_credentials
    else
      secure_private_file "${INFOQ_CREDENTIALS_FILE}"
    fi
    return
  fi

  if data_dir_has_content; then
    fail "检测到已有数据目录 ${INFOQ_DEPLOY_ROOT}/mysql/data，但缺少 ${INFOQ_ENV_FILE}，为避免密码错配，停止安装"
  fi

  log "首次安装，生成随机部署凭据"
  generate_env_file
  load_env_file
}

print_summary() {
  printf '\n============================================================\n'
  printf 'InfoQ Scaffold deployed successfully\n\n'
  printf 'URLs:\n'
  printf '  Vue Admin:       %s/vue/\n' "${INFOQ_PUBLIC_BASE_URL}"
  printf '  React Admin:     %s/react/\n' "${INFOQ_PUBLIC_BASE_URL}"
  printf '  React Pro Admin: %s/react-pro/\n' "${INFOQ_PUBLIC_BASE_URL}"
  printf '  Backend Health:  %s/prod-api/monitor/health/readiness\n' "${INFOQ_PUBLIC_BASE_URL}"
  printf '  MinIO Console:   %s/console-oss/\n' "${INFOQ_PUBLIC_BASE_URL}"
  printf '  MinIO OSS:       %s/oss/\n\n' "${INFOQ_PUBLIC_BASE_URL}"

  if [[ "${INFOQ_PRINT_SECRETS}" == "0" ]]; then
    printf 'Credentials saved to %s\n' "${INFOQ_CREDENTIALS_FILE}"
  else
    sed -n '/Generated credentials:/,$p' "${INFOQ_CREDENTIALS_FILE}"
  fi

  printf '\nConfig files:\n'
  printf '  Environment file:    %s\n' "${INFOQ_ENV_FILE}"
  printf '  Credentials file:    %s\n' "${INFOQ_CREDENTIALS_FILE}"
  printf '\nImportant:\n'
  printf '  These credentials were synchronized to runtime config and database.\n'
  printf '  Keep this output private.\n'
  printf '============================================================\n'
}

main() {
  require_root
  require_runtime
  detect_public_base_url
  prepare_directories
  resolve_local_source
  download_source
  prepare_credentials

  log "启动后端与依赖服务"
  (cd "${SOURCE_DIR}" && INFOQ_ENV_FILE="${INFOQ_ENV_FILE}" INFOQ_RESET_ADMIN="${INFOQ_RESET_ADMIN}" INFOQ_RESET_OSS="${INFOQ_RESET_OSS}" bash script/bin/infoq.sh deploy)
  log "启动前端与 nginx"
  (cd "${SOURCE_DIR}" && INFOQ_ENV_FILE="${INFOQ_ENV_FILE}" bash script/bin/deploy-frontend.sh deploy)
  print_summary
}

main "$@"
