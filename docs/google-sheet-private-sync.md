# Google Sheet Private Sync

Minh Hồng dùng web làm nguồn quản lý chính sau khi admin xác nhận import. Google Sheet là kênh nhập/xuất/sao lưu có kiểm soát, không đồng bộ hai chiều âm thầm.

Không cần mở công khai link Sheet. Với Sheet private, app dùng Google service account để đọc Sheet gốc và ghi các tab `WEB_*`. API key không đủ để đọc/ghi Sheet riêng tư vì API key không đại diện cho một danh tính có quyền trên file.

## Cấu hình bắt buộc

Trên VPS hoặc môi trường production, cấu hình các biến môi trường sau:

```bash
GOOGLE_SERVICE_ACCOUNT_EMAIL="ten-service-account@project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_SYNC_SPREADSHEET_ID="1O3lM52KoombirF657zMMEJhFdYEqXOCKXsIrtgIWLwA"
```

`GOOGLE_SHEETS_SYNC_SPREADSHEET_ID` có thể bỏ trống nếu dùng sheet chuẩn đã khai báo trong code. Với VPS, nên lưu `GOOGLE_PRIVATE_KEY` trong secret/env của process manager, giữ nguyên ký tự `\n` hoặc dùng secret multiline nếu nền tảng hỗ trợ.

File `.env` không tự dùng chung giữa các Git worktree. Hai biến service account phải tồn tại trong đúng process đang chạy app hoặc lệnh audit; nếu thiếu, hệ thống dừng trước khi gọi Google và báo kết nối Sheet chưa được cấu hình thay vì trả lỗi quyền khó hiểu.

Sync có thể trỏ vào spreadsheet Minh Hồng đang dùng, nhưng app chỉ tạo/clear/update các tab `WEB_*`. Các tab gốc đang nhập liệu không bị xoá, đổi tên, hoặc ghi đè.

## Quyền trên Sheet riêng tư

1. Tạo service account trong Google Cloud.
2. Enable Google Sheets API cho project đó. Nếu dùng export XLSX private, service account cũng cần scope đọc file qua Drive; code hiện xin scope `spreadsheets` và `drive.readonly`.
3. Tạo key JSON cho service account, lấy `client_email` đưa vào `GOOGLE_SERVICE_ACCOUNT_EMAIL`, lấy `private_key` đưa vào `GOOGLE_PRIVATE_KEY`.
4. Mở từng Google Sheet cần đọc/ghi và share trực tiếp cho email trong `GOOGLE_SERVICE_ACCOUNT_EMAIL`:
   - Sheet đích `Xuất sang Sheet`: quyền `Editor`.
   - Sheet nguồn dùng cho **Kiểm tra dữ liệu** và thiết lập lần đầu: quyền `Editor`. Lần kiểm tra đầu chỉ dùng quyền ghi nếu cần tự thêm liên kết ẩn an toàn; các lần kiểm tra bình thường vẫn chỉ đọc.

Service account không tự thấy Sheet chỉ vì tài khoản Google cá nhân của mình có quyền. Nếu chưa share đúng email service account, app sẽ báo lỗi quyền/tải Sheet.

## Cách vận hành an toàn

Nút **Xuất sang Sheet** trong admin ghi `WEB_Đơn hàng` hoặc `WEB_Đơn đối tác` theo đúng trang đang mở. Luồng này không ghi đè tab nhập `Đơn hàng đã bán` hoặc `Đơn đối tác`.

Tab nhập đối tác chuẩn là `Đơn đối tác` trong cùng spreadsheet với đơn dịch vụ. Mỗi dòng là một biến động: số dư đầu kỳ, mua hàng, thanh toán hoặc trả hàng. Cột `Còn phải trả` là kết quả tính; web không dùng cột này làm số nhập có thẩm quyền. Cột `Tính công nợ` và `source_id` được ẩn để giữ lịch sử đối chiếu và danh tính dòng ổn định.

Nút chính dùng chung cho đơn dịch vụ và đối tác đổi trạng thái theo quy trình: **Kiểm tra dữ liệu từ Sheet** → **Cập nhật ... lên web**. Lần bấm đầu chỉ đọc và tạo báo cáo; lần bấm xác nhận mới ghi database. Nếu Sheet thay đổi sau khi xem trước, web bắt buộc kiểm tra lại.

Trong lần dùng đầu tiên, nếu Sheet chưa có liên kết ổn định, nút **Kiểm tra dữ liệu từ Sheet** tự thêm mã liên kết vào một cột kỹ thuật được ẩn rồi kiểm tra lại. Bước tự động này không sửa khách hàng, sản phẩm, ngày, số tiền hay công nợ. Hệ thống đọc lại từng dòng ngay trước khi ghi và dừng nếu Sheet vừa thay đổi.

Dashboard đối tác luôn hiển thị công cụ kiểm tra Sheet theo phạm vi công nợ đối tác. Trên production, `MINHHONG_PARTNER_IMPORT_CONFIRM_ENABLED` mặc định là `false`: có thể xem trước số liệu nhưng chưa thể xác nhận import. Chỉ đặt thành `true` sau khi dữ liệu đối tác đã được đối soát riêng.

Không chạy sync thật với dữ liệu khách hàng/tài chính nhạy cảm khi chưa xác nhận tại thời điểm thao tác. Không chỉnh số liệu trực tiếp trên Sheet rồi kỳ vọng web tự nhận ngược lại, vì dự án không có đồng bộ hai chiều.
