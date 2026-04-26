# Deploy Minh Hong Next Len DigitalOcean VPS

Last reviewed: 2026-04-26.

## Muc tieu dung

Muc tieu giai doan dau la chay mot VPS duy nhat gom:

- Next.js app trong Docker.
- PostgreSQL 16 trong Docker volume.
- 9router chay song song tren VPS, de app production khong phu thuoc may Windows local.
- Reverse proxy SSL bang Caddy hoac Nginx o phia truoc app.

Khi co traffic va du lieu that on dinh hon, nen tach PostgreSQL sang DigitalOcean Managed PostgreSQL hoac mot DB managed khac. Giai doan dau tu host PostgreSQL tren cung VPS la hop ly vi re hon va khop voi `docker-compose.yml` hien tai.

## Chon DigitalOcean Droplet

Khuyen nghi cho ban dau:

- Toi thieu: Basic Droplet 2 GiB RAM / 1 vCPU / 50 GiB SSD.
- Nen chon neu chay ca app + PostgreSQL + 9router tren cung may: Basic Droplet 4 GiB RAM / 2 vCPU / 80 GiB SSD.
- Khong nen chon 1 GiB RAM cho production nay, vi Next.js build, PostgreSQL va 9router de cham/OOM.
- Region nen gan nguoi dung Viet Nam, thuong uu tien Singapore neu co san.
- Image: Ubuntu 24.04 LTS, hoac Marketplace Docker 1-Click App neu muon co Docker san.
- Authentication: SSH key, khong uu tien password login.
- Monitoring: bat.
- Backup: nen bat khi co du lieu that; neu tiet kiem credit luc dau thi toi thieu phai tu tao backup PostgreSQL truoc moi lan migrate.

DigitalOcean GitHub Student Pack hien cong bo credit 200 USD trong 1 nam cho user hop le. Gia Droplet va managed DB co the thay doi, nen kiem tra lai trang pricing truoc khi tao may.

Nguon tham khao:

- https://www.digitalocean.com/github-students/
- https://www.digitalocean.com/pricing/droplets
- https://docs.digitalocean.com/products/droplets/how-to/create/
- https://docs.digitalocean.com/products/databases/postgresql/details/pricing/

## Firewall

Tao Cloud Firewall gan vao Droplet:

- Inbound `22/tcp`: chi cho IP cua ban neu co the.
- Inbound `80/tcp`, `443/tcp`: allow all de web va SSL hoat dong.
- Inbound `3000/tcp`: khong public lau dai. Chi mo tam theo IP cua ban neu can test truoc reverse proxy.
- Khong mo `5433/tcp` PostgreSQL ra Internet.
- Khong mo `20128/tcp` 9router ra Internet.
- Outbound: allow all cho update package va goi API AI.

`docker-compose.yml` da bind PostgreSQL host port ve `127.0.0.1`, nen ngay ca khi Cloud Firewall loi, DB cung khong nghe tren public interface theo mac dinh.

Nguon tham khao:

- https://docs.digitalocean.com/products/networking/firewalls/how-to/configure-rules/

## Tao VPS va cai Docker

Neu dung Ubuntu thuong:

```bash
ssh root@YOUR_DROPLET_IP
adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

Dang nhap lai bang user `deploy`, cai Docker theo tai lieu chinh thuc:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
```

Sau do cai Docker Engine va Docker Compose plugin theo huong dan Docker/DigitalOcean. Neu dung Marketplace Docker 1-Click App thi co the bo qua phan cai Docker, nhung van nen tao user `deploy`.

Nguon tham khao:

- https://www.digitalocean.com/community/tutorials/initial-server-setup-with-ubuntu
- https://www.digitalocean.com/community/tutorials/how-to-install-and-use-docker-on-ubuntu-20-04
- https://docs.digitalocean.com/products/marketplace/droplet-1-click-apps/

## Dua source len VPS

Tren VPS:

```bash
sudo mkdir -p /opt/minhhong-next
sudo chown deploy:deploy /opt/minhhong-next
cd /opt/minhhong-next
git clone YOUR_GITHUB_REPO_URL .
git checkout main
```

