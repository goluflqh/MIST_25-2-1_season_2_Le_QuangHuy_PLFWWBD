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

## 3. Rollout toàn bộ Prisma migrations

Không chọn chạy riêng một migration. Mỗi release phải kiểm tra và apply toàn bộ migration còn thiếu theo thứ tự đã lưu trong repo. Các migration quan trọng hiện có gồm:

- `prisma/migrations/20260420161054_add_chatbot_event_metrics/migration.sql`
- `prisma/migrations/20260710150000_add_service_order_source_code/migration.sql`
- `prisma/migrations/20260712093000_add_service_order_paid_at/migration.sql`

Schema tương ứng:

- `prisma/schema.prisma`

Thiếu migration có thể khiến dashboard thiếu metrics hoặc luồng import đơn bán lỗi vì database chưa có các cột mà code đang dùng.

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

4. Chạy lại `npm run db:status` và xác nhận không còn migration pending.
5. Truy cập dashboard, xác nhận metrics và preview import đơn bán không còn lỗi thiếu bảng/cột.

### Gợi ý backup

- Managed PostgreSQL: ưu tiên snapshot hoặc backup theo cách native của nhà cung cấp.
- PostgreSQL tự quản: có thể dùng `pg_dump` trước khi chạy migration.

Ví dụ:

```bash
pg_dump --format=custom --file=minhhong-pre-release.dump "$DATABASE_URL"
```

Điều chỉnh lệnh theo runner hoặc secret management thực tế của môi trường deploy.

## 4. Verify release tối thiểu

Trước khi gộp sang deploy track hoặc cắt release:

```bash
npm run test:unit
npm run lint
npm run build
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 npm run test:e2e
```

Nếu chạy Playwright local trên Windows, ưu tiên server dev ổn định ở cổng `3001`.

Trên GitHub, nhánh nâng cấp cũng cần chờ workflow CI xanh cho pull request/push trước khi đổi draft PR sang ready.

## 5. Rollout Google Sheet theo đơn bán trước

- Đặt `GOOGLE_SERVICE_ACCOUNT_EMAIL` và `GOOGLE_PRIVATE_KEY` trong secret/runtime của VPS; `.env` ở worktree khác không tự đi theo deploy.
- Trong đúng runtime đã có secret, chạy `npm run minhhong:audit:raw:orders`; chỉ rollout luồng đơn bán khi kết quả cuối là `OK`.
- Dashboard đối tác luôn cho phép **Kiểm tra dữ liệu** theo phạm vi công nợ đối tác, nhưng production phải giữ `MINHHONG_PARTNER_IMPORT_CONFIRM_ENABLED=false` trong đợt đầu để chưa thể xác nhận cập nhật.
- Mở `/dashboard/orders`, bấm **Kiểm tra dữ liệu từ Sheet**. Đây là smoke test chỉ đọc trong vận hành bình thường. Nếu Sheet cần thiết lập lần đầu, cùng thao tác này sẽ tự thêm mã liên kết vào cột kỹ thuật được ẩn rồi kiểm tra lại; chỉ xác nhận cập nhật sau khi báo cáo sạch và đã được phê duyệt cho lần ghi database đó.
- Trước khi mở cập nhật đối tác, chạy `npm run minhhong:audit:raw:partners` trong cùng runtime và xử lý hết mọi dòng `ERROR`; các thay đổi tổng tiền dạng `WARN` phải được người quản trị xác nhận là dữ liệu mới hợp lệ.
- Sau khi dữ liệu công nợ đã được đối soát riêng và audit không còn `ERROR`, đặt `MINHHONG_PARTNER_IMPORT_CONFIRM_ENABLED=true` rồi restart app để mở thao tác xác nhận import đối tác trên production.

## 6. Docker foundation

Dockerfile hiện build Next.js dạng standalone và có thêm target `migrator` để chạy Prisma migrate deploy trong compose:

```bash
docker compose up --build -d app
```

Compose chạy dịch vụ `migrate` trước `app`; `app` chỉ khởi động khi `prisma migrate deploy` hoàn tất thành công. Nếu khởi động bị chặn, hãy kiểm tra `docker compose logs migrate`, xử lý lỗi migration rồi mới chạy lại.

Với cơ sở dữ liệu production, chỉ dùng migration đã được lưu phiên bản qua `prisma migrate deploy`. Tuyệt đối không chạy `prisma migrate dev`, `prisma db push`, `db:local:reset`, lệnh xóa schema hoặc `docker compose down -v`.

Checklist trước khi chạy production:

- Đặt `NEXT_PUBLIC_SITE_URL` về domain thật trước khi `docker build` để sitemap, robots và canonical không dùng localhost.
- Đổi `AUTH_SECRET` khỏi placeholder.
- Kiểm tra `DATABASE_URL` / `DIRECT_URL` theo môi trường thật. Compose mặc định dùng service `postgres`; nếu dùng managed DB thì chỉnh secret/runtime tương ứng.
- Xác nhận container app nhận được `GOOGLE_SERVICE_ACCOUNT_EMAIL` và `GOOGLE_PRIVATE_KEY`; không in giá trị private key ra log.
- Giữ `MINHHONG_PARTNER_IMPORT_CONFIRM_ENABLED=false` cho đợt rollout đơn bán đầu tiên.
- Backup DB trước khi chạy migrate.
- Xác nhận app health sau khi container lên, rồi mới trỏ domain/SSL/Nginx.

## 7. Ghi chú merge phase cuối

- Không merge mù sang worktree deploy/Docker đang có WIP.
- Chỉ merge sau khi nhánh chuẩn bị release đã verify sạch.
- Sau merge, kiểm tra lại README, `.env.example`, migration state và tài liệu provider AI một lần nữa để tránh lệch giữa code và ops docs.
