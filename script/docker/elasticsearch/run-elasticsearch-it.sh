#!/usr/bin/env bash
set -euo pipefail

command="${1:-}"
run_id="${2:-}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd "${script_dir}/../../.." && pwd)"
state_root="${INFOQ_DEPLOY_ROOT:-/infoq}"
maven_repo="${MIDDLEWARE_MAVEN_REPO:-/mnt/c/DevTools/repo}"

usage() {
  echo "Usage: run-elasticsearch-it.sh prepare [run-id] | config <run-id> | verify <run-id> | stop <run-id> | status <run-id>" >&2
  exit 64
}

require_wsl_docker() {
  grep -qi microsoft /proc/version || { echo "This verifier must run inside WSL2" >&2; exit 78; }
  docker info --format '{{.OperatingSystem}}|{{.ServerVersion}}' | grep -Eqi 'Debian.*\|' || { echo "Docker CE/Moby Debian daemon is required" >&2; exit 78; }
  docker compose version >/dev/null
}

resolve_paths() {
  [ -n "${run_id}" ] || usage
  secret_dir="${state_root}/elasticsearch-it/secrets/${run_id}"
  env_file="${secret_dir}/compose.env"
  evidence_dir="${repository_root}/doc/tmp/elasticsearch-wsl2/${run_id}"
  [ -f "${env_file}" ] || { echo "Unknown Elasticsearch run: ${run_id}" >&2; exit 66; }
}

compose() {
  docker compose --env-file "${env_file}" -p "infoq-elasticsearch-it-${run_id}" \
    -f "${repository_root}/script/docker/docker-compose.yml" \
    -f "${repository_root}/script/docker/docker-compose.elasticsearch-it.yml" "$@"
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
  local deadline=$((SECONDS + 240))
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
  local log_file="${evidence_dir}/elasticsearch-${service}.log"
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
  local output="${evidence_dir}/compose-elasticsearch.yaml"
  compose config > "${output}"
  redact "${output}"
}

copy_surefire_reports() {
  local report_dir="${repository_root}/infoq-scaffold-backend/infoq-plugin/infoq-plugin-elasticsearch/target/surefire-reports"
  [ -d "${report_dir}" ] || return 0
  mkdir -p "${evidence_dir}/elasticsearch-surefire-reports"
  while IFS= read -r report; do
    redact "${report}"
    cp "${report}" "${evidence_dir}/elasticsearch-surefire-reports/"
  done < <(find "${report_dir}" -maxdepth 1 -type f \( -name 'TEST-*.xml' -o -name '*.txt' \) -print)
}

prepare() {
  require_wsl_docker
  local created_run_id="${run_id:-$(date -u +%Y%m%d%H%M%S)-$(od -An -N4 -tx1 /dev/urandom | tr -d ' \n')}"
  run_id="${created_run_id}"
  secret_dir="${state_root}/elasticsearch-it/secrets/${run_id}"
  evidence_dir="${repository_root}/doc/tmp/elasticsearch-wsl2/${run_id}"
  [ ! -e "${secret_dir}" ] || { echo "Run already exists: ${run_id}" >&2; exit 73; }
  [ -d "${maven_repo}" ] || { echo "Maven repository is unavailable: ${maven_repo}" >&2; exit 78; }
  mkdir -p "${secret_dir}" "${evidence_dir}" "${state_root}/elasticsearch/data" \
    "${state_root}/server/temp" /tmp/infoq-deploy
  chmod 0700 "${secret_dir}"
  docker build -f "${repository_root}/script/docker/elasticsearch/Dockerfile" \
    -t infoq/elasticsearch-tools:2.1.8 "${repository_root}/script/docker/elasticsearch" \
    > "${evidence_dir}/elasticsearch-tools-build.log" 2>&1
  docker run --rm --user 0:0 \
    -e "MIDDLEWARE_RUN_ID=${run_id}" \
    -e "MIDDLEWARE_SECRET_DIR=${secret_dir}" \
    -e "MIDDLEWARE_MAVEN_REPO=${maven_repo}" \
    -e "INFOQ_DEPLOY_ROOT=${state_root}" \
    -v "${secret_dir}:/run/secrets:rw" \
    infoq/elasticsearch-tools:2.1.8 /opt/infoq-elasticsearch/prepare-run.sh \
    > "${evidence_dir}/prepare.log" 2>&1
  printf 'run_id=%s\nproject=%s\nsecret_directory=%s\nevidence_directory=%s\n' \
    "${run_id}" "infoq-elasticsearch-it-${run_id}" "${secret_dir}" "${evidence_dir}" > "${evidence_dir}/state.txt"
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
    echo "Elasticsearch compose config passed"
    ;;
  verify)
    resolve_paths
    mkdir -p "${evidence_dir}"
    render_config
    compose up -d es-security-init > "${evidence_dir}/elasticsearch-up.log" 2>&1
    if ! wait_for_one_shot es-security-init; then
      capture_service_logs elasticsearch
      capture_service_logs es-security-init
      compose ps --all > "${evidence_dir}/elasticsearch-ps.txt" 2>&1
      exit 1
    fi
    record_image "docker.elastic.co/elasticsearch/elasticsearch:8.18.8"
    if ! run_verifier "${evidence_dir}/elasticsearch-verifier.log" run --rm --no-deps es-verifier; then
      capture_service_logs elasticsearch
      capture_service_logs es-security-init
      compose ps --all > "${evidence_dir}/elasticsearch-ps.txt" 2>&1
      exit 1
    fi
    compose stop elasticsearch > "${evidence_dir}/elasticsearch-stop.log" 2>&1
    if ! run_verifier "${evidence_dir}/elasticsearch-unavailable-verifier.log" run --rm --no-deps -e INFOQ_IT_ES_EXPECT_UNAVAILABLE=true es-verifier; then
      compose ps --all > "${evidence_dir}/elasticsearch-ps.txt" 2>&1
      exit 1
    fi
    compose ps --all > "${evidence_dir}/elasticsearch-ps.txt" 2>&1
    capture_service_logs elasticsearch
    capture_service_logs es-security-init
    copy_surefire_reports
    ;;
  stop)
    resolve_paths
    compose down --remove-orphans > "${evidence_dir}/elasticsearch-down.log" 2>&1
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