Neu repo private, dung SSH deploy key hoac GitHub token co quyen read repo.

## Tao file `.env` production

Tren VPS:

```bash
cd /opt/minhhong-next
cp .env.example .env
openssl rand -base64 32
openssl rand -base64 32
```

Sua `.env`:

```env
NEXT_PUBLIC_SITE_URL="https://your-domain.com"

POSTGRES_PORT="5433"
POSTGRES_DB="minhhong_next"
POSTGRES_USER="minhhong"
POSTGRES_PASSWORD="replace-with-long-random-password"

AUTH_SECRET="replace-with-output-from-openssl"

AI_PROVIDER="9router"
NINE_ROUTER_BASE_URL="http://host.docker.internal:20128/v1"
NINE_ROUTER_MODEL="cx/gpt-5.2"
NINE_ROUTER_API_KEY="replace-with-router-key"
```

Luu y:

- Trong Docker Compose, app ket noi PostgreSQL bang service name `postgres`, khong phai `localhost`.
- `NEXT_PUBLIC_SITE_URL` duoc truyen vao luc build image, nen phai dat dung domain truoc khi `docker compose build`.
- Khong commit `.env` len Git.

## Chay PostgreSQL, migrate, app

Lan dau tren VPS:

```bash
cd /opt/minhhong-next
docker compose build app migrate
docker compose up -d postgres
docker compose --profile migrate run --rm migrate npx prisma migrate status
docker compose --profile migrate run --rm migrate
docker compose up -d app
docker compose ps
curl -I http://127.0.0.1:3000
```

Neu DB moi hoan toan va can seed du lieu mau/gia:

```bash
docker compose --profile migrate run --rm migrate npm run db:seed
```

Khong dung cac lenh nay tren production:

- `prisma migrate dev`
- `prisma db push`
- `prisma migrate reset`

Production chi dung:

```bash
docker compose --profile migrate run --rm migrate npx prisma migrate status
docker compose --profile migrate run --rm migrate
```

Lenh migrate deploy se apply tat ca migration con thieu, gom cac migration quan trong nhu `ChatbotEvent`, rate limit buckets, dashboard indexes va coupon redemptions.

## Backup PostgreSQL truoc khi migrate

Truoc moi lan deploy co migration:

```bash
cd /opt/minhhong-next
mkdir -p backups
docker exec minhhong-postgres-prod pg_dump \
  -U minhhong \
  -d minhhong_next \
  --format=custom \
  --file=/tmp/minhhong-before-migrate.dump
docker cp minhhong-postgres-prod:/tmp/minhhong-before-migrate.dump ./backups/minhhong-before-migrate-$(date +%Y%m%d-%H%M%S).dump
```

Neu restore can lam sau nay:

```bash
docker cp ./backups/YOUR_BACKUP.dump minhhong-postgres-prod:/tmp/restore.dump
docker exec -it minhhong-postgres-prod pg_restore \
  -U minhhong \
  -d minhhong_next \
  --clean \
  --if-exists \
  --no-owner \
  /tmp/restore.dump
```

Restore la thao tac rui ro cao, chi lam khi da chac dung file backup.

## Neu muon mang du lieu local len VPS

Neu production can copy data tu may local hien tai:

1. Dam bao local DB da migrate moi nhat.
2. Dump local PostgreSQL.
3. Copy dump len VPS.
4. Restore vao PostgreSQL tren VPS.
5. Chay `prisma migrate deploy` tren VPS de apply migration con thieu neu co.

Vi du local dump:

```bash
pg_dump --format=custom --no-owner --no-acl --file=minhhong-local.dump "$DATABASE_URL"
```

Copy len VPS:

```bash
scp minhhong-local.dump deploy@YOUR_DROPLET_IP:/opt/minhhong-next/backups/
```

Restore tren VPS:

```bash
cd /opt/minhhong-next
docker cp ./backups/minhhong-local.dump minhhong-postgres-prod:/tmp/minhhong-local.dump
docker exec -it minhhong-postgres-prod pg_restore \
  -U minhhong \
  -d minhhong_next \
  --clean \
  --if-exists \
  --no-owner \
  /tmp/minhhong-local.dump
docker compose --profile migrate run --rm migrate
```

