# Minh Hong Next

Website full-stack cho Minh Hong, xây bằng Next.js App Router, TypeScript và Prisma.

## Stack chính

- Next.js 16 App Router
- React 19
- Prisma ORM
- PostgreSQL cho local/dev và production
- Playwright cho smoke E2E

## Trạng thái hiện tại

Nhánh app-upgrades hiện đã đi qua các lát cắt chính của roadmap Phase 1-5:

- tối ưu public-site và lead flow
- harden auth/account/admin smoke
- refactor chatbot sang AI-assisted hybrid
- thêm chatbot pricing guidance, context retention và basic metrics model
- thêm GitHub Actions CI cho pull request và push nhánh nâng cấp

Phase tiếp theo đang tập trung vào release readiness:

- dọn docs/env cho deploy
- checklist build local an toàn
- checklist apply migration `ChatbotEvent`

## Local setup

### 1. Chuẩn bị env

Copy từ `.env.example` sang `.env`, rồi chỉnh lại các giá trị thật nếu cần.

Local dev hiện mặc định dùng PostgreSQL:

```env
DATABASE_URL="postgresql://minhhong:minhhong_local_dev@localhost:5433/minhhong_next?schema=public"
DIRECT_URL="postgresql://minhhong:minhhong_local_dev@localhost:5433/minhhong_next?schema=public"
```

### 2. Bật PostgreSQL local

```bash
npm run db:local:up
```

Các lệnh hỗ trợ:

```bash
npm run db:local:ps
npm run db:local:logs
npm run db:local:down
npm run db:local:reset
```

### 3. Generate, migrate, seed

```bash
npm run db:generate
npm run db:migrate:dev -- --name init_postgres
npm run db:seed
```

### 4. Chạy app

```bash
npm run dev
```

Hoặc nếu muốn dùng dev server ổn định ở cổng `3001` để chạy Playwright local:

```bash
npm run dev:3001:start
```

## Các lệnh verify chính

```bash
npm run lint
npm run build
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 npm run test:e2e
```

CI trên GitHub hiện chạy các bước chính với PostgreSQL service: `npm ci`, Prisma generate/validate/migrate deploy, lint và build.

## Technical SEO

Site dùng `NEXT_PUBLIC_SITE_URL` để tạo canonical URL, sitemap và robots. Cấu hình production nên đặt biến này về domain thật, ví dụ:

```env
NEXT_PUBLIC_SITE_URL="https://minhhong.example"
```

Các route public quan trọng được xuất qua:

- `/sitemap.xml`
- `/robots.txt`

## AI provider cho chatbot

Code hiện hỗ trợ 3 provider qua biến `AI_PROVIDER`:

- `gemini`
- `openai`
- `9router`

`.env.example` đã có sẵn các biến tương ứng cho từng provider.

Lưu ý:

- `AI_PROVIDER` quyết định nhánh runtime của `/api/chat`
- `AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY` chỉ là fallback override chung
- nên chốt rõ một provider chính trên từng môi trường để tránh nhầm cấu hình

## Lưu ý về build local

Nếu `npm run build` bị thiếu RAM trên máy Windows, có thể tăng heap tạm thời:

```powershell
$env:NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

Xong thì xoá biến:

```powershell
Remove-Item Env:NODE_OPTIONS
```

## Lưu ý về `ChatbotEvent`

Repo đã có model và migration cho chatbot metrics:

- `prisma/schema.prisma`
- `prisma/migrations/20260420161054_add_chatbot_event_metrics/migration.sql`

Nếu môi trường hiện tại chưa apply migration này, app vẫn chạy và build được nhưng dashboard sẽ log fail-soft kiểu:

- thiếu bảng `public.ChatbotEvent`

Khi đó chatbot metrics chưa có số thật. Đây là hành vi đã biết, không phải build blocker.

## Tài liệu release readiness

Xem thêm checklist rollout, env và migration ở:

- `docs/release-readiness.md`

## Docker production foundation

Repo có Dockerfile standalone cho Next.js và compose nền cho app + PostgreSQL:

```bash
docker build -t minhhong-next .
docker compose --profile migrate run --rm migrate
docker compose up -d app
```

Trước khi dùng thật, đặt lại `AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL`, thông tin DB và provider AI trong môi trường deploy. Nếu dùng managed PostgreSQL, có thể giữ Dockerfile cho app và đổi compose theo secret/runtime của hạ tầng đó.

Lưu ý: `NEXT_PUBLIC_SITE_URL` cũng được truyền vào bước `docker build` để đóng đúng canonical, robots và sitemap trong image. Đặt biến này trước khi build production.

## Gợi ý production target

Khuyến nghị hiện tại:

- local/dev: PostgreSQL 16 trong Docker
- staging/production: managed PostgreSQL

Với production workflow, ưu tiên:

```bash
npm run db:migrate:deploy
```

Không nên dùng `prisma db push` cho release workflow nếu không có chủ đích rất rõ.
