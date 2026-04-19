# Minh Hồng Next

Website full-stack cho Minh Hồng, xây bằng Next.js App Router, TypeScript và Prisma.

## Stack chính

- Next.js 16 App Router
- React 19
- Prisma ORM
- PostgreSQL cho local/dev và production

## Trạng thái database hiện tại

Repo này đang được chuẩn hóa sang PostgreSQL ở Phase 2.5.

- Schema chuẩn nằm ở `prisma/schema.prisma`
- Local/dev nên dùng PostgreSQL chạy trong Docker bên WSL2
- `SQLite` cũ chỉ là di sản local, không còn là target nên tiếp tục dùng

## Vì sao local dùng PostgreSQL qua WSL2 Docker

Máy hiện tại có:

- WSL2 Ubuntu đang chạy
- Docker Engine nằm trong WSL2
- PostgreSQL 12 cài trực tiếp trên Windows đang chiếm cổng `5432`

Để tránh đụng service cũ trên Windows và giữ môi trường dev dễ lặp lại, project này dùng:

- PostgreSQL 16 container
- cổng `5433`
- volume riêng của Docker

## Local setup

### 1. Chuẩn bị env

Repo có file mẫu:

- `.env.example`

Local dev nên dùng các biến chính sau:

```env
DATABASE_URL="postgresql://minhhong:minhhong_local_dev@localhost:5433/minhhong_next?schema=public"
DIRECT_URL="postgresql://minhhong:minhhong_local_dev@localhost:5433/minhhong_next?schema=public"
```

`DATABASE_URL` dùng cho app runtime.

`DIRECT_URL` dùng cho Prisma migrate/generate an toàn hơn khi sau này chuyển sang pooler hoặc managed Postgres.

### 2. Bật PostgreSQL local

Từ PowerShell của project:

```bash
npm run db:local:up
```

Xem trạng thái:

```bash
npm run db:local:ps
```

Xem log:

```bash
npm run db:local:logs
```

Tắt database:

```bash
npm run db:local:down
```

Reset sạch volume local nếu cần tạo migration lại từ đầu:

```bash
npm run db:local:reset
```

### 3. Tạo schema và Prisma Client

```bash
npm run db:generate
npm run db:migrate:dev -- --name init_postgres
```

### 4. Seed dữ liệu mẫu

```bash
npm run db:seed
```

### 5. Chạy app

```bash
npm run dev
```

## Các lệnh database hay dùng

```bash
npm run db:format
npm run db:validate
npm run db:status
npm run db:studio
npm run db:migrate:deploy
```

## Gợi ý target production

Khuyến nghị hiện tại:

- local/dev: PostgreSQL 16 trong Docker trên WSL2
- production/staging: managed PostgreSQL, ưu tiên Supabase

Lý do:

- ít lệch môi trường giữa dev và production
- dễ làm migration với Prisma
- không phụ thuộc SQLite file-based
- dễ mở rộng cho auth, contact lead, dashboard admin và logging sau này

## Lưu ý

- Không dùng `prisma db push` cho production workflow trừ khi có chủ đích rõ ràng.
- Với production nên dùng `prisma migrate deploy`.
- Nếu cần đổi cổng local DB vì trùng, sửa `POSTGRES_PORT` trong `.env`.
