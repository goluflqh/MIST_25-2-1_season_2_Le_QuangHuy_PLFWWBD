# Migrate production VPS

Runbook nay ap dung khi chuyen `minhhong-next` tu VPS source production hien tai sang VPS target moi, khong phu thuoc nha cung cap. Xac dinh source, target, DNS va ke hoach rollback cho tung lan chuyen; khong suy ra tu vi du lich su.

**An toan:** Script co the co gia tri mac dinh cu. Khong chay voi cac mac dinh source/target: doc script, khai bao day du tham so theo lan chuyen va doi chieu IP, host key, hostname, domain truoc moi phase. Khong chay setup/restore, cutover, rollback hay deploy production khi chua duoc phep rieng.

`tool-import-9router` da ngung su dung va khong nam trong pipeline. Native `9router` van duoc chuyen bang thu muc `/home/deploy/.9router` va service `9router.service`.
Pipeline cai [script updater](../scripts/9router-safe-update.sh) thanh `/usr/local/bin/9router-safe-update` va tao alias Termius/bash `9router-update` tren target. Updater doc model/API key tu `.env`, nang dung package path cua systemd, smoke test co xac thuc, roi moi restart app.

Phase `9router` co the dong bo rieng tooling/alias; chi chay voi bo tham so source/target da xac minh nhu phan duoi.

## Tu VPS moi den target san sang

### Phan nguoi dung phai lam tren giao dien nha cung cap

1. Tao/nhan VPS Ubuntu 22.04 hoac 24.04, ghi lai IP, ngay het han va gioi han bang thong.
2. Mo inbound TCP `22`, `80`, `443`. SSH `22` de `0.0.0.0/0` vi IP VPN thay doi; khong mo `3000`, `5433`, `20128` ra Internet.
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

5. Tren Windows, doi chieu host key nhan tu IP target voi fingerprint console o buoc 4 qua kenh tin cay. Chi sau khi khop moi luu entry cho dung IP vao known-hosts rieng cua target, roi thu SSH voi `StrictHostKeyChecking=yes`. Khong tin tu dong key chi vi `ssh-keyscan` nhan duoc no.

### SSH agent tren Windows

Truoc khi chay pipeline hoac automation qua Pi, kiem tra `Get-Command ssh,ssh-add` va fingerprint trong `ssh-add -l` (chi hien public-key fingerprint). Windows OpenSSH (`C:\Windows\System32\OpenSSH\ssh.exe` va `ssh-add.exe`) co the dung Windows `ssh-agent`; Git OpenSSH co the khong dung cung agent. Neu key duoc mo trong Termius thi khong gia dinh agent cua Windows hay Git da co key. Neu can, nguoi dung tu mo khoa key bang Windows `ssh-add.exe`; khong sao chep private key hoac passphrase vao chat/log. Kiem tra SSH batch voi host key da xac minh truoc khi chay pipeline, va dam bao pipeline thuc su goi dung executable; khong doi `StrictHostKeyChecking` de ep ket noi.

### Phan pipeline tu dong

Tu root repo, khai bao bo tham so cho **moi lan chuyen** trong cung PowerShell session. Thay tat ca placeholder bang gia tri da xac minh; doc them script de xac nhan user, identity, domain va cac tham so lien quan. Lenh `setup` chi chay sau khi duoc phep restore target:

```powershell
$migrationArgs = @(
  '-SourceHost', 'SOURCE_IP_DA_XAC_MINH',
  '-TargetHost', 'TARGET_IP_DA_XAC_MINH',
  '-TargetKnownHostsFile', "$HOME\.ssh\TARGET_KNOWN_HOSTS",
  '-ExpectedTargetHostKeySha256', 'SHA256:FINGERPRINT_DA_SO_SANH',
  '-TargetHostname', 'TARGET_HOSTNAME',
  '-SiteDomain', 'DOMAIN_DA_XAC_MINH'
)
powershell -ExecutionPolicy Bypass -File scripts/migrate-production-vps.ps1 -Phase setup @migrationArgs -AllowTargetRestore
```

Theo implementation da duoc review, pipeline du kien:

- Dat hostname, timezone `Asia/Ho_Chi_Minh`, tao swap 2 GB.
- Cai Docker Engine/Compose, Node.js 22, Caddy, UFW, fail2ban va native 9router.
- Chi mo `22/80/443`; bind app/PostgreSQL/9router vao dia chi private/localhost.
- Clone `main` vao `/opt/minhhong-next` va copy `.env` production quyen `600`.
- Chuan bi service 9router va Caddy nhung giu Caddy target tat.
- Dump PostgreSQL source, chuyen `.env` va trang thai `/home/deploy/.9router`, restore/build/migrate/start target. Xac nhan script hien tai chuyen nhung payload nao va du dung luong truoc khi thuc hien.
- Cai `9router-safe-update` va alias Termius `9router-update`.
- Chuyen `rclone crypt`, tao backup Google Drive luc 09:30 va chay backup thu.
- Verify app HTTP, PostgreSQL, 9router va xac nhan Caddy target van tat.

Pipeline khong cai/chuyen `tool-import-9router` hoac doi DNS. Kiem tra implementation hien tai va hieu ro tac dong len source/target truoc khi chay; khong coi tai lieu nay la bao dam khong gian doan.

### Xac minh updater va alias tren VPS moi

Thuc hien sau khi cai tooling va truoc khi coi migration hoan tat:

