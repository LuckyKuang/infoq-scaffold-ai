#!/usr/bin/env bash
set -euo pipefail

INFOQ_REPO_URL="${INFOQ_REPO_URL:-https://github.com/LuckyKuang/infoq-scaffold-ai}"
INFOQ_VERSION="${INFOQ_VERSION:-main}"
INFOQ_INSTALL_DIR="${INFOQ_INSTALL_DIR:-/opt/infoq-scaffold-ai}"
INFOQ_CONFIG_DIR="${INFOQ_CONFIG_DIR:-/etc/infoq-scaffold-ai}"
INFOQ_DEPLOY_ROOT="${INFOQ_DEPLOY_ROOT:-/infoq}"
INFOQ_OSS_BUCKET="${INFOQ_OSS_BUCKET:-infoq}"
INFOQ_PRINT_SECRETS="${INFOQ_PRINT_SECRETS:-0}"
INFOQ_RESET_ADMIN="${INFOQ_RESET_ADMIN:-0}"
INFOQ_RESET_OSS="${INFOQ_RESET_OSS:-0}"
INFOQ_INSTALL_DOCKER="${INFOQ_INSTALL_DOCKER:-0}"
INFOQ_ALLOW_NON_ROOT="${INFOQ_ALLOW_NON_ROOT:-0}"
INFOQ_ENV_FILE="${INFOQ_ENV_FILE:-${INFOQ_CONFIG_DIR}/deploy.env}"
INFOQ_CREDENTIALS_FILE="${INFOQ_CREDENTIALS_FILE:-${INFOQ_CONFIG_DIR}/credentials.txt}"
INFOQ_FRONTEND_TARGET="${INFOQ_FRONTEND_TARGET:-}"
INFOQ_DEPLOY_MODE="${INFOQ_DEPLOY_MODE:-production}"
REQUESTED_FRONTEND_TARGET=""
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
  require_command node

  if ! docker compose version >/dev/null 2>&1 && ! command -v docker-compose >/dev/null 2>&1; then
    fail "缺少 Docker Compose CLI: 需要 docker compose 或 docker-compose"
  fi

  if ! docker buildx version >/dev/null 2>&1; then
    fail "缺少 Docker Buildx: 后端 Dockerfile 使用 BuildKit RUN --mount，请先安装 docker buildx 插件后再执行安装"
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

  if [[ "${INFOQ_DEPLOY_MODE}" == "production" ]]; then
    fail "生产安装必须在受控环境文件提供 INFOQ_PUBLIC_BASE_URL=https://...，禁止自动探测 HTTP 地址"
  fi

  local first_ip
  first_ip="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  if [[ -z "${first_ip}" ]]; then
    first_ip="127.0.0.1"
  fi
  INFOQ_PUBLIC_BASE_URL="http://${first_ip}"
  log "未显式设置 INFOQ_PUBLIC_BASE_URL，使用探测值: ${INFOQ_PUBLIC_BASE_URL}"
}

normalize_frontend_target() {
  case "$1" in
    1|react)
      printf 'react'
      ;;
    2|vue)
      printf 'vue'
      ;;
    3|all)
      printf 'all'
      ;;
    *)
      fail "无效前端安装目标: $1，请使用 1|2|3 或 react|vue|all"
      ;;
  esac
}

prompt_frontend_target() {
  local choice

  if [[ ! -r /dev/tty || ! -w /dev/tty ]]; then
    fail "非交互环境必须显式设置 INFOQ_FRONTEND_TARGET=react|vue|all"
  fi

  while true; do
    {
      printf '\n请选择前端安装模式：\n'
      printf '  1. 只安装 React 前端\n'
      printf '  2. 只安装 Vue 前端\n'
      printf '  3. 安装全部前端\n'
      printf '请输入 1-3: '
    } >/dev/tty
    IFS= read -r choice </dev/tty || fail "读取前端安装模式失败"
    case "${choice}" in
      1|2|3)
        normalize_frontend_target "${choice}"
        return
        ;;
      *)
        printf '无效选择，请输入 1、2 或 3。\n' >/dev/tty
        ;;
    esac
  done
}

