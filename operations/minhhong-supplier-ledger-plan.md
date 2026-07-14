# Kế hoạch chuẩn hóa đơn hàng và công nợ Minh Hồng

> Cập nhật 2026-07-13: phần số liệu chốt ngày 2026-05-26 bên dưới là lịch sử và đã được thay thế. Số dư đầu kỳ Long chính thức là `12.730.000đ`; đơn `300 cell EVE 25P` giữ nguyên `7.500.000đ` như một dòng đối chiếu đã nằm trong số dư đầu kỳ. Các phát sinh sau đó là đèn NLMT `3.900.000đ` và thanh toán tương ứng, đèn pha NLMT `1.250.000đ`, bốn sạc `440.000đ`, thanh toán tiền mặt + chuyển khoản `3.420.000đ`. Số Minh Hồng còn phải trả Long hiện tại là đúng `11.000.000đ`.

> Dữ liệu đối tác mới dùng tab `Đơn đối tác` trong spreadsheet chung. Mỗi biến động là một dòng; dữ liệu lịch sử vẫn hiển thị để tra cứu nhưng các dòng đã gộp vào số dư đầu kỳ không được cộng nợ lần hai.

Cập nhật ngày 2026-05-26.

Tài liệu này gom hai phần vào cùng một hướng làm:

- `Đơn Dịch Vụ & Đơn Cũ`: cần sửa được đơn sau khi tạo, nhất là giá bán/đã thu/ghi chú.
- `Sổ đối tác`: theo dõi Minh Hồng nợ Long và các đối tác nhà cung cấp sau này.

## Số liệu công nợ đã chốt

File copy hiện tại:

- `operations/minhhong-sheet-goc-export-2026-05-26.xlsx`
- `operations/minhhong-sheet-moi-export-2026-05-26.xlsx`
- `operations/minhhong-cong-no-doi-tac-copy-2026-05-26.xlsx`

Quy tắc đã chốt:

- Ghi chú `50tr` cũ là nhầm; số đúng lúc đó là `45.000.000đ`.
- Dữ liệu cũ chỉ có một đối tác công nợ thực tế là `Long`.
- `Shopee`, `Điện tử Lào Cai`, `Trần Viết Cường`, `a Tâm`... là nguồn Long mua hộ, không phải công nợ riêng trong dữ liệu cũ.
- Web sau này vẫn hỗ trợ nhiều đối tác để Minh Hồng tự mua trực tiếp.

Công nợ Long chính thức:

```text
Nợ tạm tính đến 07/05/2026: 20.230.000đ
Mua thêm 300cell eve 25p ngày 08/05/2026: 7.490.000đ
Tổng trước trả: 27.720.000đ
Trả trước: 15.000.000đ
Còn nợ: 12.720.000đ
```

Workbook vẫn có đối chiếu theo dòng thô cũ:

```text
Còn nợ theo dòng thô cũ trước 08/05: 19.945.500đ
Nếu cộng phát sinh 08/05 và khoản trả trước 15.000.000đ: 12.435.500đ
Công nợ chính thức sau chốt: 12.720.000đ
Chênh chính thức - thô cùng mốc: 284.500đ
```

Lưu ý quan trọng: `19.945.500đ` không cùng mốc với `12.720.000đ`. Con số `19.945.500đ` là cách cộng lại dữ liệu thô cũ trước khi tính phát sinh/trả tiền ngày `08/05/2026`. Khi đưa về cùng mốc hiện tại thì số thô là `12.435.500đ`, lệch số chính thức `284.500đ`.

Số chính thức vẫn theo số dư chốt từ `07/05/2026`; dòng thô chỉ để xem lịch sử lệch bao nhiêu.

## Hướng đi hệ thống

Khuyến nghị để duyệt: **web là nguồn quản lý chính**.

Sheet/Excel chỉ dùng cho:

- Import dữ liệu cũ.
- Export báo cáo/backup.
- Đối chiếu khi cần.
- Nếu sau này cần sync Google Sheet, chỉ làm import/export có nút xác nhận và log thay đổi, không tự đồng bộ hai chiều âm thầm.

Lý do:

- Công nợ và đơn hàng cần audit log: ai sửa, sửa lúc nào, sửa gì.
- Web ép được quy tắc nhập liệu: không quên giá, không nhầm đối tác, không cộng đôi số dư chốt.
- Web có thể xem nhanh như sheet bằng bảng dày, filter, sort, search, sticky tổng, export Excel.

## Kết luận về module đơn khách

Không tạo module `Đơn khách đã bán` riêng ở bước đầu nữa.

Lý do: code hiện tại đã có `/dashboard/orders` với tiêu đề `Đơn Dịch Vụ & Đơn Cũ`, đã có:

