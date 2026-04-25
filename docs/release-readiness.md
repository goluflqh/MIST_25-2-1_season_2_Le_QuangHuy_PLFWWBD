# Release Readiness

Tài liệu này gom các bước vận hành thực tế cho Phase 6 trước khi merge sang track deploy hoặc chạy release thật.

## 1. Trước khi build release

- Xác nhận `.env` production hoặc staging đã có `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` và provider AI đúng với môi trường.
- Nếu build local trên Windows bị thiếu bộ nhớ, chạy build với:

```powershell
$env:NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

- Sau khi build xong có thể xoá biến tạm trong cùng terminal:

```powershell
Remove-Item Env:NODE_OPTIONS
```

## 2. Checklist env cho chatbot AI

Repo hiện hỗ trợ 3 lựa chọn `AI_PROVIDER`:

- `gemini`: dùng `GEMINI_API_KEY` hoặc `AI_API_KEY`
- `openai`: dùng `OPENAI_API_KEY`, có thể override thêm `OPENAI_BASE_URL`, `OPENAI_MODEL`
- `9router`: dùng `NINE_ROUTER_API_KEY`, có thể override thêm `NINE_ROUTER_BASE_URL`, `NINE_ROUTER_MODEL`

Nếu cần một lớp fallback chung cho provider đang test nội bộ, có thể dùng thêm:

- `AI_BASE_URL`
- `AI_MODEL`
- `AI_API_KEY`

Không nên để đồng thời nhiều provider production mà không chốt rõ `AI_PROVIDER`, vì route `/api/chat` sẽ chọn nhánh runtime theo biến này.

## 3. Rollout migration `ChatbotEvent`

Repo đã có migration:

- `prisma/migrations/20260420161054_add_chatbot_event_metrics/migration.sql`

Model tương ứng:

- `prisma/schema.prisma`

Khi bảng này chưa được apply, dashboard vẫn build được nhưng sẽ log fail-soft và phần chatbot metrics không có dữ liệu thật.

### Trình tự an toàn khuyến nghị

1. Backup hoặc snapshot database trước khi release.
2. Kiểm tra trạng thái migration:

```bash
npm run db:status
```

3. Apply migration trên môi trường đích:

```bash
npm run db:migrate:deploy
```

4. Kiểm tra bảng đã tồn tại:

```sql
SELECT COUNT(*)
FROM "ChatbotEvent";
```

5. Truy cập dashboard và xác nhận khối chatbot metrics không còn log thiếu bảng.

### Gợi ý backup

- Managed PostgreSQL: ưu tiên snapshot hoặc backup theo cách native của nhà cung cấp.
- PostgreSQL tự quản: có thể dùng `pg_dump` trước khi chạy migration.

Ví dụ:

```bash
pg_dump --format=custom --file=minhhong-pre-chatbot-event.dump "$DATABASE_URL"
```

Điều chỉnh lệnh theo runner hoặc secret management thực tế của môi trường deploy.

## 4. Verify release tối thiểu

Trước khi gộp sang deploy track hoặc cắt release:

```bash
npm run lint
npm run build
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 npm run test:e2e
```

Nếu chạy Playwright local trên Windows, ưu tiên server dev ổn định ở cổng `3001`.

Trên GitHub, nhánh nâng cấp cũng cần chờ workflow CI xanh cho pull request/push trước khi đổi draft PR sang ready.

## 5. Docker foundation

Dockerfile hiện build Next.js dạng standalone và có thêm target `migrator` để chạy Prisma migrate deploy trong compose:

```bash
docker build -t minhhong-next .
docker compose --profile migrate run --rm migrate
docker compose up -d app
```

Checklist trước khi chạy production:

- Đặt `NEXT_PUBLIC_SITE_URL` về domain thật để sitemap, robots và canonical không dùng localhost.
- Đổi `AUTH_SECRET` khỏi placeholder.
- Kiểm tra `DATABASE_URL` / `DIRECT_URL` theo môi trường thật. Compose mặc định dùng service `postgres`; nếu dùng managed DB thì chỉnh secret/runtime tương ứng.
- Backup DB trước khi chạy migrate.
- Xác nhận app health sau khi container lên, rồi mới trỏ domain/SSL/Nginx.

## 6. Ghi chú merge phase cuối

- Không merge mù sang worktree deploy/Docker đang có WIP.
- Chỉ merge sau khi branch app-upgrades đã sạch verify.
- Sau merge, kiểm tra lại README, `.env.example`, migration state và tài liệu provider AI một lần nữa để tránh lệch giữa code và ops docs.
