#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-db.sh"
TEST_ROOT="$(mktemp -d)"

cleanup() {
  rm -rf -- "$TEST_ROOT"
}
trap cleanup EXIT

make_fake_docker() {
  local bin_dir="$1"
  cat > "$bin_dir/docker" <<'FAKE_DOCKER'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "exec" && "${3:-}" == "pg_dump" ]]; then
  dump_path=""
  for arg in "$@"; do
    case "$arg" in
      --file=*) dump_path="${arg#--file=}" ;;
    esac
  done
  test -n "$dump_path"
  printf 'fake-postgres-dump\n' > "$dump_path"
  exit 0
fi

if [[ "${1:-}" == "exec" && "${3:-}" == "rm" ]]; then
  rm -f -- "${5:?missing dump path}"
  exit 0
fi

if [[ "${1:-}" == "cp" ]]; then
  cp -- "${2#*:}" "$3"
  exit 0
fi

echo "unexpected docker invocation: $*" >&2
exit 1
FAKE_DOCKER
  chmod +x "$bin_dir/docker"
}

make_fake_rclone() {
  local bin_dir="$1"
  cat > "$bin_dir/rclone" <<'FAKE_RCLONE'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--config" ]]; then
  shift 2
fi

command="${1:-}"
if [[ "$command" == "copy" ]]; then
  calls_file="${FAKE_RCLONE_CALLS_FILE:?missing call counter}"
  calls="$(cat "$calls_file" 2>/dev/null || printf '0')"
  calls=$((calls + 1))
  printf '%s\n' "$calls" > "$calls_file"
  if (( calls <= FAKE_RCLONE_FAILS )); then
    printf 'googleapi: Error 403: rateLimitExceeded\n' >&2
    exit 1
  fi
  printf 'fake upload succeeded\n'
  exit 0
fi

if [[ "$command" == "delete" || "$command" == "rmdirs" ]]; then
  exit 0
fi

echo "unexpected rclone invocation: $*" >&2
exit 1
FAKE_RCLONE
  chmod +x "$bin_dir/rclone"
}

run_case() {
  local case_name="$1"
  local failures="$2"
  local max_attempts="$3"
  local expect_success="$4"
  local case_root="$TEST_ROOT/$case_name"
  local bin_dir="$case_root/bin"
  local app_dir="$case_root/app"
  local backup_root="$case_root/backups"
  local log_file="$case_root/run.log"
  local calls_file="$case_root/rclone-calls"
  mkdir -p "$bin_dir" "$app_dir" "$backup_root/dumps" "$backup_root/logs"
  : > "$calls_file"
  printf 'old-local-dump\n' > "$backup_root/dumps/minhhong-db-old.dump"
  touch -t 202001010000 "$backup_root/dumps/minhhong-db-old.dump"
  printf 'unused-config\n' > "$case_root/rclone.conf"
  make_fake_docker "$bin_dir"
  make_fake_rclone "$bin_dir"

  export APP_DIR="$app_dir"
  export BACKUP_ROOT="$backup_root"
  export DOCKER="$bin_dir/docker"
  export RCLONE="$bin_dir/rclone"
  export RCLONE_CONFIG="$case_root/rclone.conf"
  export FAKE_RCLONE_CALLS_FILE="$calls_file"
  export FAKE_RCLONE_FAILS="$failures"
  export BACKUP_MAX_UPLOAD_ATTEMPTS="$max_attempts"
  export BACKUP_INITIAL_BACKOFF_SECONDS=1

  if [[ "$expect_success" == "yes" ]]; then
    if ! "$BACKUP_SCRIPT" > "$log_file" 2>&1; then
      cat "$log_file"
      echo "backup success case failed" >&2
      exit 1
    fi
    grep -q 'Upload OK:' "$log_file"
    grep -q 'retrying in 1s' "$log_file"
    grep -q 'retrying in 2s' "$log_file"
  else
    if "$BACKUP_SCRIPT" > "$log_file" 2>&1; then
      cat "$log_file"
      echo "backup failure case unexpectedly succeeded" >&2
      exit 1
    fi
    grep -q 'ALERT: rclone upload rateLimitExceeded' "$log_file"
  fi

  test -f "$backup_root/dumps/minhhong-db-old.dump"
  test "$(cat "$calls_file")" = "$max_attempts"
  test "$(find "$backup_root/dumps" -maxdepth 1 -name 'minhhong-db-*.dump' -type f | wc -l)" -ge 2
}

run_case retries-then-success 2 3 yes
run_case retries-exhausted 3 3 no
printf 'backup-db regression tests passed\n'