- `ServiceOrder`
- import đơn cũ
- tổng giá gốc/đã thu/còn phải thu
- trạng thái, nguồn, tài khoản khách
- bảo hành liên kết
- API `PATCH /api/admin/service-orders`

Hướng chuẩn hơn là nâng cấp chính màn này thành **sổ đơn khách đầy đủ**.

## Vấn đề hiện tại của Đơn Dịch Vụ

API đã có cập nhật một phần, nhưng UI chưa có nút `Sửa đơn` đầy đủ.

Hiện admin chỉ sửa nhanh được:

- trạng thái,
- ẩn/hiện với khách,
- đã thu,
- thu đủ,
- tạo bảo hành,
- xóa.

Thiếu sửa đầy đủ:

- tên khách,
- số điện thoại,
- địa chỉ,
- ngày đơn,
- loại dịch vụ,
- sản phẩm,
- giá gốc/giá bán,
- đã thu,
- tháng bảo hành,
- tình trạng,
- phương án,
- ghi chú,
- nguồn đơn.

Vì vậy khi lỡ tạo đơn giá `0đ` hoặc thiếu giá, admin bị kẹt.

## Quy tắc giá sau khi nâng cấp

Để không còn quên giá âm thầm:

- Khi tạo hoặc sửa đơn `Hoàn thành`, giá bán phải lớn hơn `0`, trừ khi chọn lý do đặc biệt.
- Lý do đặc biệt nên có:
  - `Chưa báo giá`: dùng cho đơn đang chờ/xử lý.
  - `Miễn phí`: làm không thu tiền.
  - `Quên giá`: chỉ dùng cho dữ liệu cũ/import cũ, không khuyến khích cho đơn mới.

Đề xuất thêm field vào `ServiceOrder`:

- `priceStatus`: `CONFIRMED`, `PENDING_QUOTE`, `FREE`, `LEGACY_MISSING`

Mapping:

- Có giá > 0: `CONFIRMED`
- Chưa biết giá: `PENDING_QUOTE`
- Làm miễn phí: `FREE`
- Dữ liệu cũ bị quên giá: `LEGACY_MISSING`

Với dữ liệu sheet hiện tại, 4 đơn thiếu tiền sẽ import/update thành `LEGACY_MISSING` và hiển thị nhãn `Quên giá`.

## Kế hoạch nâng cấp để duyệt

### Phase 0: Git và kiểm soát phạm vi

Trước khi sửa code app:

- Giữ các thay đổi workbook/plan riêng với code web.
- Tạo branch làm tính năng, đề xuất: `codex/service-orders-ledger-upgrade`.
- Không chạm các file untracked không liên quan như `.claude/`, `marketing/`, `AGENTS.md` nếu không cần.
- Mỗi phase nên có commit riêng.

Tooling bắt buộc khi làm:

- Chạy GitNexus freshness gate trước khi dùng GitNexus.
- Dùng `gitnexus impact` trước khi sửa function/class/method.
- Dùng `api_impact` trước khi đổi API route.
- Dùng `gitnexus detect_changes` trước commit.
- Chạy `npx prisma validate`, migration check, lint/build, và test UI bằng browser.

### Phase 1: Sửa được Đơn Dịch Vụ

Mục tiêu: admin mở một đơn đã tạo và sửa lại đầy đủ thông tin.

UI:

- Thêm nút `Sửa` trên từng card đơn.
- Mở drawer hoặc modal edit, dùng form gần giống form tạo đơn.
- Có `Lưu`, `Hủy`, trạng thái đang lưu.
- Sau khi lưu, card cập nhật ngay bằng response từ API.
- Vẫn giữ các nút nhanh hiện có: ghi thu, thu đủ, trạng thái, ẩn/hiện, bảo hành.

Backend:

- Mở rộng `PATCH /api/admin/service-orders` để update thêm các field an toàn:
  - customer info,
  - orderDate,
  - service,
  - productName,
  - source,
  - quotedPrice,
  - paidAmount,
  - warrantyMonths,
  - issueDescription,
  - solution,
  - notes,
  - priceStatus.
- Nếu sửa số điện thoại, cần cập nhật/relink `Customer` đúng theo phone normalized.
- Nếu sửa `quotedPrice`, tính lại `discountAmount` và cap `paidAmount` không vượt số phải thu.
- Không tự sửa phiếu bảo hành đã tạo khi chỉ sửa giá. Bảo hành nên có luồng riêng để tránh thay đổi ngoài ý muốn.
- Audit log vẫn ghi old/new data.

Success check:

- Tạo đơn giá `0đ` rồi sửa thành giá đúng được.
- Sửa sản phẩm/khách/ngày/ghi chú được.
- Sửa giá làm tổng `Giá gốc đã báo`, `Đã thu`, `Còn phải thu` đổi đúng.
- Nếu đơn hoàn thành mà giá thiếu, UI cảnh báo rõ.

