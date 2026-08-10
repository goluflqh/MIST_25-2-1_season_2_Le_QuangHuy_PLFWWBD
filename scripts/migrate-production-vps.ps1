param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("bootstrap", "setup", "preflight", "prepare", "sync", "9router", "backup", "verify", "cutover", "rollback")]
  [string]$Phase,
  [string]$SourceHost = "165.22.247.29",
  [string]$TargetHost = "43.133.33.85",
  [string]$SshUser = "deploy",
  [string]$IdentityFile = "$HOME\.ssh\minhhong_codex_deploy",
  [string]$TargetKnownHostsFile = "$env:TEMP\minhhong-tencent-known-hosts-codex",
  [string]$ExpectedTargetHostKeySha256 = "SHA256:DAT/yfuEShbJPojfyTiJgDtvuwM/uNkr4d/l3S6AQ9E",
  [string]$RepositoryUrl = "https://github.com/goluflqh/MIST_25-2-1_season_2_Le_QuangHuy_PLFWWBD.git",
  [string]$TargetHostname = "minhhong-tencent-sgp1",
  [string]$SiteDomain = "minhhongdanang.page",
  [string]$PowerShellProfilePath = $PROFILE.CurrentUserCurrentHost,
  [switch]$AllowTargetRestore,
  [switch]$ConfirmCutover,
  [switch]$ConfirmRollback
)

$ErrorActionPreference = "Stop"
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$projectPath = "/opt/minhhong-next"
$transferRoot = Join-Path $env:TEMP "minhhong-vps-migration"
$sourceSsh = @(
  "-o", "BatchMode=yes",
  "-o", "ConnectTimeout=15",
  "-o", "StrictHostKeyChecking=yes",
  "-i", $IdentityFile
)
$targetSsh = @(
  "-o", "BatchMode=yes",
  "-o", "ConnectTimeout=15",
  "-o", "StrictHostKeyChecking=yes",
  "-o", "UserKnownHostsFile=$TargetKnownHostsFile",
  "-i", $IdentityFile
)

function Assert-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Thieu lenh bat buoc: $Name"
  }
}

function Set-WindowsNineRouterVpsHost([string]$HostName) {
  if (-not (Test-Path -LiteralPath $PowerShellProfilePath)) {
    throw "Khong tim thay PowerShell profile: $PowerShellProfilePath"
  }
  $content = Get-Content -Raw -LiteralPath $PowerShellProfilePath
  $pattern = '(?m)^(\s*ssh\s+-N[^\r\n]*-L\s+127\.0\.0\.1:22129:172\.18\.0\.1:20128\s+deploy@)\S+\s*$'
  $matches = [regex]::Matches($content, $pattern)
  if ($matches.Count -ne 1) {
    throw "Khong tim thay duy nhat mot lenh tunnel 9router-vps port 22129 trong PowerShell profile."
  }
  $updated = [regex]::Replace(
    $content,
    $pattern,
    { param($match) $match.Groups[1].Value + $HostName }
  )
  [IO.File]::WriteAllText($PowerShellProfilePath, $updated, [Text.UTF8Encoding]::new($false))
  Write-Output "WINDOWS_9ROUTER_VPS_HOST=$HostName"
}

function Invoke-Ssh(
  [ValidateSet("source", "target")][string]$Server,
  [string]$Command
) {
  $hostName = if ($Server -eq "source") { $SourceHost } else { $TargetHost }
  $arguments = if ($Server -eq "source") { $sourceSsh } else { $targetSsh }
  $encodedCommand = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Command))
  & ssh @arguments "$SshUser@$hostName" "echo $encodedCommand | base64 -d | bash"
  if ($LASTEXITCODE -ne 0) {
    throw "SSH $Server that bai (exit $LASTEXITCODE)."
  }
}

function Copy-FromServer(
  [ValidateSet("source", "target")][string]$Server,
  [string]$RemotePath,
  [string]$LocalPath
) {
  $hostName = if ($Server -eq "source") { $SourceHost } else { $TargetHost }
  $arguments = if ($Server -eq "source") { $sourceSsh } else { $targetSsh }
  & scp @arguments "$SshUser@$hostName`:$RemotePath" $LocalPath
  if ($LASTEXITCODE -ne 0) {
    throw "Tai file tu $Server that bai (exit $LASTEXITCODE)."
  }
}