select_frontend_target() {
  if [[ -n "${INFOQ_FRONTEND_TARGET}" ]]; then
    INFOQ_FRONTEND_TARGET="$(normalize_frontend_target "${INFOQ_FRONTEND_TARGET}")"
  else
    INFOQ_FRONTEND_TARGET="$(prompt_frontend_target)"
  fi
  REQUESTED_FRONTEND_TARGET="${INFOQ_FRONTEND_TARGET}"
  log "前端安装目标: ${INFOQ_FRONTEND_TARGET}"
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

print_frontend_urls() {
  case "${INFOQ_FRONTEND_TARGET}" in
    all)
      printf '  Vue Admin:       %s%s\n' "${INFOQ_PUBLIC_BASE_URL}" "${INFOQ_VUE_CONTEXT_PATH:-/vue/}"
      printf '  React Admin:     %s%s\n' "${INFOQ_PUBLIC_BASE_URL}" "${INFOQ_REACT_CONTEXT_PATH:-/react/}"
      ;;
    react)
      printf '  React Admin:     %s/\n' "${INFOQ_PUBLIC_BASE_URL}"
      ;;
    vue)
      printf '  Vue Admin:       %s/\n' "${INFOQ_PUBLIC_BASE_URL}"
      ;;
    *)
      fail "无效前端安装目标: ${INFOQ_FRONTEND_TARGET}"
      ;;
  esac
}

write_credentials() {
  (
    umask 077
    {
      printf 'InfoQ Scaffold credentials\n\n'
      printf 'URLs:\n'
      print_frontend_urls
      printf '  Backend Health:  %s/prod-api/monitor/health/readiness\n' "${INFOQ_PUBLIC_BASE_URL}"
      printf '  MinIO Console:   %s/console-oss/\n' "${INFOQ_PUBLIC_BASE_URL}"
      printf '  MinIO OSS:       %s/\n\n' "${INFOQ_OSS_PUBLIC_ORIGIN}"
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
      write_env_line INFOQ_FRONTEND_TARGET "${INFOQ_FRONTEND_TARGET}"
      write_env_line MYSQL_ROOT_PASSWORD "${MYSQL_ROOT_PASSWORD}"
      write_env_line INFOQ_DB_USERNAME "${INFOQ_DB_USERNAME}"
      write_env_line INFOQ_DB_PASSWORD "${INFOQ_DB_PASSWORD}"
      write_env_line REDIS_PASSWORD "${REDIS_PASSWORD}"
      write_env_line MINIO_ROOT_USER "${MINIO_ROOT_USER}"
      write_env_line MINIO_ROOT_PASSWORD "${MINIO_ROOT_PASSWORD}"
      write_env_line INFOQ_MINIO_IMAGE_USER "${INFOQ_MINIO_IMAGE_USER:-}"
      write_env_line INFOQ_OSS_BUCKET "${INFOQ_OSS_BUCKET}"
      write_env_line SECURITY_TOKEN_SECRET "${SECURITY_TOKEN_SECRET}"
      write_env_line DEPLOY_ID "${DEPLOY_ID}"
      write_env_line INFOQ_ADMIN_USERNAME "${INFOQ_ADMIN_USERNAME}"
      write_env_line INFOQ_ADMIN_PASSWORD "${INFOQ_ADMIN_PASSWORD}"
      write_env_line INFOQ_DEPLOY_MODE "${INFOQ_DEPLOY_MODE}"
      write_env_line INFOQ_CONFIG_SOURCE "${INFOQ_CONFIG_SOURCE:-isolated-test}"
      write_env_line INFOQ_PRODUCTION_CONFIG_FILE "${INFOQ_PRODUCTION_CONFIG_FILE:-${INFOQ_ENV_FILE}}"
      write_env_line INFOQ_OSS_PUBLIC_ORIGIN "${INFOQ_OSS_PUBLIC_ORIGIN:-http://oss.localhost}"
      write_env_line INFOQ_TLS_CERT_FILE "${INFOQ_TLS_CERT_FILE:-}"
      write_env_line INFOQ_TLS_KEY_FILE "${INFOQ_TLS_KEY_FILE:-}"
      write_env_line INFOQ_INTERNAL_BIND_HOST "${INFOQ_INTERNAL_BIND_HOST:-127.0.0.1}"
      write_env_line INFOQ_REACT_CONTEXT_PATH "${INFOQ_REACT_CONTEXT_PATH:-/react/}"
      write_env_line INFOQ_VUE_CONTEXT_PATH "${INFOQ_VUE_CONTEXT_PATH:-/vue/}"
      write_env_line VITE_APP_ENCRYPT true
      write_env_line VITE_APP_RSA_PUBLIC_KEY "${VITE_APP_RSA_PUBLIC_KEY}"
      write_env_line VITE_APP_RSA_PRIVATE_KEY "${VITE_APP_RSA_PRIVATE_KEY}"
      write_env_line INFOQ_API_REQUEST_PRIVATE_KEY "${INFOQ_API_REQUEST_PRIVATE_KEY}"
      write_env_line INFOQ_API_RESPONSE_PUBLIC_KEY "${INFOQ_API_RESPONSE_PUBLIC_KEY}"
    } > "${INFOQ_ENV_FILE}"
  )
  secure_private_file "${INFOQ_ENV_FILE}"
}

