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

Sync có thể trỏ vào spreadsheet Minh Hồng đang dùng, nhưng app chỉ tạo/clear/update các tab `WEB_*`. Các tab gốc đang nhập liệu không bị xoá, đổi tên, hoặc ghi đè.

## Quyền trên Sheet riêng tư

1. Tạo service account trong Google Cloud.
2. Enable Google Sheets API cho project đó. Nếu dùng export XLSX private, service account cũng cần scope đọc file qua Drive; code hiện xin scope `spreadsheets` và `drive.readonly`.
3. Tạo key JSON cho service account, lấy `client_email` đưa vào `GOOGLE_SERVICE_ACCOUNT_EMAIL`, lấy `private_key` đưa vào `GOOGLE_PRIVATE_KEY`.
4. Mở từng Google Sheet cần đọc/ghi và share trực tiếp cho email trong `GOOGLE_SERVICE_ACCOUNT_EMAIL`:
   - Sheet đích `Xuất web → Sheet`: quyền `Editor`.
   - Sheet nguồn để `Kiểm tra từ Sheet gốc`: tối thiểu `Viewer`; nếu cùng Sheet và cần ghi `WEB_*`, dùng `Editor`.

Service account không tự thấy Sheet chỉ vì tài khoản Google cá nhân của mình có quyền. Nếu chưa share đúng email service account, app sẽ báo lỗi quyền/tải Sheet.

## Cách vận hành an toàn

Nút **Xuất web → Sheet** trong admin sẽ ghi lại toàn bộ các tab `WEB_*` từ web sang Google Sheet đích. Luồng này không xoá/sắp xếp lại các tab gốc, nhưng vẫn nên chỉ bấm khi đã xác nhận đúng Sheet đích và đúng service account.

Nút **Kiểm tra dữ liệu** của đơn bán chỉ đọc Sheet gốc, tạo báo cáo thay đổi và không sửa ô, ngày hay cấu trúc dữ liệu nguồn. Chỉ khi báo cáo sạch, admin mới bấm **Cập nhật ... lên web**; web kiểm tra lại fingerprint trước khi ghi database.

Định danh ổn định của đơn bán được tạo nội bộ từ nội dung dòng dữ liệu. Luồng này không thêm cột, không ghi metadata, không ẩn cột và không sửa bất kỳ ô nào trên Google Sheet gốc. Nếu có hai dòng hoàn toàn trùng nhau nên web không thể phân biệt an toàn, báo cáo sẽ chặn cập nhật và yêu cầu bổ sung thông tin phân biệt trước khi thử lại.

Dashboard đối tác luôn hiển thị công cụ kiểm tra Sheet theo phạm vi công nợ đối tác. Trên production, `MINHHONG_PARTNER_IMPORT_CONFIRM_ENABLED` mặc định là `false`: có thể xem trước số liệu nhưng chưa thể xác nhận import. Chỉ đặt thành `true` sau khi dữ liệu đối tác đã được đối soát riêng.

Không chạy sync thật với dữ liệu khách hàng/tài chính nhạy cảm khi chưa xác nhận tại thời điểm thao tác. Không chỉnh số liệu trực tiếp trên Sheet rồi kỳ vọng web tự nhận ngược lại, vì dự án không có đồng bộ hai chiều.
