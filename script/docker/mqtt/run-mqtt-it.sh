#!/usr/bin/env bash
set -euo pipefail

command="${1:-}"
run_id="${2:-}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd "${script_dir}/../../.." && pwd)"
state_root="${INFOQ_DEPLOY_ROOT:-/infoq}"
maven_repo="${MIDDLEWARE_MAVEN_REPO:-/mnt/c/DevTools/repo}"

usage() {
  echo "Usage: run-mqtt-it.sh prepare [run-id] | config <run-id> | verify <run-id> | stop <run-id> | status <run-id>" >&2
  exit 64
}

require_wsl_docker() {
  grep -qi microsoft /proc/version || { echo "This verifier must run inside WSL2" >&2; exit 78; }
  docker info --format '{{.OperatingSystem}}|{{.ServerVersion}}' | grep -Eqi 'Debian.*\|' || { echo "Docker CE/Moby Debian daemon is required" >&2; exit 78; }
  docker compose version >/dev/null
}

resolve_paths() {
  [ -n "${run_id}" ] || usage
  secret_dir="${state_root}/mqtt-it/secrets/${run_id}"
  env_file="${secret_dir}/compose.env"
  evidence_dir="${repository_root}/doc/tmp/mqtt-wsl2/${run_id}"
  [ -f "${env_file}" ] || { echo "Unknown MQTT run: ${run_id}" >&2; exit 66; }
}

compose() {
  docker compose --env-file "${env_file}" -p "infoq-mqtt-it-${run_id}" \
    -f "${repository_root}/script/docker/docker-compose.yml" \
    -f "${repository_root}/script/docker/docker-compose.mqtt-it.yml" "$@"
}

redact() {
  local file="$1"
  local value
  cp "${file}" "${file}.redacted"
  while IFS='=' read -r key value; do
    case "${key}" in
      *PASSWORD*|*COOKIE*|SECURITY_TOKEN_SECRET)
        [ -n "${value}" ] && sed -i "s/${value}/<redacted>/g" "${file}.redacted"
        ;;
    esac
  done < "${env_file}"
  mv "${file}.redacted" "${file}"
}

record_image() {
  local image="$1"
  docker image inspect "${image}" --format "{{.Id}} {{index .RepoDigests 0}}" >> "${evidence_dir}/images.txt"
}

run_verifier() {
  local log_file="$1"
  shift
  set +e
  compose "$@" > "${log_file}" 2>&1
  local status=$?
  set -e
  redact "${log_file}"
  return "${status}"
}

wait_for_one_shot() {
  local service="$1"
  local deadline=$((SECONDS + 180))
  while [ "${SECONDS}" -lt "${deadline}" ]; do
    local container_id
    container_id="$(compose ps --all -q "${service}")"
    if [ -n "${container_id}" ]; then
      local state
      state="$(docker inspect --format "{{.State.Status}}:{{.State.ExitCode}}" "${container_id}")"
      case "${state}" in
        exited:0) return 0 ;;
        exited:*|dead:*) echo "${service} failed with ${state}" >&2; return 1 ;;
      esac
    fi
    sleep 1
  done
  echo "Timed out waiting for ${service} to complete" >&2
  return 75
}

capture_service_logs() {
  local service="$1"
  local log_file="${evidence_dir}/mqtt-${service}.log"
  local container_id
  container_id="$(compose ps --all -q "${service}")"
  if [ -n "${container_id}" ]; then
    docker logs "${container_id}" > "${log_file}" 2>&1 || true
  else
    : > "${log_file}"
  fi
  redact "${log_file}"
}

render_config() {
  local output="${evidence_dir}/compose-mqtt.yaml"
  compose config > "${output}"
  redact "${output}"
}

wait_for_tcp() {
  local port="$1"
  local deadline=$((SECONDS + 90))
  until (echo > "/dev/tcp/127.0.0.1/${port}") >/dev/null 2>&1; do
    [ "${SECONDS}" -lt "${deadline}" ] || { echo "Timed out waiting for 127.0.0.1:${port}" >&2; exit 75; }
    sleep 1
  done
}