generate_env_file() {
  local revision="unknown"

  if [[ -f "${SOURCE_DIR}/backend/pom.xml" ]]; then
    revision="$(sed -n 's/.*<revision>\(.*\)<\/revision>.*/\1/p' "${SOURCE_DIR}/backend/pom.xml" | head -n 1)"
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
  INFOQ_CONFIG_SOURCE=isolated-test
  generate_rsa_config

  write_env_file
  write_credentials
}

load_env_file() {
  local name value complete=false source_env_file="${INFOQ_ENV_FILE}"
  # 配置作为数据读取，不执行环境文件中的 shell 表达式。
  node "${SOURCE_DIR}/tools/production_config.mjs" check --scope deploy --env-file "${INFOQ_ENV_FILE}" >/dev/null
  while IFS= read -r -d '' name && IFS= read -r -d '' value; do
    if [[ "${name}" == "INFOQ_ENV_LOAD_COMPLETE" ]]; then complete=true; else export "${name}=${value}"; fi
  done < <(node --input-type=module - "${SOURCE_DIR}/tools/production_config.mjs" "${INFOQ_ENV_FILE}" <<'NODE'
import {pathToFileURL} from 'node:url';
const {readProductionConfig, runtimeConfigEntries} = await import(pathToFileURL(process.argv[2]));
for (const [key, value] of runtimeConfigEntries(readProductionConfig(process.argv[3]))) process.stdout.write(`${key}\0${value}\0`);
process.stdout.write('INFOQ_ENV_LOAD_COMPLETE\0true\0');
NODE
  )
  [[ "${complete}" == true ]] || fail "受控环境文件加载失败"
  [[ "${INFOQ_ENV_FILE}" == "${source_env_file}" ]] || fail "受控配置不得改变 INFOQ_ENV_FILE 指向"
  validate_install_paths
}

