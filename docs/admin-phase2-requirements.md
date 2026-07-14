# Admin Phase 2 Requirements

Mục tiêu này thay thế cách hiểu quá hẹp trước đó. Không được đánh dấu hoàn thành khi chỉ sửa UI nhìn ổn; phải có audit, test case và bằng chứng chạy thực tế cho từng mục.

## Nguyên tắc dữ liệu

- Web là nguồn quản lý chính cho dữ liệu mới.
- Sheet/Excel dùng để nhập dữ liệu cũ, đối chiếu, export/backup và sync một chiều web sang Google Sheet.
- Không đồng bộ hai chiều tự động.
- Sheet cũ không chỉ là số tổng. Từng dòng trong các tab cũ phải được đưa vào web để quản lý và xem lại.
- Sổ đối tác phải thể hiện đúng nghiệp vụ: Minh Hồng phải trả đối tác/Long. Không viết theo hướng Long nợ Minh Hồng.

## Dữ liệu cũ cần đưa vào web

- Import hoặc seed được từng dòng từ workbook cũ trong `operations/`, tối thiểu từ các tab chuẩn:
  - `Nhập hàng`: từng sản phẩm nhập hàng, ngày, đối tác, nguồn/người bán, số lượng, đơn vị, đơn giá, chiết khấu tùy chọn, tiền chiết khấu, thành tiền sau giảm, dòng gốc, trạng thái có tính công nợ hay chỉ đối chiếu.
  - `Thanh toán`: từng lần Minh Hồng thanh toán cho đối tác, ngày, số tiền, phương thức, ghi chú, dòng gốc, trạng thái có tính công nợ hay chỉ đối chiếu.
  - `Trả hàng`: từng dòng trả hàng, sản phẩm, số lượng, đơn giá/thành tiền, lý do, dòng gốc, trạng thái có tính công nợ hay chỉ đối chiếu.
  - `Đơn khách`: từng đơn đã bán ra, khách, số điện thoại, sản phẩm, tổng tiền, đã thu, còn nợ, ghi chú, dòng gốc. Các dòng này import riêng vào đơn dịch vụ để quản lý ở `/dashboard/orders`, không trộn vào sổ đối tác.
- Tổng đã mua và đã thanh toán phải tính từ dữ liệu cũ ban đầu, không chỉ tính các giao dịch mới sau khi nâng cấp.
- Vẫn giữ logic chốt số dư Long đã xác nhận: các dòng cũ có thể dùng để đối chiếu nhưng không được cộng đôi nếu đã gộp trong số dư chốt.

## `/dashboard/partners`

- Bỏ UI lặp: không vừa có một khung filter tìm đối tác vừa liệt kê tất cả card đối tác rồi lại hiển thị cùng thông tin trong “đối tác đang xem”.
- Khi nhiều đối tác, trang không được show hết đối tác/giao dịch một cách dài vô hạn. Cần dùng tab/list gọn, dropdown/search command, phân trang hoặc drawer/detail phù hợp.
- Trang chính chỉ nên hiện đối tác đang xem, số liệu chính và một số giao dịch gần nhất.
- Có nút/màn hình để xem toàn bộ lịch sử giao dịch chuyên nghiệp, dễ đọc, có phân trang, lọc theo đối tác/loại/ngày/search, dùng tốt trên desktop và mobile.
- Nút `Ghi giao dịch` trong khu vực đối tác đang xem phải mở popup/drawer/bottom sheet tại đúng ngữ cảnh hoặc tự focus/scroll rõ ràng đến form. Không được mở panel xa khiến người dùng tưởng không có gì xảy ra.
- Form ghi giao dịch phải có ba luồng rõ ràng:
  - `Mua hàng`: đối tác, ngày, sản phẩm/nội dung, số lượng, đơn giá, tự tính tổng, ghi chú/chứng từ.
  - `Thanh toán`: đối tác, ngày, số tiền, phương thức/nội dung, ghi chú/chứng từ; làm giảm số Minh Hồng phải trả.
  - `Trả hàng`: đối tác, ngày, sản phẩm/nội dung, số lượng, đơn giá/thành tiền, lý do/chứng từ; làm giảm số Minh Hồng phải trả.
- Card/summary dùng nhãn dễ hiểu: `Minh Hồng đang phải trả`, `Đã mua`, `Đã thanh toán`, `Đã trả hàng`, `Giao dịch gần nhất`.
- Mobile là ưu tiên đặc biệt: không vỡ chữ, không cần kéo ngang khó chịu, vùng bấm đủ lớn, popup/bottom sheet không che nội dung theo kiểu khó thao tác.

## `/dashboard/orders`

- Dữ liệu từ `Đơn khách` cũ phải có trên web theo từng dòng, có thể xem lại chi tiết như trên sheet.
- Luồng sửa đơn đã làm trước đó vẫn phải giữ: sửa ổn định, không lỗi chung chung, không scroll lên đầu trang, nhập tiền dễ đọc.
- Danh sách đơn cần phân trang/tải theo trang và vẫn giữ search/filter/sort/tag đúng.

## Test và audit bắt buộc

- Thêm unit/integration tests cho:
  - parser tiền `100k`, `1000k`, định dạng hàng nghìn.
  - signed amount của `PURCHASE`, `PAYMENT`, `RETURN`, `ADJUSTMENT`.
  - tính tổng partner ledger gồm mua hàng, thanh toán, trả hàng và số dư chốt không cộng đôi.
  - import/seed dữ liệu cũ từ workbook/tab chuẩn hoặc dữ liệu fixture tương đương.
- Thêm E2E/browser tests cho:
  - mở `/dashboard/partners` desktop/mobile không có overflow ngang vô lý.
  - mở ghi giao dịch từ đối tác đang xem, popup/drawer xuất hiện đúng ngữ cảnh.
  - mua hàng tính tổng từ số lượng x đơn giá.
  - thanh toán và trả hàng làm giảm số Minh Hồng phải trả.
  - xem toàn bộ giao dịch có phân trang/lọc và không hiện vô hạn trên trang chính.
- Chạy lặp: `lint`, unit tests, e2e targeted, Prisma validate/migration check, build, browser audit desktop/mobile.
- Chỉ được kết luận xong khi từng yêu cầu ở tài liệu này có evidence từ file, test output hoặc runtime behavior.