## 9router tren VPS

Duoc: ban co the giu 9router tren may Windows local va tao them mot ban chay tren VPS. Hai ban nay doc lap, mien la moi moi truong co config/API key rieng va usage policy cua provider cho phep.

Huong an toan:

- Production app chi goi 9router tren VPS.
- May Windows local chi dung cho dev.
- Khong public cong 9router ra Internet.
- Neu 9router can API key de bao ve endpoint, dat key khac production va luu trong `.env`.

### Phuong an A: 9router chay native tren host VPS

Day la cach nhanh neu 9router cua ban hien la mot CLI/process rieng:

1. Cai 9router tren VPS theo dung cach ban dang cai local.
2. Copy config can thiet, khong copy token/secret lung tung neu khong hieu ro.
3. Cho 9router listen `127.0.0.1:20128`.
4. Giu app env:

```env
NINE_ROUTER_BASE_URL="http://host.docker.internal:20128/v1"
```

`docker-compose.yml` da them `host.docker.internal:host-gateway`, nen app container co the goi service dang chay tren host VPS.

Neu dung systemd, tao service tuong tu:

```ini
[Unit]
Description=9router
After=network-online.target
Wants=network-online.target

[Service]
User=deploy
WorkingDirectory=/opt/9router
EnvironmentFile=/etc/minhhong/9router.env
ExecStart=/usr/local/bin/9router
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

`ExecStart` phai thay bang lenh that cua 9router tren may ban.

### Phuong an B: Docker hoa 9router

Neu 9router co repo/Dockerfile/image rieng, day la huong dep hon:

```yaml
services:
  9router:
    image: your-9router-image
    restart: unless-stopped
    expose:
      - "20128"
    environment:
      NINE_ROUTER_API_KEY: ${NINE_ROUTER_API_KEY}
```

Khi do doi env app:

```env
NINE_ROUTER_BASE_URL="http://9router:20128/v1"
```

Phuong an B giup deploy/restart dong bo hon, nhung chi lam khi da biet ro cach dong goi 9router.

## Reverse proxy va SSL

Sau khi `curl -I http://127.0.0.1:3000` OK, cau hinh domain tro A record ve IP Droplet.

Caddy la cach don gian:

```caddyfile
your-domain.com {
  reverse_proxy 127.0.0.1:3000
}
```

Neu dung Nginx, proxy ve `127.0.0.1:3000` va cai Let's Encrypt/Certbot. Sau khi co proxy, khong can public port `3000`.

## Quy trinh deploy moi lan sau

```bash
cd /opt/minhhong-next
git fetch origin
git checkout main
git pull --ff-only

docker compose build app migrate

# Backup neu co migration moi
mkdir -p backups
docker exec minhhong-postgres-prod pg_dump \
  -U minhhong \
  -d minhhong_next \
  --format=custom \
  --file=/tmp/minhhong-before-deploy.dump
docker cp minhhong-postgres-prod:/tmp/minhhong-before-deploy.dump ./backups/minhhong-before-deploy-$(date +%Y%m%d-%H%M%S).dump

docker compose --profile migrate run --rm migrate npx prisma migrate status
docker compose --profile migrate run --rm migrate
docker compose up -d app
docker compose ps
curl -I http://127.0.0.1:3000
```

Smoke test sau deploy:

- Trang chu load duoc.
- Dang ky/dang nhap duoc.
- Dashboard admin vao duoc.
- Chatbot tra loi duoc bang 9router tren VPS.
- Form lien he tao record trong DB.
- Coupon redemption khong loi.

## Huong nang cap sau

Khi web bat dau co du lieu that:

- Bat DigitalOcean backups/snapshots hoac backup DB tu dong hang ngay.
- Can nhac DigitalOcean Managed PostgreSQL de co backup/maintenance tot hon.
- Dua image len GitHub Container Registry thay vi build truc tiep tren VPS.
- Them monitoring/log rotation.
- Tao staging rieng truoc production.