generate_rsa_config() {
  local name value
  while IFS= read -r -d '' name && IFS= read -r -d '' value; do
    printf -v "${name}" '%s' "${value}"
  done < <(node --input-type=module <<'NODE'
import {generateKeyPairSync} from 'node:crypto';
for (const [publicName, privateName] of [['VITE_APP_RSA_PUBLIC_KEY', 'INFOQ_API_REQUEST_PRIVATE_KEY'], ['INFOQ_API_RESPONSE_PUBLIC_KEY', 'VITE_APP_RSA_PRIVATE_KEY']]) {
  const pair = generateKeyPairSync('rsa', {modulusLength: 2048, publicKeyEncoding: {format: 'der', type: 'spki'}, privateKeyEncoding: {format: 'der', type: 'pkcs8'}});
  process.stdout.write(`${publicName}\0${pair.publicKey.toString('base64')}\0${privateName}\0${pair.privateKey.toString('base64')}\0`);
}
NODE
  )
  [[ -n "${INFOQ_API_REQUEST_PRIVATE_KEY:-}" && -n "${VITE_APP_RSA_PRIVATE_KEY:-}" ]] || fail "RSA 生成失败"
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
    if [[ -f "${candidate}/deploy/bin/infoq.sh" && -f "${candidate}/deploy/docker/docker-compose.yml" ]]; then
      SOURCE_DIR="${candidate}"
      return
    fi
  fi
}

download_source() {
  local archive_url
  local tmp_dir

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
  tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/infoq-bootstrap.XXXXXX")"
  # curl|bash 时工具尚未取得：只在临时 staging 下载，完整预检后才写安装目录。
  curl -fsSL "${archive_url}" | tar -xz --strip-components=1 -C "${tmp_dir}"
  SOURCE_DIR="${tmp_dir}"
  if [[ "${INFOQ_DEPLOY_MODE}" == "production" ]]; then
    load_env_file
    [[ -n "${INFOQ_FRONTEND_TARGET:-}" ]] || fail "生产配置必须指定 INFOQ_FRONTEND_TARGET"
    require_env_values INFOQ_VERSION INFOQ_OSS_BUCKET DEPLOY_ID
  fi
  mkdir -p "${INFOQ_INSTALL_DIR}"
  if [[ -e "${INFOQ_INSTALL_DIR}/source" ]]; then
    [[ -f "${INFOQ_INSTALL_DIR}/source/.infoq-installer-owned" && ! -L "${INFOQ_INSTALL_DIR}/source/.infoq-installer-owned" ]] || fail "已有源码目录无安装器归属标记，拒绝替换；请先备份并使用明确的空 INFOQ_INSTALL_DIR"
    [[ "$(cat "${INFOQ_INSTALL_DIR}/source/.infoq-installer-owned")" == "infoq-scaffold-ai" ]] || fail "已有源码目录归属标记不匹配"
    rm -rf "${INFOQ_INSTALL_DIR}/source"
  fi
  printf '%s\n' infoq-scaffold-ai > "${tmp_dir}/.infoq-installer-owned"
  mv "${tmp_dir}" "${INFOQ_INSTALL_DIR}/source"
  SOURCE_DIR="${INFOQ_INSTALL_DIR}/source"
}

