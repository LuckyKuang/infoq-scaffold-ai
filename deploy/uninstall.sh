#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "${SCRIPT_DIR}/bin/deploy-paths.sh"

DEFAULT_CONFIG_DIR="/etc/infoq-scaffold-ai"
DEFAULT_ENV_FILE="${DEFAULT_CONFIG_DIR}/deploy.env"
CONFIRM_PHRASE="DELETE INFOQ DEPLOYMENT"
DEFAULT_COMPOSE_PROJECT_NAME="infoq-scaffold-ai"

APP_CONTAINERS=()
APP_DIRS=()
PLAN_CONTAINER_NAMES=()
PLAN_CONTAINER_IDS=()
PLAN_NETWORK_ID=""

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
  - 应用容器与应用运行目录作为一组确认项处理，前端范围由 deploy.env 中的 INFOQ_FRONTEND_TARGET 决定。
  - MySQL、Redis、MinIO 分别确认；选择删除时会同时删除对应容器和数据目录。
  - 选择保留 MySQL、Redis 或 MinIO 时，对应容器和数据目录都不会被删除。
  - 不删除 Docker 镜像。
  - 缺少 deploy.env 或 INFOQ_FRONTEND_TARGET 时会停止卸载，避免误删前端目录。
  - 实际删除前必须输入固定确认短语: DELETE INFOQ DEPLOYMENT
  - 预览与删除前均核验 Docker 可达性、Compose project/service 标签及部署挂载；归属未知即停止。

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

  if [[ ! -f "${env_file}" ]]; then
    fail "未找到环境文件 ${env_file}，无法确定 INFOQ_FRONTEND_TARGET，已停止卸载"
  fi

  unset INFOQ_FRONTEND_TARGET
  set -a
  # shellcheck disable=SC1090
  . "${env_file}"
  set +a
  INFOQ_ENV_FILE="${env_file}"
  if [[ -n "${INFOQ_DEPLOY_ROOT_WAS_SET}" ]]; then
    INFOQ_DEPLOY_ROOT="${INFOQ_DEPLOY_ROOT_EXPLICIT}"
  fi
  log "已加载环境文件: ${INFOQ_ENV_FILE}"
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

  printf '%s %s ' "${prompt}" "${suffix}" >&2
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

normalize_frontend_target() {
  case "$1" in
    react|vue|all)
      printf '%s' "$1"
      ;;
    *)
      fail "环境文件 ${INFOQ_ENV_FILE} 中的 INFOQ_FRONTEND_TARGET 无效: ${1:-<empty>}，必须是 react、vue 或 all"
      ;;
  esac
}

configure_app_scope() {
  INFOQ_FRONTEND_TARGET="$(normalize_frontend_target "${INFOQ_FRONTEND_TARGET:-}")"
  APP_CONTAINERS=(infoq-admin nginx-web)
  APP_DIRS=(server nginx)

  case "${INFOQ_FRONTEND_TARGET}" in
    react)
      APP_CONTAINERS+=(infoq-frontend-react)
      APP_DIRS+=(react)
      ;;
    vue)
      APP_CONTAINERS+=(infoq-frontend-vue)
      APP_DIRS+=(vue)
      ;;
    all)
      APP_CONTAINERS+=(infoq-frontend-vue infoq-frontend-react)
      APP_DIRS+=(vue react)
      ;;
  esac
}

join_items() {
  local sep="$1"
  local output=""
  shift

  for item in "$@"; do
    if [[ -z "${output}" ]]; then
      output="${item}"
    else
      output="${output}${sep}${item}"
    fi
  done

  printf '%s' "${output}"
}