function Copy-ToTarget([string]$LocalPath, [string]$RemotePath) {
  & scp @targetSsh $LocalPath "$SshUser@$TargetHost`:$RemotePath"
  if ($LASTEXITCODE -ne 0) {
    throw "Tai file len target that bai (exit $LASTEXITCODE)."
  }
}

function Assert-LocalSshPrerequisites {
  Assert-Command "ssh"
  Assert-Command "scp"
  Assert-Command "ssh-keygen"

  if (-not (Test-Path -LiteralPath $IdentityFile)) {
    throw "Khong tim thay private key: $IdentityFile"
  }
  if (-not (Test-Path -LiteralPath $TargetKnownHostsFile)) {
    throw "Chua co target known-hosts: $TargetKnownHostsFile"
  }
  $targetHostKey = & ssh-keygen -lf $TargetKnownHostsFile
  if ($LASTEXITCODE -ne 0 -or $targetHostKey -notmatch [regex]::Escape($ExpectedTargetHostKeySha256)) {
    throw "Host key target khong khop fingerprint da xac minh: $ExpectedTargetHostKeySha256"
  }
}

function Invoke-BootstrapTarget {
  Assert-LocalSshPrerequisites
  if ($RepositoryUrl -notmatch '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+\.git$') {
    throw "RepositoryUrl khong dung dinh dang GitHub HTTPS duoc ho tro."
  }
  if ($TargetHostname -notmatch '^[A-Za-z0-9.-]+$' -or $SiteDomain -notmatch '^[A-Za-z0-9.-]+$') {
    throw "TargetHostname/SiteDomain khong hop le."
  }

  Invoke-Ssh "target" "id -u; sudo -n true; test -f /etc/os-release"
  $bootstrapPath = Join-Path $PSScriptRoot "bootstrap-target-vps.sh"
  if (-not (Test-Path -LiteralPath $bootstrapPath)) {
    throw "Khong tim thay bootstrap script: $bootstrapPath"
  }
  Copy-ToTarget $bootstrapPath "/tmp/bootstrap-target-vps.sh"
  Invoke-Ssh "target" "chmod 700 /tmp/bootstrap-target-vps.sh && REPOSITORY_URL='$RepositoryUrl' TARGET_HOSTNAME='$TargetHostname' SITE_DOMAIN='$SiteDomain' /tmp/bootstrap-target-vps.sh && rm -f /tmp/bootstrap-target-vps.sh"

  $runPath = Join-Path $transferRoot ("bootstrap-env-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
  New-Item -ItemType Directory -Force -Path $runPath | Out-Null
  $envPath = Join-Path $runPath "minhhong-production.env"
  Copy-FromServer "source" "/opt/minhhong-next/.env" $envPath
  Copy-ToTarget $envPath "/tmp/minhhong-production.env"
  Invoke-Ssh "target" "install -m 600 /tmp/minhhong-production.env /opt/minhhong-next/.env && rm -f /tmp/minhhong-production.env"
  Remove-Item -LiteralPath $envPath -Force
  Write-Output "TARGET_BOOTSTRAP_ENV_READY"
}

function Invoke-Preflight {
  Assert-LocalSshPrerequisites

  Write-Output "Kiem tra DigitalOcean..."
  Invoke-Ssh "source" @'
set -eu
test "$(hostname)" != ""
test -d /opt/minhhong-next
cd /opt/minhhong-next
test -f .env
if test "$(stat -c %a .env)" != "600"; then
  printf 'WARNING_SOURCE_ENV_PERMISSIONS=%s\n' "$(stat -c %a .env)"
fi
docker compose ps --status running --services | grep -qx postgres
docker compose ps --status running --services | grep -qx app
systemctl is-active --quiet 9router.service
systemctl is-active --quiet caddy
printf 'SOURCE_READY\n'
'@

  Write-Output "Kiem tra Tencent..."
  Invoke-Ssh "target" @'
set -eu
test -d /opt/minhhong-next
cd /opt/minhhong-next
test -f .env
test "$(stat -c %a .env)" = "600"
command -v docker >/dev/null
docker compose version >/dev/null
command -v caddy >/dev/null
if command -v tool-import-9router >/dev/null 2>&1 || systemctl list-unit-files --type=service --no-legend | awk '{print $1}' | grep -qx 'tool-import-9router.service'; then
  printf 'tool-import-9router must remain absent\n' >&2
  exit 1
fi
test "$(systemctl is-active caddy 2>/dev/null || true)" != "active"
printf 'TARGET_READY\n'
'@
}

function Invoke-PrepareTarget {
  Invoke-Ssh "target" @'
set -eu
cd /opt/minhhong-next
git fetch origin main
git checkout main
git pull --ff-only origin main
sudo install -d -o deploy -g deploy -m 700 /opt/minhhong-next/backups/migration
sudo systemctl disable --now caddy >/dev/null 2>&1 || true
sudo systemctl disable --now 9router.service >/dev/null 2>&1 || true
docker compose config --quiet
printf 'TARGET_PREPARED_CADDY_OFF\n'
'@
}

function Sync-ProductionData {
  if (-not $AllowTargetRestore) {
    throw "Phase nay ghi de database/.env/9router tren target. Chay lai voi -AllowTargetRestore."
  }

  $runId = Get-Date -Format "yyyyMMdd-HHmmss"
  $runPath = Join-Path $transferRoot $runId
  New-Item -ItemType Directory -Force -Path $runPath | Out-Null

  Write-Output "Tao snapshot production tren DigitalOcean..."
  Invoke-Ssh "source" @'
set -eu
cd /opt/minhhong-next
rm -f /tmp/minhhong-migration.dump /tmp/minhhong-production.env /tmp/minhhong-9router.tgz
docker exec minhhong-postgres-prod pg_dump -U minhhong -d minhhong_next --format=custom > /tmp/minhhong-migration.dump
cp .env /tmp/minhhong-production.env
chmod 600 /tmp/minhhong-production.env
if test -d /home/deploy/.9router; then
  tar -C /home/deploy -czf /tmp/minhhong-9router.tgz .9router
fi
printf 'SOURCE_SNAPSHOT_READY\n'
'@

  $dumpPath = Join-Path $runPath "minhhong-migration.dump"
  $envPath = Join-Path $runPath "minhhong-production.env"
  $routerPath = Join-Path $runPath "minhhong-9router.tgz"
  Copy-FromServer "source" "/tmp/minhhong-migration.dump" $dumpPath
  Copy-FromServer "source" "/tmp/minhhong-production.env" $envPath

  $hasRouterArchive = $true
  try {
    Copy-FromServer "source" "/tmp/minhhong-9router.tgz" $routerPath
  } catch {
    $hasRouterArchive = $false
    Write-Warning "Khong co archive 9router tren source; bo qua phan du lieu 9router."
  }

  Copy-ToTarget $dumpPath "/tmp/minhhong-migration.dump"
  Copy-ToTarget $envPath "/tmp/minhhong-production.env"
  if ($hasRouterArchive) {
    Copy-ToTarget $routerPath "/tmp/minhhong-9router.tgz"
  }

  $restoreCommand = if ($hasRouterArchive) {
    @'
set -eu
cd /opt/minhhong-next
install -m 600 /tmp/minhhong-production.env .env
sed -i 's#^NINE_ROUTER_BASE_URL=.*#NINE_ROUTER_BASE_URL="http://172.18.0.1:20128/v1"#' .env
docker compose up -d postgres
until docker exec minhhong-postgres-prod pg_isready -U minhhong -d minhhong_next >/dev/null 2>&1; do sleep 2; done
docker cp /tmp/minhhong-migration.dump minhhong-postgres-prod:/tmp/minhhong-migration.dump
docker exec minhhong-postgres-prod pg_restore -U minhhong -d minhhong_next --clean --if-exists --no-owner /tmp/minhhong-migration.dump
if test -d /home/deploy/.9router; then
  mv /home/deploy/.9router "/home/deploy/.9router.before-migration-$(date +%Y%m%d-%H%M%S)"
fi
tar -C /home/deploy -xzf /tmp/minhhong-9router.tgz
chown -R deploy:deploy /home/deploy/.9router
docker compose build app migrate
docker compose --profile migrate run --rm -T migrate
docker compose up -d app
sudo ufw allow in on br-05661dc37f3f from 172.18.0.0/16 to 172.18.0.1 port 20128 proto tcp comment 'Docker to 9router' >/dev/null
sudo systemctl enable --now 9router.service
printf 'TARGET_DATA_RESTORED\n'
'@
  } else {
    @'
set -eu
cd /opt/minhhong-next
install -m 600 /tmp/minhhong-production.env .env
sed -i 's#^NINE_ROUTER_BASE_URL=.*#NINE_ROUTER_BASE_URL="http://172.18.0.1:20128/v1"#' .env
docker compose up -d postgres
until docker exec minhhong-postgres-prod pg_isready -U minhhong -d minhhong_next >/dev/null 2>&1; do sleep 2; done
docker cp /tmp/minhhong-migration.dump minhhong-postgres-prod:/tmp/minhhong-migration.dump
docker exec minhhong-postgres-prod pg_restore -U minhhong -d minhhong_next --clean --if-exists --no-owner /tmp/minhhong-migration.dump
docker compose build app migrate
docker compose --profile migrate run --rm -T migrate
docker compose up -d app
printf 'TARGET_DATA_RESTORED_WITHOUT_9ROUTER_ARCHIVE\n'
'@
  }

  Invoke-Ssh "target" $restoreCommand
  Invoke-Ssh "source" "rm -f /tmp/minhhong-migration.dump /tmp/minhhong-production.env /tmp/minhhong-9router.tgz"
  Invoke-Ssh "target" "rm -f /tmp/minhhong-migration.dump /tmp/minhhong-production.env /tmp/minhhong-9router.tgz"
  Remove-Item -LiteralPath $envPath -Force
  if (Test-Path -LiteralPath $routerPath) {
    Remove-Item -LiteralPath $routerPath -Force
  }
  Write-Output "Ban sao cuc bo tam duoc giu tai: $runPath"
}

function Sync-BackupAutomation {
  $runId = Get-Date -Format "yyyyMMdd-HHmmss"
  $runPath = Join-Path $transferRoot "backup-$runId"
  New-Item -ItemType Directory -Force -Path $runPath | Out-Null

  $backupScriptPath = Join-Path $PSScriptRoot "backup-db.sh"
  $rcloneConfigPath = Join-Path $runPath "rclone.conf"
  if (-not (Test-Path -LiteralPath $backupScriptPath)) {
    throw "Khong tim thay backup script trong repo: $backupScriptPath"
  }
  Copy-FromServer "source" "/home/deploy/.config/rclone/rclone.conf" $rcloneConfigPath
  Copy-ToTarget $backupScriptPath "/tmp/minhhong-backup-db.sh"
  Copy-ToTarget $rcloneConfigPath "/tmp/minhhong-rclone.conf"

  Invoke-Ssh "target" @'
set -eu
if ! command -v rclone >/dev/null 2>&1; then
  sudo apt-get update
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y rclone
fi
sudo install -d -o deploy -g deploy -m 750 /opt/minhhong-backups
sudo install -d -o deploy -g deploy -m 750 /opt/minhhong-backups/dumps
sudo install -d -o deploy -g deploy -m 750 /opt/minhhong-backups/logs
sudo install -d -o deploy -g deploy -m 700 /home/deploy/.config/rclone
sudo install -o deploy -g deploy -m 750 /tmp/minhhong-backup-db.sh /opt/minhhong-backups/backup-db.sh
sudo install -o deploy -g deploy -m 600 /tmp/minhhong-rclone.conf /home/deploy/.config/rclone/rclone.conf
{
  crontab -l 2>/dev/null | grep -v '/opt/minhhong-backups/backup-db.sh' || true
  printf '30 9 * * * /opt/minhhong-backups/backup-db.sh >> /opt/minhhong-backups/logs/cron.log 2>&1\n'
} | crontab -
/opt/minhhong-backups/backup-db.sh
rclone --config /home/deploy/.config/rclone/rclone.conf lsf gbackup:vps-db --max-depth 1 | tail -5
rm -f /tmp/minhhong-backup-db.sh /tmp/minhhong-rclone.conf
printf 'TARGET_BACKUP_VERIFIED\n'
'@

  Remove-Item -LiteralPath $rcloneConfigPath -Force
}

function Sync-NineRouterTooling {
  $runId = Get-Date -Format "yyyyMMdd-HHmmss"
  $runPath = Join-Path $transferRoot "9router-$runId"
  New-Item -ItemType Directory -Force -Path $runPath | Out-Null

  $updaterPath = Join-Path $PSScriptRoot "9router-safe-update.sh"
  if (-not (Test-Path -LiteralPath $updaterPath)) {
    throw "Khong tim thay updater trong repo: $updaterPath"
  }
  Copy-ToTarget $updaterPath "/tmp/9router-safe-update"
  Invoke-Ssh "target" @'
set -eu
sudo install -o root -g root -m 755 /tmp/9router-safe-update /usr/local/bin/9router-safe-update
if ! grep -qxF "alias 9router-update='9router-safe-update'" /home/deploy/.bashrc; then
  printf "\nalias 9router-update='9router-safe-update'\n" >> /home/deploy/.bashrc
fi
rm -f /tmp/9router-safe-update
grep -qxF "alias 9router-update='9router-safe-update'" /home/deploy/.bashrc
printf 'TARGET_9ROUTER_TOOLING_READY\n'
'@
}

function Invoke-VerifyTarget {
  Invoke-Ssh "target" @'
set -eu
cd /opt/minhhong-next
docker compose ps
docker compose ps --status running --services | grep -qx postgres
docker compose ps --status running --services | grep -qx app
curl --fail --silent --show-error --max-time 20 http://127.0.0.1:3000/ >/dev/null
test "$(systemctl is-active caddy 2>/dev/null || true)" != "active"
if systemctl list-unit-files 9router.service >/dev/null 2>&1; then
  systemctl is-active --quiet 9router.service
  ss -ltn | grep -q ':20128 '
fi
printf 'TARGET_VERIFIED_CADDY_OFF\n'
'@
}

function Invoke-Cutover {
  if (-not $ConfirmCutover) {
    throw "Cutover dung app production cu. Chay lai voi -ConfirmCutover sau khi da chot cua so chuyen."
  }
  if (-not $AllowTargetRestore) {
    throw "Cutover can -AllowTargetRestore de khoi phuc snapshot cuoi tren target."
  }

  Invoke-Ssh "source" "cd $projectPath && docker compose stop app"
  try {
    Sync-ProductionData
    Invoke-VerifyTarget
    Invoke-Ssh "target" "sudo systemctl enable --now caddy && systemctl is-active --quiet caddy"
    Set-WindowsNineRouterVpsHost $TargetHost
  } catch {
    Write-Warning "Cutover loi; khoi dong lai app DigitalOcean."
    Invoke-Ssh "source" "cd $projectPath && docker compose up -d app"
    throw
  }

  Write-Output "TARGET_LIVE_READY. Hay doi DNS A record sang $TargetHost, sau do kiem tra public."
  Write-Output "Chua xoa hoac tat database DigitalOcean; rollback van san sang."
}

function Invoke-Rollback {
  if (-not $ConfirmRollback) {
    throw "Rollback thay doi service dang chay. Chay lai voi -ConfirmRollback."
  }

  Invoke-Ssh "target" "sudo systemctl disable --now caddy || true"
  Invoke-Ssh "source" "cd $projectPath && docker compose up -d app && sudo systemctl enable --now caddy"
  Set-WindowsNineRouterVpsHost $SourceHost
  Write-Output "SOURCE_RESTORED. Neu DNS da doi, tro A record lai $SourceHost."
}

switch ($Phase) {
  "bootstrap" { Invoke-BootstrapTarget; Invoke-Preflight }
  "setup" {
    if (-not $AllowTargetRestore) {
      throw "Full setup restore du lieu target. Chay lai voi -AllowTargetRestore."
    }
    Invoke-BootstrapTarget
    Invoke-Preflight
    Invoke-PrepareTarget
    Sync-ProductionData
    Sync-NineRouterTooling
    Sync-BackupAutomation
    Invoke-VerifyTarget
  }
  "preflight" { Invoke-Preflight }
  "prepare" { Invoke-Preflight; Invoke-PrepareTarget }
  "sync" { Invoke-Preflight; Sync-ProductionData; Sync-NineRouterTooling; Sync-BackupAutomation; Invoke-VerifyTarget }
  "9router" { Invoke-Preflight; Sync-NineRouterTooling }
  "backup" { Invoke-Preflight; Sync-BackupAutomation }
  "verify" { Invoke-VerifyTarget }
  "cutover" { Invoke-Preflight; Invoke-Cutover }
  "rollback" { Invoke-Rollback }
}