reset_admin_credentials() {
  INFOQ_ADMIN_USERNAME="admin_$(random_lower_alnum 12)"
  INFOQ_ADMIN_PASSWORD="$(generate_admin_password)"
  INFOQ_NEW_ADMIN_USERNAME="${INFOQ_ADMIN_USERNAME}" INFOQ_NEW_ADMIN_PASSWORD="${INFOQ_ADMIN_PASSWORD}" node --input-type=module - "${INFOQ_ENV_FILE}" <<'NODE'
import fs from 'node:fs';
const file = process.argv[2];
let content = fs.readFileSync(file, 'utf8');
for (const [name, value] of [['INFOQ_ADMIN_USERNAME', process.env.INFOQ_NEW_ADMIN_USERNAME], ['INFOQ_ADMIN_PASSWORD', process.env.INFOQ_NEW_ADMIN_PASSWORD]]) {
  const expression = new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=.*$`, 'mu');
  if (!expression.test(content)) throw new Error(`受控配置缺少 ${name}`);
  content = content.replace(expression, `${name}=${JSON.stringify(value)}`);
}
fs.writeFileSync(file, content, {encoding: 'utf8', mode: 0o600});
NODE
  write_credentials
}

prepare_credentials() {
  if [[ -f "${INFOQ_ENV_FILE}" ]]; then
    log "复用已有环境文件: ${INFOQ_ENV_FILE}"
    secure_private_file "${INFOQ_ENV_FILE}"
    load_env_file
    require_env_values INFOQ_VERSION INFOQ_PUBLIC_BASE_URL INFOQ_DEPLOY_ROOT INFOQ_FRONTEND_TARGET MYSQL_ROOT_PASSWORD INFOQ_DB_USERNAME INFOQ_DB_PASSWORD REDIS_PASSWORD MINIO_ROOT_USER MINIO_ROOT_PASSWORD INFOQ_OSS_BUCKET SECURITY_TOKEN_SECRET DEPLOY_ID
    INFOQ_FRONTEND_TARGET="$(normalize_frontend_target "${INFOQ_FRONTEND_TARGET}")"
    if [[ "${INFOQ_FRONTEND_TARGET}" != "${REQUESTED_FRONTEND_TARGET}" ]]; then
      fail "已有环境文件中的 INFOQ_FRONTEND_TARGET=${INFOQ_FRONTEND_TARGET} 与本次请求 ${REQUESTED_FRONTEND_TARGET} 不一致，请清理旧部署或使用相同目标"
    fi
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
  [[ "${INFOQ_DEPLOY_MODE}" == "development" ]] || fail "生产安装必须先提供受控 INFOQ_ENV_FILE；不会静默生成生产配置"
  generate_env_file
  load_env_file
}

print_summary() {
  printf '\n============================================================\n'
  printf 'InfoQ Scaffold deployed successfully\n\n'
  printf 'URLs:\n'
  print_frontend_urls
  printf '  Backend Health:  %s/prod-api/monitor/health/readiness\n' "${INFOQ_PUBLIC_BASE_URL}"
  printf '  MinIO Console:   %s/console-oss/\n' "${INFOQ_PUBLIC_BASE_URL}"
  printf '  MinIO OSS:       %s/\n\n' "${INFOQ_OSS_PUBLIC_ORIGIN}"

  printf 'Credentials saved to %s (mode 0600; never printed to logs)\n' "${INFOQ_CREDENTIALS_FILE}"

  printf '\nConfig files:\n'
  printf '  Environment file:    %s\n' "${INFOQ_ENV_FILE}"
  printf '  Credentials file:    %s\n' "${INFOQ_CREDENTIALS_FILE}"
  printf '\nImportant:\n'
  printf '  These credentials were synchronized to runtime config and database.\n'
  printf '  Keep this output private.\n'
  printf '============================================================\n'
}

validate_install_paths() {
  node --input-type=module - "${INFOQ_INSTALL_DIR}" "${INFOQ_CONFIG_DIR}" "${INFOQ_ENV_FILE}" "${INFOQ_CREDENTIALS_FILE}" <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
if (process.argv[4] === process.argv[5]) throw new Error('环境文件与凭据留存文件不得为同一路径');
for (const target of process.argv.slice(2)) {
  if (!path.isAbsolute(target) || path.resolve(target) !== target || target === path.parse(target).root) throw new Error('安装路径必须为规范绝对非根路径');
  for (let current = target; current !== path.dirname(current); current = path.dirname(current)) {
    try { const stat = fs.lstatSync(current); if (stat.isSymbolicLink() || (stat.isFile() && stat.nlink !== 1)) throw new Error('安装路径不允许符号链接或硬链接文件'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
NODE
}

main() {
  local requested_frontend="${INFOQ_FRONTEND_TARGET}"
  require_root
  [[ "${INFOQ_DEPLOY_MODE}" == "production" || "${INFOQ_DEPLOY_MODE}" == "development" ]] || fail "INFOQ_DEPLOY_MODE 必须为 production 或 development"
  [[ "${INFOQ_PRINT_SECRETS}" == "0" ]] || fail "禁止将部署凭据输出到日志；请直接读取受控凭据文件"
  require_command node
  validate_install_paths
  if [[ "${INFOQ_DEPLOY_MODE}" == "production" ]]; then
    [[ -f "${INFOQ_ENV_FILE}" && ! -L "${INFOQ_ENV_FILE}" ]] || fail "生产安装必须先提供受控 INFOQ_ENV_FILE，禁止缺失或符号链接"
    node --input-type=module - "${INFOQ_ENV_FILE}" <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
const file = process.argv[2], stat = fs.statSync(file);
if (!path.isAbsolute(file) || stat.size > 1048576 || (stat.mode & 0o077) !== 0) throw new Error('受控环境文件必须为绝对路径且权限0600');
// Remote bootstrap has not downloaded the shared validator yet. Check required
// inputs without interpreting shell; full validation follows the source staging.
const content = fs.readFileSync(file, 'utf8');
for (const name of ['INFOQ_PUBLIC_BASE_URL', 'INFOQ_OSS_PUBLIC_ORIGIN', 'INFOQ_TLS_CERT_FILE', 'INFOQ_TLS_KEY_FILE', 'INFOQ_PRODUCTION_CONFIG_FILE', 'MYSQL_ROOT_PASSWORD', 'INFOQ_DB_USERNAME', 'INFOQ_DB_PASSWORD', 'REDIS_PASSWORD', 'MINIO_ROOT_USER', 'MINIO_ROOT_PASSWORD', 'SECURITY_TOKEN_SECRET', 'INFOQ_ADMIN_USERNAME', 'INFOQ_ADMIN_PASSWORD', 'VITE_APP_ENCRYPT', 'VITE_APP_RSA_PUBLIC_KEY', 'VITE_APP_RSA_PRIVATE_KEY', 'INFOQ_API_REQUEST_PRIVATE_KEY', 'INFOQ_API_RESPONSE_PUBLIC_KEY']) {
  const match = new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=\\s*(.*?)\\s*$`, 'mu').exec(content);
  if (!match || ['', "''", '""'].includes(match[1]) || /^#/.test(match[1])) throw new Error(`生产引导缺少必需配置项: ${name}`);
}
NODE
  fi
  resolve_local_source
  download_source
  if [[ -f "${INFOQ_ENV_FILE}" ]]; then load_env_file; fi
  if [[ "${INFOQ_DEPLOY_MODE}" == "production" ]]; then
    require_env_values INFOQ_VERSION INFOQ_FRONTEND_TARGET INFOQ_OSS_BUCKET DEPLOY_ID
    if [[ -n "${requested_frontend}" && "$(normalize_frontend_target "${requested_frontend}")" != "${INFOQ_FRONTEND_TARGET}" ]]; then fail "生产配置与本次前端目标不一致"; fi
  fi
  if [[ -n "${requested_frontend}" ]]; then INFOQ_FRONTEND_TARGET="${requested_frontend}"; fi
  select_frontend_target
  require_runtime
  detect_public_base_url
  prepare_directories
  prepare_credentials

  log "启动后端与依赖服务"
  (cd "${SOURCE_DIR}" && INFOQ_ENV_FILE="${INFOQ_ENV_FILE}" INFOQ_RESET_ADMIN="${INFOQ_RESET_ADMIN}" INFOQ_RESET_OSS="${INFOQ_RESET_OSS}" bash deploy/bin/infoq.sh deploy)
  log "启动前端与 nginx"
  (cd "${SOURCE_DIR}" && INFOQ_ENV_FILE="${INFOQ_ENV_FILE}" bash deploy/bin/deploy-frontend.sh deploy "${INFOQ_FRONTEND_TARGET}")
  print_summary
}

main "$@"
