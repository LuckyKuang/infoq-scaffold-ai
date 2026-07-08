#!/usr/bin/env bash
set -euo pipefail

DEFAULT_CONFIG_DIR="/etc/infoq-scaffold-ai"
DEFAULT_ENV_FILE="${DEFAULT_CONFIG_DIR}/deploy.env"
CONFIRM_PHRASE="DELETE INFOQ DEPLOYMENT"
DEFAULT_COMPOSE_PROJECT_NAME="infoq-scaffold-ai"
LEGACY_COMPOSE_PROJECT_NAME="docker"

APP_CONTAINERS=(infoq-admin nginx-web infoq-frontend-vue infoq-frontend-react infoq-frontend-react-pro)
APP_DIRS=(server nginx vue react react-pro)

DRY_RUN=0
INFOQ_CONFIG_DIR_WAS_SET="${INFOQ_CONFIG_DIR:+1}"
INFOQ_ENV_FILE_WAS_SET="${INFOQ_ENV_FILE:+1}"
INFOQ_DEPLOY_ROOT_WAS_SET="${INFOQ_DEPLOY_ROOT:+1}"
INFOQ_DEPLOY_ROOT_EXPLICIT="${INFOQ_DEPLOY_ROOT:-}"
INFOQ_CONFIG_DIR="${INFOQ_CONFIG_DIR:-${DEFAULT_CONFIG_DIR}}"
INFOQ_ENV_FILE="${INFOQ_ENV_FILE:-}"
INFOQ_DEPLOY_ROOT="${INFOQ_DEPLOY_ROOT:-}"

usage() {
  cat <<'EOF'
用法: bash deploy/uninstall.sh [--dry-run]

卸载说明:
  - 应用容器与应用运行目录作为一组确认项处理。
  - MySQL、Redis、MinIO 分别确认；选择删除时会同时删除对应容器和数据目录。
  - 选择保留 MySQL、Redis 或 MinIO 时，对应容器和数据目录都不会被删除。
  - 不删除 Docker 镜像。
  - 实际删除前必须输入固定确认短语: DELETE INFOQ DEPLOYMENT

自动化验证变量:
  INFOQ_UNINSTALL_APPS=yes|no
  INFOQ_UNINSTALL_MYSQL=yes|no
  INFOQ_UNINSTALL_REDIS=yes|no
  INFOQ_UNINSTALL_MINIO=yes|no
  INFOQ_UNINSTALL_CONFIG=yes|no
  INFOQ_UNINSTALL_EMPTY_ROOT=yes|no
  INFOQ_UNINSTALL_CONFIRM='DELETE INFOQ DEPLOYMENT'
EOF
}

log() {
  printf '[uninstall] %s\n' "$*"
}

fail() {
  printf '[uninstall] %s\n' "$*" >&2
  exit 1
}

parse_args() {
  while (($# > 0)); do
    case "$1" in
      --dry-run)
        DRY_RUN=1
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        usage >&2
        fail "未知参数: $1"
        ;;
    esac
    shift
  done
}

load_env_file() {
  local env_file="${INFOQ_ENV_FILE}"

  if [[ -z "${env_file}" ]]; then
    env_file="${INFOQ_CONFIG_DIR}/deploy.env"
  fi
  if [[ ! -f "${env_file}" && -n "${INFOQ_ENV_FILE_WAS_SET}" ]]; then
    fail "指定的环境文件不存在: ${env_file}"
  fi
  if [[ ! -f "${env_file}" && "${env_file}" != "${DEFAULT_ENV_FILE}" && -z "${INFOQ_CONFIG_DIR_WAS_SET}" && -f "${DEFAULT_ENV_FILE}" ]]; then
    env_file="${DEFAULT_ENV_FILE}"
  fi

  if [[ -f "${env_file}" ]]; then
    set -a
    # shellcheck disable=SC1090
    . "${env_file}"
    set +a
    INFOQ_ENV_FILE="${env_file}"
    if [[ -n "${INFOQ_DEPLOY_ROOT_WAS_SET}" ]]; then
      INFOQ_DEPLOY_ROOT="${INFOQ_DEPLOY_ROOT_EXPLICIT}"
    fi
    log "已加载环境文件: ${INFOQ_ENV_FILE}"
  else
    INFOQ_ENV_FILE="${env_file}"
    log "未找到环境文件，使用环境变量或运行时默认值: ${INFOQ_ENV_FILE}"
  fi
}

default_user_home() {
  if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
    eval "printf '%s' ~${SUDO_USER}" 2>/dev/null || printf '%s' "${HOME}"
    return
  fi
  printf '%s' "${HOME}"
}

resolve_deploy_root() {
  if [[ -n "${INFOQ_DEPLOY_ROOT:-}" ]]; then
    return
  fi

  if [[ "$(uname -s)" == "Darwin" ]]; then
    INFOQ_DEPLOY_ROOT="$(default_user_home)/infoq"
  else
    INFOQ_DEPLOY_ROOT="/infoq"
  fi
}

normalize_choice() {
  case "$1" in
    1|true|TRUE|yes|YES|y|Y)
      printf 'yes'
      ;;
    0|false|FALSE|no|NO|n|N|'')
      printf 'no'
      ;;
    *)
      fail "无效选择 '$1'，请使用 yes 或 no"
      ;;
  esac
}

