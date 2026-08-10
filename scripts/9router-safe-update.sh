#!/usr/bin/env bash
set -euo pipefail

SERVICE="${SERVICE:-9router}"
APP_DIR="${APP_DIR:-/opt/minhhong-next}"
ROUTER_URL="${ROUTER_URL:-http://172.17.0.1:20128}"

log() { printf "\n==> %s\n" "$*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

read_env_value() {
  local key="$1"
  local env_file="$APP_DIR/.env"
  test -f "$env_file" || return 0
  awk -v key="$key" '
    index($0, key "=") == 1 {
      sub(/^[^=]*=/, "")
      sub(/^"/, "")
      sub(/"$/, "")
      print
      exit
    }
  ' "$env_file"
}

MODEL="${MODEL:-$(read_env_value NINE_ROUTER_MODEL)}"
MODEL="${MODEL:-cx/gpt-5.6-luna}"
router_api_key="$(read_env_value NINE_ROUTER_API_KEY)"

node_major="$(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || echo 0)"
if [ "$node_major" -lt 22 ]; then
  log "Node < 22, installing Node 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

log "Runtime versions"
node -v
npm -v

service_server="$(systemctl cat "$SERVICE" | grep -oE '/[^ ]*/node_modules/9router/app/server\.js' | head -1 || true)"
[ -n "$service_server" ] || die "Cannot find 9router app/server.js in systemd ExecStart"

service_pkg="${service_server%/app/server.js}"
case "$service_pkg" in
  */lib/node_modules/9router) service_prefix="${service_pkg%/lib/node_modules/9router}" ;;
  *) die "Unexpected 9router service path: $service_pkg" ;;
esac

log "Systemd 9router path"
echo "server: $service_server"
echo "prefix: $service_prefix"

current="$(node -p "require('$service_pkg/package.json').version" 2>/dev/null || true)"
latest="$(npm view 9router version)"
echo "9router service current: ${current:-not installed}"
echo "9router latest:          $latest"

if [ "${current:-}" != "$latest" ]; then
  log "Installing 9router@$latest into systemd prefix"
  sudo npm install -g --prefix "$service_prefix" "9router@$latest"
else
  log "9router already latest in systemd path"
fi

pkg_version="$(node -p "require('$service_pkg/package.json').version")"
app_version="$(node -p "require('$service_pkg/app/package.json').version")"
echo "service package: $pkg_version"
echo "dashboard app:   $app_version"

[ "$pkg_version" = "$latest" ] || die "Package path still not latest"
[ "$app_version" = "$latest" ] || die "Dashboard app path still not latest"

log "Restarting 9router"
sudo systemctl restart "$SERVICE"
sleep 3
sudo systemctl is-active --quiet "$SERVICE" || {
  sudo systemctl status "$SERVICE" --no-pager
  exit 1
}

log "Smoke testing $MODEL"
curl_args=(
  -sS
  -m 35
  "$ROUTER_URL/v1/chat/completions"
  -H "Content-Type: application/json"
)
if [ -n "$router_api_key" ]; then
  curl_args+=(
    -H "Authorization: Bearer $router_api_key"
    -H "x-api-key: $router_api_key"
  )
fi
resp="$(curl "${curl_args[@]}" \
  -d "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}],\"max_tokens\":20}")"

if ! echo "$resp" | grep -q '"choices"'; then
  echo "$resp"
  echo "9router smoke test FAILED. App was not restarted."
  sudo journalctl -u "$SERVICE" -n 80 --no-pager
  exit 1
fi

echo "$resp" | head -c 500
echo

log "Restarting app"
cd "$APP_DIR"
docker compose restart app
docker compose logs --since=2m app | grep -E "Chat API Error|\[9Router\]|\[chatbot:fallback\]" || echo "No fresh chatbot errors"

log "Done"
