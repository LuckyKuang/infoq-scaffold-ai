#!/usr/bin/env bash

load_runtime_env_data() {
  local env_file="${1:-}"
  local key value complete=0
  command -v node >/dev/null 2>&1 || { echo "[deploy-env] 缺少 Node.js" >&2; return 1; }
  while IFS= read -r -d '' key && IFS= read -r -d '' value; do
    if [[ "${key}" == "INFOQ_ENV_LOAD_COMPLETE" ]]; then
      complete=1
    else
      export "${key}=${value}"
    fi
  done < <(node "${SCRIPT_DIR}/load-runtime-env.mjs" "${env_file}")
  [[ "${complete}" == 1 ]] || { echo "[deploy-env] 受控配置未完整加载，停止操作" >&2; return 1; }
  if [[ "${INFOQ_DEPLOY_MODE:-production}" == production && -n "${env_file}" && -n "${INFOQ_PRODUCTION_CONFIG_FILE:-}" && "${env_file}" != "${INFOQ_PRODUCTION_CONFIG_FILE}" ]]; then
    echo "[deploy-env] 生产 INFOQ_ENV_FILE 与 INFOQ_PRODUCTION_CONFIG_FILE 必须同源" >&2
    return 1
  fi
}