copy_surefire_reports() {
  local report_dir="${repository_root}/infoq-scaffold-backend/infoq-plugin/infoq-plugin-mqtt/target/surefire-reports"
  [ -d "${report_dir}" ] || return 0
  mkdir -p "${evidence_dir}/mqtt-surefire-reports"
  while IFS= read -r report; do
    redact "${report}"
    cp "${report}" "${evidence_dir}/mqtt-surefire-reports/"
  done < <(find "${report_dir}" -maxdepth 1 -type f \( -name 'TEST-*.xml' -o -name '*.txt' \) -print)
}

prepare() {
  require_wsl_docker
  local created_run_id="${run_id:-$(date -u +%Y%m%d%H%M%S)-$(od -An -N4 -tx1 /dev/urandom | tr -d ' \n')}"
  run_id="${created_run_id}"
  secret_dir="${state_root}/mqtt-it/secrets/${run_id}"
  evidence_dir="${repository_root}/doc/tmp/mqtt-wsl2/${run_id}"
  [ ! -e "${secret_dir}" ] || { echo "Run already exists: ${run_id}" >&2; exit 73; }
  [ -d "${maven_repo}" ] || { echo "Maven repository is unavailable: ${maven_repo}" >&2; exit 78; }
  mkdir -p "${secret_dir}" "${evidence_dir}" "${state_root}/mqtt-it/${run_id}/config" "${state_root}/mqtt-it/${run_id}/data" \
    "${state_root}/server/temp" /tmp/infoq-deploy
  chmod 0700 "${secret_dir}"
  docker build -f "${repository_root}/script/docker/mqtt/Dockerfile" \
    -t infoq/mqtt-tools:2.1.8 "${repository_root}/script/docker/mqtt" \
    > "${evidence_dir}/mqtt-tools-build.log" 2>&1
  docker run --rm --user 0:0 \
    -e "MIDDLEWARE_RUN_ID=${run_id}" \
    -e "MIDDLEWARE_SECRET_DIR=${secret_dir}" \
    -e "MIDDLEWARE_MAVEN_REPO=${maven_repo}" \
    -e "INFOQ_DEPLOY_ROOT=${state_root}" \
    -v "${secret_dir}:/run/secrets:rw" \
    infoq/mqtt-tools:2.1.8 /opt/infoq-mqtt/prepare-run.sh \
    > "${evidence_dir}/prepare.log" 2>&1
  printf 'run_id=%s\nproject=%s\nsecret_directory=%s\nevidence_directory=%s\n' \
    "${run_id}" "infoq-mqtt-it-${run_id}" "${secret_dir}" "${evidence_dir}" > "${evidence_dir}/state.txt"
  echo "${run_id}"
}

case "${command}" in
  prepare)
    prepare
    ;;
  config)
    resolve_paths
    mkdir -p "${evidence_dir}"
    render_config
    echo "MQTT compose config passed"
    ;;
  verify)
    resolve_paths
    mkdir -p "${evidence_dir}"
    render_config
    compose up -d mqtt-security-init > "${evidence_dir}/mqtt-up.log" 2>&1
    if ! wait_for_one_shot mqtt-security-init; then
      capture_service_logs mqtt-broker
      capture_service_logs mqtt-security-init
      compose ps --all > "${evidence_dir}/mqtt-ps.txt" 2>&1
      exit 1
    fi
    record_image "emqx/emqx:5.8.9"
    wait_for_tcp 18883
    if ! run_verifier "${evidence_dir}/mqtt-verifier.log" run --rm --no-deps mqtt-verifier; then
      capture_service_logs mqtt-broker
      capture_service_logs mqtt-security-init
      compose ps --all > "${evidence_dir}/mqtt-ps.txt" 2>&1
      exit 1
    fi
    compose ps --all > "${evidence_dir}/mqtt-ps.txt" 2>&1
    capture_service_logs mqtt-broker
    capture_service_logs mqtt-security-init
    copy_surefire_reports
    ;;
  stop)
    resolve_paths
    compose down --remove-orphans > "${evidence_dir}/mqtt-down.log" 2>&1
    printf 'stopped_at=%s\n' "$(date -u -Is)" >> "${evidence_dir}/state.txt"
    ;;
  status)
    resolve_paths
    compose ps --all
    ;;
  *)
    usage
    ;;
esac