# Google Sheet Private Sync

Minh Hồng dùng web làm nguồn quản lý chính. Google Sheet chỉ là bản xuất/sao lưu một chiều từ web sang Sheet, không đồng bộ hai chiều.

## Cấu hình bắt buộc

Trên VPS hoặc môi trường production, cấu hình các biến môi trường sau:

```bash
GOOGLE_SERVICE_ACCOUNT_EMAIL="ten-service-account@project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_SYNC_SPREADSHEET_ID="1AMTEU7KBYMjU4PYPhL3M5BxkJoWA2n2e_v0_E4fyEGw"
```

`GOOGLE_SHEETS_SYNC_SPREADSHEET_ID` có thể bỏ trống nếu dùng sheet chuẩn đã khai báo trong code. Với VPS, nên lưu `GOOGLE_PRIVATE_KEY` trong secret/env của process manager, giữ nguyên ký tự `\n` hoặc dùng secret multiline nếu nền tảng hỗ trợ.

## Quyền trên Sheet riêng tư

Nếu Sheet để private, cần mở Google Sheet đích và share trực tiếp cho email trong `GOOGLE_SERVICE_ACCOUNT_EMAIL` với quyền `Editor`. Service account không tự thấy Sheet chỉ vì người dùng cá nhân có quyền.

## Cách vận hành an toàn

Nút sync trong admin sẽ ghi lại toàn bộ các tab chuẩn từ web sang Google Sheet. Luồng này có thể xoá/sắp xếp lại các tab ngoài danh sách chuẩn trong file sync, nên chỉ bấm khi đã xác nhận đúng Sheet đích và đúng service account.

Không chạy sync thật với dữ liệu khách hàng/tài chính nhạy cảm khi chưa xác nhận tại thời điểm thao tác. Không chỉnh số liệu trực tiếp trên Sheet rồi kỳ vọng web tự nhận ngược lại, vì dự án không có đồng bộ hai chiều.
