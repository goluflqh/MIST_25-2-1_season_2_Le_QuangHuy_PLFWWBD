#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

APP_DIR="${APP_DIR:-/opt/minhhong-next}"
BACKUP_ROOT="${BACKUP_ROOT:-/opt/minhhong-backups}"
DOCKER="${DOCKER:-docker}"
DUMP_DIR="$BACKUP_ROOT/dumps"
LOG_DIR="$BACKUP_ROOT/logs"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="minhhong-db-$STAMP.dump"

RCLONE="${RCLONE:-/usr/bin/rclone}"
RCLONE_CONFIG="${RCLONE_CONFIG:-/home/deploy/.config/rclone/rclone.conf}"
REMOTE="${REMOTE:-gbackup:vps-db}"
MAX_UPLOAD_ATTEMPTS="${BACKUP_MAX_UPLOAD_ATTEMPTS:-5}"
INITIAL_BACKOFF_SECONDS="${BACKUP_INITIAL_BACKOFF_SECONDS:-30}"

if ! [[ "$MAX_UPLOAD_ATTEMPTS" =~ ^[1-9][0-9]*$ ]]; then
  echo "ERROR: BACKUP_MAX_UPLOAD_ATTEMPTS must be a positive integer" >&2
  exit 2
fi
if ! [[ "$INITIAL_BACKOFF_SECONDS" =~ ^[0-9]+$ ]]; then
  echo "ERROR: BACKUP_INITIAL_BACKOFF_SECONDS must be a non-negative integer" >&2
  exit 2
fi

mkdir -p "$DUMP_DIR" "$LOG_DIR"

cd "$APP_DIR"

"$DOCKER" exec minhhong-postgres-prod pg_dump \
  -U minhhong \
  -d minhhong_next \
  --format=custom \
  --file="/tmp/$FILE"

"$DOCKER" cp "minhhong-postgres-prod:/tmp/$FILE" "$DUMP_DIR/$FILE"
"$DOCKER" exec minhhong-postgres-prod rm -f "/tmp/$FILE"

is_rate_limit_error() {
  grep -Eqi 'rateLimitExceeded|RATE_LIMIT_EXCEEDED|quota exceeded' "$1"
}

alert_rate_limit() {
  local message="ALERT: rclone upload rateLimitExceeded after $MAX_UPLOAD_ATTEMPTS attempts for $FILE; local dump preserved at $DUMP_DIR/$FILE"
  printf '%s\n' "$message" >&2
  if command -v logger >/dev/null 2>&1; then
    logger -t minhhong-backup -- "$message" || true
  fi
}

upload_with_backoff() {
  local attempt=1
  local delay="$INITIAL_BACKOFF_SECONDS"
  local output_file
  output_file="$(mktemp "$LOG_DIR/rclone-upload.XXXXXX.log")"

  while (( attempt <= MAX_UPLOAD_ATTEMPTS )); do
    : > "$output_file"
    if "$RCLONE" --config "$RCLONE_CONFIG" copy "$DUMP_DIR/$FILE" "$REMOTE" --transfers 1 --checkers 4 >"$output_file" 2>&1; then
      cat "$output_file"
      rm -f -- "$output_file"
      return 0
    fi

    cat "$output_file" >&2
    if ! is_rate_limit_error "$output_file"; then
      printf 'ERROR: rclone upload failed without rateLimitExceeded; not retrying.\n' >&2
      rm -f -- "$output_file"
      return 1
    fi

    if (( attempt == MAX_UPLOAD_ATTEMPTS )); then
      break
    fi

    printf 'WARN: rclone upload rateLimitExceeded (attempt %s/%s); retrying in %ss.\n' \
      "$attempt" "$MAX_UPLOAD_ATTEMPTS" "$delay" >&2
    if (( delay > 0 )); then
      sleep "$delay"
    fi
    attempt=$((attempt + 1))
    delay=$((delay * 2))
  done

  alert_rate_limit
  rm -f -- "$output_file"
  return 1
}

upload_with_backoff
"$RCLONE" --config "$RCLONE_CONFIG" delete "$REMOTE" --min-age 90d --include "minhhong-db-*.dump"
"$RCLONE" --config "$RCLONE_CONFIG" rmdirs "$REMOTE" --leave-root

echo "Backup OK: $DUMP_DIR/$FILE"
echo "Upload OK: $REMOTE/$FILE"