print_items() {
  local item

  for item in "$@"; do
    printf '  %s\n' "${item}"
  done
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
  deploy_assert_file_target "${INFOQ_ENV_FILE}" || fail "卸载环境文件路径不安全"
  [[ "$(abs_dir "$(dirname "${INFOQ_ENV_FILE}")")" == "${config_abs}" ]] || fail "配置目录不包含本次加载的环境文件，拒绝删除: ${config_abs}"
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

expected_mount_child() {
  case "$1:$2" in
    mysql:/var/lib/mysql) printf mysql/data ;;
    mysql:/etc/mysql/conf.d) printf mysql/conf ;;
    redis:/redis/config) printf redis/conf ;;
    redis:/redis/data|redis:/data) printf redis/data ;;
    minio:/data) printf minio/data ;;
    infoq-admin:/infoq/server/config) printf server/config ;;
    infoq-admin:/infoq/server/logs) printf server/logs ;;
    infoq-admin:/infoq/server/ip2region) printf server/ip2region ;;
    nginx-web:/etc/nginx/cert) printf nginx/cert ;;
    nginx-web:/etc/nginx/nginx.conf) printf nginx/conf/nginx.conf ;;
    nginx-web:/var/log/nginx) printf nginx/log ;;
    infoq-frontend-vue:/var/log/nginx) printf vue/logs ;;
    infoq-frontend-react:/var/log/nginx) printf react/logs ;;
    *) return 1 ;;
  esac
}

preflight_container() {
  local name="$1" snapshot="$2" project="$3" inspections="$4"
  local id="" candidate candidate_id inspection header owner service inspected_id
  local type source destination writable child expected mount_count=0
  while IFS=$'\t' read -r candidate candidate_id; do
    [[ "${candidate}" != "${name}" ]] || id="${candidate_id}"
  done <<< "${snapshot}"
  PLAN_CONTAINER_NAMES+=("${name}")
  if [[ -z "${id}" ]]; then
    PLAN_CONTAINER_IDS+=("")
    log "已确认容器不存在: ${name}"
    return
  fi
  inspection=""
  while [[ -n "${inspections}" ]]; do
    local block="${inspections%%$'\nEND'*}"
    header="${block%%$'\n'*}"
    IFS='|' read -r owner service inspected_id <<< "${header}"
    if [[ "${inspected_id}" == "${id}" ]]; then inspection="${block}"; break; fi
    [[ "${inspections}" == *$'\nEND\n'* ]] || break
    inspections="${inspections#*$'\nEND\n'}"
  done
  [[ -n "${inspection}" ]] || fail "缺少容器的批量查询结果，未执行删除: ${name}"
  header="${inspection%%$'\n'*}"
  IFS='|' read -r owner service inspected_id <<< "${header}"
  [[ "${owner}" == "${project}" && "${service}" == "${name}" && "${inspected_id}" == "${id}" ]] || fail "容器归属不匹配，未执行删除: ${name}"
  while IFS='|' read -r type source destination writable; do
    [[ "${type}" == bind ]] || fail "容器存在非预期挂载，未执行删除: ${name}"
    if [[ "${name}:${destination}" == mysql:/docker-entrypoint-initdb.d && "${writable}" == false ]]; then
      continue
    fi
    child="$(expected_mount_child "${name}" "${destination}")" || fail "容器挂载目标不在本栈契约内: ${name} ${destination}"
    expected="${INFOQ_DEPLOY_ROOT}/${child}"
    if [[ -e "${expected}" ]]; then
      deploy_assert_safe_path "${expected}" || fail "部署挂载路径不安全: ${name}"
      if [[ -d "${expected}" ]]; then expected="$(abs_dir "${expected}")";
      else expected="$(abs_dir "$(dirname "${expected}")")/$(basename "${expected}")"; fi
    fi
    [[ "${source%/}" == "${expected%/}" ]] || fail "容器挂载来源不匹配，未执行删除: ${name} ${destination}"
    mount_count=$((mount_count + 1))
  done <<< "${inspection#*$'\n'}"
  (( mount_count > 0 )) || fail "容器缺少本栈部署挂载: ${name}"
  PLAN_CONTAINER_IDS+=("${id}")
  log "已核验容器 project/service 与部署挂载: ${name}"
}

