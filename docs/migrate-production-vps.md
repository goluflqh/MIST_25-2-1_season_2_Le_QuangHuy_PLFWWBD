# Migrate production VPS

Pipeline nay chuyen `minhhong-next` tu DigitalOcean sang Tencent Lighthouse. Mac dinh no khong dung production cu va khong doi DNS.

`tool-import-9router` da ngung su dung va khong nam trong pipeline. Native `9router` van duoc chuyen bang thu muc `/home/deploy/.9router` va service `9router.service`.
Pipeline cai [script updater](../scripts/9router-safe-update.sh) thanh `/usr/local/bin/9router-safe-update` va tao alias Termius/bash `9router-update` tren target. Updater doc model/API key tu `.env`, nang dung package path cua systemd, smoke test co xac thuc, roi moi restart app.

Co the dong bo rieng tooling/alias 9router bang:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/migrate-production-vps.ps1 -Phase 9router
```

## Tu VPS moi den target san sang

### Phan nguoi dung phai lam tren giao dien nha cung cap

1. Tao/nhan VPS Ubuntu 22.04 hoac 24.04, ghi lai IP, ngay het han va gioi han bang thong.
2. Mo inbound TCP `22`, `80`, `443`. Khong mo `3000`, `5433`, `20128` ra Internet.
3. Qua web console/Termius ban dau, tao user `deploy`, cap `sudo` khong can password va them public key automation:

```bash
id deploy >/dev/null 2>&1 || sudo adduser --disabled-password --gecos '' deploy
sudo usermod -aG sudo deploy
echo 'deploy ALL=(ALL) NOPASSWD:ALL' | sudo tee /etc/sudoers.d/90-deploy >/dev/null
sudo chmod 440 /etc/sudoers.d/90-deploy
sudo install -d -o deploy -g deploy -m 700 /home/deploy/.ssh
echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBNYtCRkHTLpoRkquIPd9QhEGG0OWQpKRCYvzMUXqjK/ codex-minhhong-vps' | sudo tee -a /home/deploy/.ssh/authorized_keys >/dev/null
sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

4. Lay fingerprint tren console VPS va so sanh truoc khi tin host:

```bash
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

5. Tren Windows, ket noi lan dau vao mot known-hosts rieng. Thay IP/fingerprint khi tao VPS khac:

```powershell
ssh -v -o StrictHostKeyChecking=accept-new `
  -o UserKnownHostsFile="$env:TEMP\minhhong-target-known-hosts" `
  -i "$HOME\.ssh\minhhong_codex_deploy" deploy@NEW_IP hostname
```

### Phan pipeline tu dong

Tu root repo, mot lenh `setup` se tu dong lam toan bo phan con lai:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/migrate-production-vps.ps1 `
  -Phase setup `
  -TargetHost NEW_IP `
  -TargetKnownHostsFile "$env:TEMP\minhhong-target-known-hosts" `
  -ExpectedTargetHostKeySha256 'SHA256:FINGERPRINT_DA_SO_SANH' `
  -TargetHostname 'minhhong-target-sgp1' `
  -AllowTargetRestore
```

Pipeline se tu dong:

- Dat hostname, timezone `Asia/Ho_Chi_Minh`, tao swap 2 GB.
- Cai Docker Engine/Compose, Node.js 22, Caddy, UFW, fail2ban va native 9router.
- Chi mo `22/80/443`; bind app/PostgreSQL/9router vao dia chi private/localhost.
- Clone `main` vao `/opt/minhhong-next` va copy `.env` production quyen `600`.
- Chuan bi service 9router va Caddy nhung giu Caddy target tat.
- Dump PostgreSQL source, chuyen `.env` va `/home/deploy/.9router`, restore/build/migrate/start target.
- Cai `9router-safe-update` va alias Termius `9router-update`.
- Chuyen `rclone crypt`, tao backup Google Drive luc 09:30 va chay backup thu.
- Verify app HTTP, PostgreSQL, 9router va xac nhan Caddy target van tat.

Pipeline khong cai/chuyen `tool-import-9router`, khong doi DNS va khong dung production cu trong phase `setup`.

## Cac phase

Neu muon chay tung phan thay vi `setup`, dung cac phase duoi day.

Bootstrap he dieu han/source/.env, chua restore database:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/migrate-production-vps.ps1 -Phase bootstrap
```

Chay tu root repo tren Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/migrate-production-vps.ps1 -Phase preflight
```

Cap nhat source target, giu Caddy va 9router tat:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/migrate-production-vps.ps1 -Phase prepare
```

Chup database/.env/9router tu production, khoi phuc va build target. Production cu van chay:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/migrate-production-vps.ps1 -Phase sync -AllowTargetRestore
```

Phase `sync` cung chuyen script backup PostgreSQL va cau hinh `rclone crypt`, dat lich 09:30 theo timezone `Asia/Ho_Chi_Minh`, roi chay mot backup thu len Google Drive. Co the chay rieng phan nay:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/migrate-production-vps.ps1 -Phase backup
```

Kiem tra target qua localhost; Caddy phai van tat:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/migrate-production-vps.ps1 -Phase verify
```

## Cutover

Chi chay khi da chot thoi gian chuyen. Phase nay dung app DigitalOcean, lay snapshot cuoi, khoi phuc target, kiem tra, roi bat Caddy Tencent:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/migrate-production-vps.ps1 -Phase cutover -AllowTargetRestore -ConfirmCutover
```

Sau khi lenh thanh cong, doi DNS A record cua `minhhongdanang.page` va `www` sang `43.133.33.85`, kiem tra public, sau do moi can nhac tat VPS cu. Pipeline khong tu dong doi DNS vi quyen nha cung cap DNS chua duoc cau hinh.

Cutover cung tu dong doi function PowerShell `9router-vps` (port local `22129`) sang target. Function `9router-vps-new` (port `22130`) duoc giu de kiem tra Tencent truoc cutover. Rollback tu dong doi `9router-vps` ve source.

Neu can quay lai, doi DNS ve `165.22.247.29` va chay:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/migrate-production-vps.ps1 -Phase rollback -ConfirmRollback
```

Khong xoa VPS/volume DigitalOcean cho den khi production Tencent on dinh va backup hang ngay da duoc kiem tra.
