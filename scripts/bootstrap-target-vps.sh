#!/usr/bin/env bash
set -euo pipefail

REPOSITORY_URL="${REPOSITORY_URL:?REPOSITORY_URL is required}"
TARGET_HOSTNAME="${TARGET_HOSTNAME:-minhhong-target}"
SITE_DOMAIN="${SITE_DOMAIN:-minhhongdanang.page}"
PROJECT_DIR="/opt/minhhong-next"

log() { printf "\n==> %s\n" "$*"; }

log "Base operating system"
sudo hostnamectl set-hostname "$TARGET_HOSTNAME"
sudo timedatectl set-timezone Asia/Ho_Chi_Minh
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates curl git gnupg ufw fail2ban debian-keyring \
  debian-archive-keyring apt-transport-https

if ! swapon --show --noheadings | grep -q .; then
  log "Creating 2 GB swap"
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker Engine"
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $VERSION_CODENAME stable" |
    sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
sudo usermod -aG docker deploy
sudo systemctl enable --now docker

node_major="$(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || echo 0)"
if [ "$node_major" -lt 22 ]; then
  log "Installing Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
fi

if ! command -v caddy >/dev/null 2>&1; then
  log "Installing Caddy"
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key |
    sudo gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt |
    sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  sudo chmod o+r /etc/apt/sources.list.d/caddy-stable.list
  sudo apt-get update
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y caddy
fi

if ! command -v 9router >/dev/null 2>&1; then
  log "Installing native 9router"
  sudo npm install -g 9router@latest
fi

log "Preparing repository"
sudo install -d -o deploy -g deploy -m 755 "$PROJECT_DIR"
if [ ! -d "$PROJECT_DIR/.git" ]; then
  git clone "$REPOSITORY_URL" "$PROJECT_DIR"
fi
cd "$PROJECT_DIR"
git fetch origin main
git checkout main
git pull --ff-only origin main

log "Preparing native 9router service"
router_root="$(npm root -g)/9router"
test -f "$router_root/app/server.js"
sudo tee /etc/systemd/system/9router.service >/dev/null <<EOF
[Unit]
Description=9router AI proxy
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service

[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=$router_root/app
Environment=HOME=/home/deploy
Environment=DATA_DIR=/home/deploy/.9router
Environment=NODE_ENV=production
Environment=PORT=20128
Environment=HOSTNAME=172.18.0.1
ExecStart=/usr/bin/node $router_root/app/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

log "Preparing Caddy"
sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
$SITE_DOMAIN {
  reverse_proxy 127.0.0.1:3000
}

www.$SITE_DOMAIN {
  redir https://$SITE_DOMAIN{uri} permanent
}
EOF
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile

log "Firewall and services"
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo systemctl enable --now fail2ban
sudo systemctl daemon-reload
sudo systemctl disable --now caddy >/dev/null 2>&1 || true
sudo systemctl disable --now 9router.service >/dev/null 2>&1 || true

printf '\nTARGET_BOOTSTRAP_READY\n'
docker --version || sudo docker --version
docker compose version || sudo docker compose version
node --version
9router --version
caddy version