ask_yes_no() {
  local prompt="$1"
  local default_answer="$2"
  local suffix="[y/N]"
  local answer

  if [[ "${default_answer}" == "yes" ]]; then
    suffix="[Y/n]"
  fi

  printf '%s %s ' "${prompt}" "${suffix}"
  IFS= read -r answer
  if [[ -z "${answer}" ]]; then
    answer="${default_answer}"
  fi
  normalize_choice "${answer}"
}

choice_from_env_or_prompt() {
  local env_name="$1"
  local prompt="$2"
  local default_answer="$3"
  local env_value="${!env_name:-}"

  if [[ -n "${env_value}" ]]; then
    normalize_choice "${env_value}"
    return
  fi

  ask_yes_no "${prompt}" "${default_answer}"
}

abs_dir() {
  local path="$1"
  if [[ ! -d "${path}" ]]; then
    return 1
  fi
  (cd -P -- "${path}" && pwd)
}

assert_safe_deploy_root() {
  local root="$1"
  local root_abs

  if [[ ! -d "${root}" ]]; then
    return
  fi

  root_abs="$(abs_dir "${root}")"
  case "${root_abs}" in
    ''|'/'|'/home'|'/Users'|'/usr'|'/var'|'/etc'|'/opt'|'/tmp'|'/mnt'|'/mnt/'[A-Za-z]|'/mnt/'[A-Za-z]/*)
      fail "拒绝在高风险部署根目录下执行删除: ${root_abs}"
      ;;
  esac
}

assert_safe_child_dir() {
  local root="$1"
  local child="$2"
  local target="${root}/${child}"
  local root_abs
  local target_abs
  local expected

  if [[ ! -d "${target}" ]]; then
    fail "目标不是目录，拒绝删除: ${target}"
  fi

  assert_safe_deploy_root "${root}"
  root_abs="$(abs_dir "${root}")"
  target_abs="$(abs_dir "${target}")"
  expected="${root_abs}/${child}"

  if [[ "${target_abs}" != "${expected}" ]]; then
    fail "目标目录不在预期部署根目录内，拒绝删除: ${target_abs}"
  fi
}

assert_safe_config_dir() {
  local config_dir="$1"
  local config_abs
  local base

  if [[ ! -d "${config_dir}" ]]; then
    return
  fi

  config_abs="$(abs_dir "${config_dir}")"
  base="$(basename "${config_abs}")"
  if [[ "${base}" != "infoq-scaffold-ai" ]]; then
    fail "配置目录名称不是 infoq-scaffold-ai，拒绝删除: ${config_abs}"
  fi

  case "${config_abs}" in
    ''|'/'|'/home'|'/Users'|'/usr'|'/var'|'/etc'|'/opt'|'/tmp'|'/mnt'|'/mnt/'[A-Za-z]|'/mnt/'[A-Za-z]/*)
      fail "拒绝删除高风险配置目录: ${config_abs}"
      ;;
  esac
}

run_cmd() {
  if [[ "${DRY_RUN}" == "1" ]]; then
    printf '[uninstall] dry-run:'
    printf ' %q' "$@"
    printf '\n'
    return
  fi
  "$@"
}

container_exists() {
  local name="$1"
  command -v docker >/dev/null 2>&1 && docker container inspect "${name}" >/dev/null 2>&1
}

remove_container_if_exists() {
  local name="$1"

  if [[ "${DRY_RUN}" == "1" ]]; then
    log "dry-run: 将删除容器（若存在）: ${name}"
    return
  fi

  if ! command -v docker >/dev/null 2>&1; then
    fail "缺少 docker 命令，无法删除容器: ${name}"
  fi

  if container_exists "${name}"; then
    run_cmd docker rm -f "${name}"
  else
    log "容器不存在，跳过: ${name}"
  fi
}

remove_child_dir_if_exists() {
  local child="$1"
  local label="$2"
  local target="${INFOQ_DEPLOY_ROOT}/${child}"

  if [[ ! -e "${target}" ]]; then
    log "${label} 目录不存在，跳过: ${target}"
    return
  fi

  assert_safe_child_dir "${INFOQ_DEPLOY_ROOT}" "${child}"
  run_cmd rm -rf -- "${target}"
}

remove_config_dir_if_exists() {
  if [[ ! -e "${INFOQ_CONFIG_DIR}" ]]; then
    log "配置目录不存在，跳过: ${INFOQ_CONFIG_DIR}"
    return
  fi

  assert_safe_config_dir "${INFOQ_CONFIG_DIR}"
  run_cmd rm -rf -- "${INFOQ_CONFIG_DIR}"
}

remove_empty_deploy_root() {
  if [[ ! -d "${INFOQ_DEPLOY_ROOT}" ]]; then
    log "部署根目录不存在，跳过: ${INFOQ_DEPLOY_ROOT}"
    return
  fi

  assert_safe_deploy_root "${INFOQ_DEPLOY_ROOT}"
  if [[ "${DRY_RUN}" == "1" ]]; then
    log "dry-run: 若目录为空，将删除部署根目录: ${INFOQ_DEPLOY_ROOT}"
    return
  fi

  if rmdir -- "${INFOQ_DEPLOY_ROOT}" 2>/dev/null; then
    log "已删除空部署根目录: ${INFOQ_DEPLOY_ROOT}"
  else
    log "部署根目录非空，已保留: ${INFOQ_DEPLOY_ROOT}"
  fi
}

remove_empty_project_networks() {
  local project_name="${INFOQ_COMPOSE_PROJECT_NAME:-${COMPOSE_PROJECT_NAME:-${DEFAULT_COMPOSE_PROJECT_NAME}}}"
  local networks=("${project_name}_default")
  local network
  local container_count

  if [[ "${project_name}" != "${LEGACY_COMPOSE_PROJECT_NAME}" ]]; then
    networks+=("${LEGACY_COMPOSE_PROJECT_NAME}_default")
  fi

  if ! command -v docker >/dev/null 2>&1; then
    if [[ "${DRY_RUN}" == "1" ]]; then
      log "dry-run: 缺少 docker 命令，跳过 Compose 网络检查"
      return
    fi
    fail "缺少 docker 命令，无法清理 Compose 网络"
  fi

  for network in "${networks[@]}"; do
    if ! docker network inspect "${network}" >/dev/null 2>&1; then
      log "Compose 网络不存在，跳过: ${network}"
      continue
    fi

    if [[ "${DRY_RUN}" == "1" ]]; then
      log "dry-run: 若网络为空，将删除 Compose 网络: ${network}"
      continue
    fi

    container_count="$(docker network inspect "${network}" --format '{{len .Containers}}')"
    if [[ "${container_count}" == "0" ]]; then
      run_cmd docker network rm "${network}"
    else
      log "Compose 网络仍有容器使用，已保留: ${network} (${container_count})"
    fi
  done
}

print_plan() {
  local apps="$1"
  local mysql="$2"
  local redis="$3"
  local minio="$4"
  local config="$5"
  local empty_root="$6"

  printf '\n============================================================\n'
  printf 'InfoQ Scaffold uninstall plan\n\n'
  printf 'Deploy root: %s\n' "${INFOQ_DEPLOY_ROOT}"
  printf 'Config dir:  %s\n' "${INFOQ_CONFIG_DIR}"
  printf 'Env file:    %s\n\n' "${INFOQ_ENV_FILE}"
  printf 'Actions:\n'
  printf '  Remove app containers and dirs: %s\n' "${apps}"
  printf '  Remove MySQL container and data: %s\n' "${mysql}"
  printf '  Remove Redis container and data: %s\n' "${redis}"
  printf '  Remove MinIO container and data: %s\n' "${minio}"
  printf '  Remove config dir:               %s\n' "${config}"
  printf '  Remove empty deploy root:         %s\n' "${empty_root}"
  printf '============================================================\n\n'
}

has_any_action() {
  for choice in "$@"; do
    if [[ "${choice}" == "yes" ]]; then
      return 0
    fi
  done
  return 1
}

confirm_plan() {
  local answer

  if [[ "${DRY_RUN}" == "1" ]]; then
    log "dry-run 模式，不执行删除。"
    return
  fi

  if [[ "${INFOQ_UNINSTALL_CONFIRM:-}" == "${CONFIRM_PHRASE}" ]]; then
    return
  fi

  printf '请输入确认短语 "%s" 后继续: ' "${CONFIRM_PHRASE}"
  IFS= read -r answer
  if [[ "${answer}" != "${CONFIRM_PHRASE}" ]]; then
    fail "确认短语不匹配，已取消卸载"
  fi
}

remove_apps() {
  local container
  local dir

  for container in "${APP_CONTAINERS[@]}"; do
    remove_container_if_exists "${container}"
  done
  for dir in "${APP_DIRS[@]}"; do
    remove_child_dir_if_exists "${dir}" "应用"
  done
}

main() {
  local remove_apps_choice
  local remove_mysql_choice
  local remove_redis_choice
  local remove_minio_choice
  local remove_config_choice
  local remove_empty_root_choice

  parse_args "$@"
  load_env_file
  resolve_deploy_root
  assert_safe_deploy_root "${INFOQ_DEPLOY_ROOT}"

  remove_apps_choice="$(choice_from_env_or_prompt INFOQ_UNINSTALL_APPS "是否删除应用容器和应用运行目录 server/nginx/vue/react/react-pro？" "no")"
  remove_mysql_choice="$(choice_from_env_or_prompt INFOQ_UNINSTALL_MYSQL "是否删除 MySQL 容器和 ${INFOQ_DEPLOY_ROOT}/mysql 数据目录？" "no")"
  remove_redis_choice="$(choice_from_env_or_prompt INFOQ_UNINSTALL_REDIS "是否删除 Redis 容器和 ${INFOQ_DEPLOY_ROOT}/redis 数据目录？" "no")"
  remove_minio_choice="$(choice_from_env_or_prompt INFOQ_UNINSTALL_MINIO "是否删除 MinIO 容器和 ${INFOQ_DEPLOY_ROOT}/minio 数据目录？" "no")"
  remove_config_choice="$(choice_from_env_or_prompt INFOQ_UNINSTALL_CONFIG "是否删除配置目录 ${INFOQ_CONFIG_DIR}？" "no")"
  remove_empty_root_choice="$(choice_from_env_or_prompt INFOQ_UNINSTALL_EMPTY_ROOT "若 ${INFOQ_DEPLOY_ROOT} 为空，是否删除该部署根目录？" "no")"

  print_plan \
    "${remove_apps_choice}" \
    "${remove_mysql_choice}" \
    "${remove_redis_choice}" \
    "${remove_minio_choice}" \
    "${remove_config_choice}" \
    "${remove_empty_root_choice}"

  if ! has_any_action \
    "${remove_apps_choice}" \
    "${remove_mysql_choice}" \
    "${remove_redis_choice}" \
    "${remove_minio_choice}" \
    "${remove_config_choice}" \
    "${remove_empty_root_choice}"; then
    log "没有选择任何删除项，退出。"
    return
  fi

  confirm_plan

  if [[ "${remove_apps_choice}" == "yes" ]]; then
    remove_apps
  fi
  if [[ "${remove_mysql_choice}" == "yes" ]]; then
    remove_container_if_exists mysql
    remove_child_dir_if_exists mysql "MySQL"
  fi
  if [[ "${remove_redis_choice}" == "yes" ]]; then
    remove_container_if_exists redis
    remove_child_dir_if_exists redis "Redis"
  fi
  if [[ "${remove_minio_choice}" == "yes" ]]; then
    remove_container_if_exists minio
    remove_child_dir_if_exists minio "MinIO"
  fi
  if [[ "${remove_config_choice}" == "yes" ]]; then
    remove_config_dir_if_exists
  fi
  if [[ "${remove_empty_root_choice}" == "yes" ]]; then
    remove_empty_deploy_root
  fi
  if [[ "${remove_apps_choice}" == "yes" || "${remove_mysql_choice}" == "yes" || "${remove_redis_choice}" == "yes" || "${remove_minio_choice}" == "yes" ]]; then
    remove_empty_project_networks
  fi

  log "卸载流程完成。保留项未被停止或删除。"
}

main "$@"