### Phase 2: Chuẩn hóa trạng thái giá và import đơn cũ

Mục tiêu: dữ liệu cũ thiếu giá được quản lý rõ, còn đơn mới không bị quên giá.

Database:

- Thêm `priceStatus` vào `ServiceOrder`.
- Migration backfill:
  - `quotedPrice > 0`: `CONFIRMED`
  - `quotedPrice` null/0 và source import cũ: `LEGACY_MISSING`
  - các trường hợp chưa báo giá hiện tại nếu có: `PENDING_QUOTE`

UI:

- Filter `Quên giá`.
- Badge cảnh báo trên card.
- Dashboard đếm số đơn cần bổ sung giá.

Importer:

- Khi import từ workbook copy, 4 đơn thiếu tiền vào `LEGACY_MISSING`.
- Không tự đưa nợ về `0đ` như thể miễn phí nếu chưa xác nhận.

### Phase 3: Sổ đối tác công nợ nhà cung cấp

Mục tiêu: tách công nợ Minh Hồng nợ Long/đối tác khỏi `ServiceOrder`.

Prisma model đề xuất:

- `Partner`
  - name
  - role/note/status
  - phone optional

- `PartnerLedgerEntry`
  - partnerId
  - type: `OPENING_BALANCE`, `PURCHASE`, `PAYMENT`, `RETURN`, `ADJUSTMENT`
  - entryDate
  - itemName
  - quantity
  - unit
  - unitPrice
  - amount
  - sourceName
  - note
  - sourceRow
  - isConfirmed

Import ban đầu:

- Partner: `Long`
- `OPENING_BALANCE` ngày `07/05/2026`: `20.230.000đ`
- `PURCHASE` ngày `08/05/2026`: `300cell eve 25p`, `7.490.000đ`
- `PAYMENT` ngày `08/05/2026`: `15.000.000đ`
- Các dòng thô cũ lưu dạng đối chiếu/import note, không cộng vào công nợ chính.

### Phase 4: Admin Sổ đối tác

Màn mới: `/dashboard/partners` hoặc `/dashboard/ledger`.

Cần có:

- Cards tổng: hàng/nợ, đã trả, trả hàng, còn phải trả.
- Bảng đối tác.
- Bảng giao dịch dạng sheet.
- Filter theo đối tác, ngày, type, chưa xác nhận.
- Form thêm giao dịch nhanh.
- Drawer chi tiết đối tác.
- Export Excel.

Với Long, số ban đầu phải ra:

```text
20.230.000 + 7.490.000 - 15.000.000 = 12.720.000đ
```

### Phase 5: Dashboard tổng hợp

Dashboard cần tách rõ:

- Khách còn nợ Minh Hồng: lấy từ `ServiceOrder`.
- Minh Hồng còn nợ đối tác: lấy từ `PartnerLedgerEntry`.
- Dòng tiền ròng chỉ hiển thị khi dữ liệu đủ tin cậy.
- Cảnh báo:
  - đơn `Quên giá`,
  - giao dịch đối tác chưa xác nhận,
  - import có chênh lệch dòng thô,
  - đơn hoàn thành nhưng chưa có giá hợp lệ.

### Phase 6: Trải nghiệm xem nhanh như sheet

Nâng `/dashboard/orders` và `Sổ đối tác` theo kiểu bảng làm việc:

- Toggle `Thẻ` / `Bảng`.
- Sticky header.
- Sticky summary bar.
- Search tức thì.
- Filter nhiều điều kiện.
- Sort theo ngày, tiền, nợ còn.
- Click dòng mở drawer, không rời khỏi bảng.
- Export Excel theo filter đang xem.

## Thứ tự làm đề xuất

1. `Phase 1`: sửa được Đơn Dịch Vụ đầy đủ.
2. `Phase 2`: thêm `priceStatus` và xử lý đơn quên giá.
3. `Phase 3`: thêm model công nợ đối tác.
4. `Phase 4`: làm màn Sổ đối tác.
5. `Phase 5`: dashboard tổng hợp.
6. `Phase 6`: bảng nhanh giống sheet và export nâng cao.

## Quyết định cần duyệt

1. Duyệt hướng **web là nguồn chính, sheet chỉ import/export/backup**?
2. Duyệt nâng cấp `/dashboard/orders` thành sổ đơn khách chung thay vì tạo module `Đơn khách` riêng?
3. Duyệt thêm `priceStatus` để phân biệt `Đã có giá`, `Chưa báo giá`, `Miễn phí`, `Quên giá cũ`?
4. Duyệt tạo `Partner` + `PartnerLedgerEntry` cho công nợ đối tác?
5. Duyệt thứ tự làm: sửa đơn dịch vụ trước, rồi công nợ đối tác?