preflight_plan() {
  local apps="$1" mysql="$2" redis="$3" minio="$4" config="$5"
  local containers=() dirs=() ids=() name child snapshot networks inspection owner network_label candidate candidate_id index matched marker
  local project="${INFOQ_COMPOSE_PROJECT_NAME:-${COMPOSE_PROJECT_NAME:-${DEFAULT_COMPOSE_PROJECT_NAME}}}"
  local network="${project}_default"
  deploy_assert_safe_path "${INFOQ_DEPLOY_ROOT}" || fail "部署根目录不安全"
  if [[ -d "${INFOQ_DEPLOY_ROOT}" ]]; then INFOQ_DEPLOY_ROOT="$(abs_dir "${INFOQ_DEPLOY_ROOT}")"; fi
  if [[ "${apps}" == yes ]]; then containers+=("${APP_CONTAINERS[@]}"); dirs+=("${APP_DIRS[@]}"); fi
  if [[ "${mysql}" == yes ]]; then containers+=(mysql); dirs+=(mysql); fi
  if [[ "${redis}" == yes ]]; then containers+=(redis); dirs+=(redis); fi
  if [[ "${minio}" == yes ]]; then containers+=(minio); dirs+=(minio); fi
  if (( ${#dirs[@]} > 0 )); then
    for child in "${dirs[@]}"; do
      deploy_assert_safe_path "${INFOQ_DEPLOY_ROOT}/${child}" || fail "删除路径不安全: ${child}"
      if [[ -e "${INFOQ_DEPLOY_ROOT}/${child}" ]]; then assert_safe_child_dir "${INFOQ_DEPLOY_ROOT}" "${child}"; fi
    done
  fi
  if [[ "${config}" == yes ]]; then
    deploy_assert_safe_path "${INFOQ_CONFIG_DIR}" || fail "配置目录不安全"
    assert_safe_config_dir "${INFOQ_CONFIG_DIR}"
  fi
  (( ${#containers[@]} > 0 )) || return 0
  command -v docker >/dev/null 2>&1 || fail "缺少 docker 命令，无法核验卸载归属"
  snapshot="$(docker container ls --all --no-trunc --format '{{.Names}}\t{{.ID}}')" || fail "无法列出 Docker 容器，未执行任何删除"
  for name in "${containers[@]}"; do
    while IFS=$'\t' read -r candidate candidate_id; do
      [[ "${candidate}" != "${name}" ]] || ids+=("${candidate_id}")
    done <<< "${snapshot}"
  done
  inspection=""
  if (( ${#ids[@]} > 0 )); then
    inspection="$(docker container inspect "${ids[@]}" --format '{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}|{{.Id}}{{range .Mounts}}{{printf "\n%s|%s|%s|%t" .Type .Source .Destination .RW}}{{end}}{{printf "\nEND"}}')" || fail "批量查询容器失败，未执行任何删除"
  fi
  for name in "${containers[@]}"; do preflight_container "${name}" "${snapshot}" "${project}" "${inspection}"; done
  for child in "${dirs[@]}"; do
    [[ -e "${INFOQ_DEPLOY_ROOT}/${child}" ]] || continue
    matched=0
    case "${child}" in
      server) name=infoq-admin ;; nginx) name=nginx-web ;;
      vue) name=infoq-frontend-vue ;; react) name=infoq-frontend-react ;; *) name="${child}" ;;
    esac
    for ((index=0; index<${#PLAN_CONTAINER_NAMES[@]}; index++)); do
      if [[ "${PLAN_CONTAINER_NAMES[index]}" == "${name}" && -n "${PLAN_CONTAINER_IDS[index]}" ]]; then matched=1; break; fi
    done
    if [[ "${matched}" == 0 ]]; then
      marker="${INFOQ_DEPLOY_ROOT}/${child}/.infoq-deploy-owner"
      deploy_assert_file_target "${marker}" || fail "孤立部署目录标记不安全: ${child}"
      [[ -f "${marker}" && "$(cat "${marker}")" == "${project}" ]] || fail "孤立数据缺少匹配的 project 归属标记，未执行删除: ${child}"
    fi
  done
  networks="$(docker network ls --format '{{.Name}}')" || fail "无法列出 Docker 网络，未执行任何删除"
  if printf '%s\n' "${networks}" | grep -Fxq "${network}"; then
    inspection="$(docker network inspect "${network}" --format '{{.Id}}|{{index .Labels "com.docker.compose.project"}}|{{index .Labels "com.docker.compose.network"}}')" || fail "无法核验 Compose 网络，未执行任何删除"
    IFS='|' read -r PLAN_NETWORK_ID owner network_label <<< "${inspection}"
    [[ -n "${PLAN_NETWORK_ID}" && "${owner}" == "${project}" && "${network_label}" == default ]] || fail "Compose 网络归属不匹配，未执行任何删除"
  fi
}

remove_container_if_exists() {
  local name="$1"
  local index
  for ((index=0; index<${#PLAN_CONTAINER_NAMES[@]}; index++)); do
    if [[ "${PLAN_CONTAINER_NAMES[index]}" == "${name}" ]]; then
      if [[ -n "${PLAN_CONTAINER_IDS[index]}" ]]; then run_cmd docker rm -f "${PLAN_CONTAINER_IDS[index]}";
      else log "容器不存在，跳过: ${name}"; fi
      return
    fi
  done
  fail "容器未完成归属预检: ${name}"
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

  local first_entry
  first_entry="$(find "${INFOQ_DEPLOY_ROOT}" -mindepth 1 -maxdepth 1 -print -quit)" || fail "无法检查部署根目录是否为空"
  if [[ -n "${first_entry}" ]]; then
    log "部署根目录非空，已保留: ${INFOQ_DEPLOY_ROOT}"
  else
    rmdir -- "${INFOQ_DEPLOY_ROOT}" || fail "删除空部署根目录失败"
    log "已删除空部署根目录: ${INFOQ_DEPLOY_ROOT}"
  fi
}

remove_empty_project_networks() {
  local container_count
  [[ -n "${PLAN_NETWORK_ID}" ]] || return 0
  container_count="$(docker network inspect "${PLAN_NETWORK_ID}" --format '{{len .Containers}}')" || fail "无法查询已核验网络的使用状态"
  [[ "${container_count}" =~ ^[0-9]+$ ]] || fail "Compose 网络容器数无效"
  if [[ "${container_count}" == 0 ]]; then run_cmd docker network rm "${PLAN_NETWORK_ID}";
  else log "Compose 网络仍有容器使用，已保留: ${PLAN_NETWORK_ID} (${container_count})"; fi
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
  printf 'Env file:    %s\n' "${INFOQ_ENV_FILE}"
  printf 'Frontend target: %s\n\n' "${INFOQ_FRONTEND_TARGET}"
  printf 'App containers:\n'
  print_items "${APP_CONTAINERS[@]}"
  printf '\nApp dirs:\n'
  print_items "${APP_DIRS[@]}"
  printf '\n'
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
  local app_dirs_label

  parse_args "$@"
  load_env_file
  resolve_deploy_root
  assert_safe_deploy_root "${INFOQ_DEPLOY_ROOT}"
  configure_app_scope
  app_dirs_label="$(join_items "/" "${APP_DIRS[@]}")"
  log "检测到前端安装目标: ${INFOQ_FRONTEND_TARGET}"

  remove_apps_choice="$(choice_from_env_or_prompt INFOQ_UNINSTALL_APPS "是否删除应用容器和应用运行目录 ${app_dirs_label}？" "no")"
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

  preflight_plan "${remove_apps_choice}" "${remove_mysql_choice}" "${remove_redis_choice}" "${remove_minio_choice}" "${remove_config_choice}"
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
