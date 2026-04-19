# Minh Hồng Next

Website Next.js cho Minh Hồng, gồm landing page, dashboard quản trị và chatbot tư vấn.

## Chạy local

1. Cài dependencies:

```bash
npm install
```

2. Tạo file `.env` từ `.env.example` và điền các biến cần thiết.

3. Chạy dev server:

```bash
npm run dev
```

Mở `http://localhost:3000`.

## Cấu hình 9router

Nếu chạy 9router trực tiếp trên máy:

```bash
9router --no-browser --skip-update
```

Khi đó trong `.env` dùng:

```env
AI_PROVIDER="9router"
NINE_ROUTER_BASE_URL="http://127.0.0.1:20128/v1"
NINE_ROUTER_MODEL="cx/gpt-5.2"
NINE_ROUTER_API_KEY="your-9router-api-key"
```

## Chạy bằng Docker Compose

Repo đã có sẵn:

- `Dockerfile` cho app Next.js
- `docker/9router.Dockerfile` cho 9router
- `docker-compose.yml` để chạy cả app và 9router

Chuẩn bị biến môi trường trong shell hoặc file `.env`, rồi chạy:

```bash
docker compose up --build -d
```

Khi chạy bằng Compose, app sẽ gọi 9router qua hostname nội bộ:

```env
NINE_ROUTER_BASE_URL="http://nine-router:20128/v1"
```

Sau khi container `nine-router` chạy, mở dashboard tại `http://YOUR_SERVER_IP:20128/dashboard` để đăng nhập/cấu hình provider một lần đầu.

## Deploy VPS

Workflow khuyến nghị:

1. Code và test trên Windows bằng `npm run dev`.
2. Build kiểm tra bằng `npm run build`.
3. Đưa repo lên VPS.
4. Tạo file `.env` production trên VPS.
5. Chạy `docker compose up --build -d`.

Lưu ý:

- Chatbot chỉ hoạt động 24/7 khi cả app Next.js và 9router cùng chạy thường trực trên VPS.
- Không commit file `.env` chứa key thật.
- Với Next.js 16, repo này đã chuyển từ `middleware.ts` sang `proxy.ts` để tránh warning deprecation khi build.