1. Doi chieu hash noi dung script nguon `scripts/9router-safe-update.sh` voi script da cai `/usr/local/bin/9router-safe-update` sau khi tinh den cac thay doi target duoc phep; kiem tra shebang, LF va noi dung day du, khong chi dua vao `bash -n`. Lan AWS 2026-11 file da cai mat ca ky tu `r` va dau `\\`, nen sua CRLF rieng khong du. Neu khong khop, dung ban nguon da xac minh, giu backup va dieu tra qua trinh truyen/chuan hoa; khong chay script loi.
2. Kiem tra dia chi 9router thuc te bang `ss -lnt` va systemd, sau do doi chieu `ROUTER_URL` cua updater. Khong gia dinh dia chi bridge giong VPS cu. Giu dashboard private, khong mo cong cong.
3. Kiem tra `type -a 9router-update` trong shell `deploy`, quyen file va `bash -n`; thu co che shebang bang mot script tam vo hai thay vi chay updater that. Doi chieu danh sach alias can giu voi source; `9router-off` khong duoc pipeline hien tai tao, nen xac minh hanh vi cu va xin phep truoc khi phuc hoi.
4. `9router-update` that co the cai package, goi API va restart 9router/app. Chi thu end-to-end khi duoc phep nang cap/restart va da danh gia downtime, chi phi; neu chua thu, ghi ro chua xac minh runtime. Sau khi thu, xac nhan service va dashboard hoat dong.

## Cac phase

Neu muon chay tung phan thay vi `setup`, dung cac phase duoi day voi `@migrationArgs` da khai bao va xac minh o tren. Moi phase co the thay doi VPS hoac du lieu; chi chay trong pham vi duoc phep.

Bootstrap he dieu han/source/.env, chua restore database:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/migrate-production-vps.ps1 -Phase bootstrap @migrationArgs
```

Chay tu root repo tren Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/migrate-production-vps.ps1 -Phase preflight @migrationArgs
```

Cap nhat source target, giu Caddy va 9router tat:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/migrate-production-vps.ps1 -Phase prepare @migrationArgs
```

Chup database/.env/9router tu production, khoi phuc va build target. Production cu van chay:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/migrate-production-vps.ps1 -Phase sync @migrationArgs -AllowTargetRestore
```

Phase `sync` cung chuyen script backup PostgreSQL va cau hinh `rclone crypt`, dat lich 09:30 theo timezone `Asia/Ho_Chi_Minh`, roi chay mot backup thu len Google Drive. Co the chay rieng phan nay:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/migrate-production-vps.ps1 -Phase backup @migrationArgs
```

Kiem tra target qua localhost; Caddy phai van tat:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/migrate-production-vps.ps1 -Phase verify @migrationArgs
```

## Cutover

Chi chay khi da chot thoi gian va duoc phep. Phase nay dung app source, lay snapshot cuoi, khoi phuc target, kiem tra, roi bat Caddy target:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/migrate-production-vps.ps1 -Phase cutover @migrationArgs -AllowTargetRestore -ConfirmCutover
```

Sau khi lenh thanh cong, doi cac DNS record lien quan sang IP target da xac minh, kiem tra public, sau do moi can nhac tat VPS cu. Xac minh nha cung cap va phuong thuc quan ly DNS cua lan chuyen; pipeline khong tu dong doi DNS.

Cutover cung tu dong doi host trong function PowerShell `9router-vps` (port local `22129`) sang target; rollback doi host ve source. Viec doi host khong tu dong them host key vao file `known_hosts` ma function su dung. `9router-vps-new` (port `22130`) chi la alias kiem tra: doc profile de xac nhan host thuc te, khong gia dinh no dang tro den target.

### Checklist tunnel Windows truoc va sau cutover

1. Doc function `9router-vps` trong PowerShell profile de xac dinh host, `UserKnownHostsFile`, identity va port thuc te. File known-hosts rieng cua pipeline co the khac file cua function. Neu can kiem tra target truoc cutover, xac nhan tuong tu cho `9router-vps-new`.
2. Lay fingerprint ED25519 cua target tu console nha cung cap, doi chieu voi host key nhan duoc tu target va fingerprint da luu cho migration. Chi tin key khi khop; `ssh-keyscan` mot minh khong xac minh danh tinh. Dung lai neu thieu nguon tin cay hoac fingerprint khac; khong tat `StrictHostKeyChecking`, khong xoa key cu de ep ket noi.
3. Truoc khi doi alias sang target, bao dam file `UserKnownHostsFile` cua chinh function co entry cho dung IP/host target va key da doi chieu. Kiem tra bang `ssh-keygen -F NEW_IP -f DUONG_DAN_KNOWN_HOSTS` va doi chieu fingerprint cua entry. Giu lai entry source da xac minh de rollback; xu ly xung dot host key rieng, khong tu dong ghi de.
4. Sau cutover, nap lai profile (`. $PROFILE`) hoac mo PowerShell moi; xac nhan function tro den target, chay `9router-vps` va mo `http://127.0.0.1:22129/dashboard/providers`. Hoan tat khi tunnel ket noi khong co loi host key va dashboard phan hoi (chuyen den trang login duoc chap nhan). Dong tunnel thu bang `Ctrl+C`; neu khong thu duoc, ghi ro chua xac minh.
5. Sau rollback, lap lai buoc 3-4 voi host source va xac nhan alias tro ve source. Chi thay doi local profile/known-hosts khi duoc cho phep; khong mo cong dashboard ra Internet.

Neu can quay lai va da duoc phep, doi DNS ve source da xac minh va chay:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/migrate-production-vps.ps1 -Phase rollback @migrationArgs -ConfirmRollback
```

Khong xoa VPS/volume source cho den khi production tren target on dinh, backup hang ngay da duoc kiem tra va co phep xoa rieng.
