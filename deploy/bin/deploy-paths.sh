#!/usr/bin/env bash
# Sourced by deployment helpers; never changes ownership or permissions of existing data.

deploy_assert_safe_path() {
  local path="$1"
  local ancestor="${path}"
  case "${path}" in
    /) echo "[deploy] 拒绝把文件系统根作为部署路径" >&2; return 1 ;;
    /*) ;;
    *) echo "[deploy] 部署路径必须是绝对路径: ${path}" >&2; return 1 ;;
  esac
  case "${path}/" in
    *'/../'*|*'/./'*|*'//'*|*$'\n'*|*$'\r'*) echo "[deploy] 部署路径必须规范化且不含换行: ${path}" >&2; return 1 ;;
  esac
  while [[ -n "${ancestor}" ]]; do
    if [[ -L "${ancestor}" ]]; then
      echo "[deploy] 拒绝通过符号链接准备部署路径: ${ancestor}" >&2
      return 1
    fi
    ancestor="${ancestor%/*}"
  done
}

prepare_deploy_dir() {
  local path="$1"
  local mode
  deploy_assert_safe_path "${path}" || return 1
  if [[ -e "${path}" ]]; then
    [[ -d "${path}" ]] || { echo "[deploy] 部署路径不是目录: ${path}" >&2; return 1; }
    mode="$(stat -c '%a' "${path}" 2>/dev/null || stat -f '%Lp' "${path}")" || return 1
    if (( (8#${mode} & 0002) != 0 )); then
      echo "[deploy] 目录允许其他用户写入，请由管理员核验 owner/权限后重试: ${path}" >&2
      return 1
    fi
  else
    (umask 022; mkdir -p "${path}") || return 1
    chmod 0755 "${path}" || return 1
  fi
}

prepare_deploy_service_dir() {
  local path="$1"
  local created=0
  local project="${INFOQ_COMPOSE_PROJECT_NAME:-${COMPOSE_PROJECT_NAME:-infoq-scaffold-ai}}"
  [[ -e "${path}" ]] || created=1
  prepare_deploy_dir "${path}" || return 1
  if [[ "${created}" == 1 ]]; then
    (umask 077; printf '%s\n' "${project}" > "${path}/.infoq-deploy-owner") || return 1
  fi
}

deploy_assert_file_target() {
  local path="$1"
  deploy_assert_safe_path "${path}" || return 1
  if [[ -e "${path}" && ! -f "${path}" ]]; then
    echo "[deploy] 配置目标不是普通文件: ${path}" >&2
    return 1
  fi
}
