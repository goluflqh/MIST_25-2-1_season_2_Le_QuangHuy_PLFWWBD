# Minh Hong Financial Audit Gate

Muc tieu cua gate nay la giu du lieu tien bac theo nguyen tac fail-closed: neu so lieu, cong thuc, hoac doi soat khong khop thi khong import vao production. Deploy code va import du lieu la hai buoc rieng biet.

## Nguyen tac bat buoc

- Khong bo qua ngam mot dong tien loi de van tinh tong.
- Phan cong no doi tac chi duoc confirm khi toan bo scope doi tac khong co blocking issue.
- Source Sheet la nguon nhap lieu truoc import; web la nguon quan ly sau khi import thanh cong.
- Sau khi import, web phai khop lai voi source theo ma on dinh:
  - Don khach: `orderCode`.
  - Giao dich doi tac: `sourceCode`.
- Moi lan truoc deploy co migration phai backup PostgreSQL production.

## Cong thuc chinh

Don khach:

```text
payable = max(quotedPrice - discountAmount, 0)
receivableDebt = priceStatus == CONFIRMED ? max(payable - paidAmount, 0) : 0
```

Partner ledger:

```text
signedAmount =
  0                       neu countsInDebt = false
  -abs(amount)             neu entryType = PAYMENT hoac RETURN
  amount                   neu entryType = ADJUSTMENT
  abs(amount)              neu entryType = OPENING_BALANCE hoac PURCHASE

partnerBalance = sum(signedAmount)
```

Long payable tu source workbook:

```text
longPayable =
  longOpeningBalance
  + longCountedPurchase
  - longCountedPayment
  - longCountedReturn
```

## Lenh audit

Audit workbook chuan da duyet, khong cham DB:

```bash
npm run minhhong:audit
```

Audit Sheet goc dang song, khong cham DB:

```bash
npm run minhhong:audit:raw
```

Audit rieng Don khach tu Sheet goc dang song:

```bash
npm run minhhong:audit:raw:orders
```

Audit rieng Doi tac tu Sheet goc dang song:

```bash
npm run minhhong:audit:raw:partners
```

Audit DB hien tai:

```bash
npm run minhhong:audit:db
```

Audit sau khi da import, so source va DB phai khop:

```bash
npm run minhhong:audit:compare:raw
```

Neu chi import don khach:

```bash
npm run minhhong:audit:compare:raw:orders
```

## Deploy/import gate

1. Chay `npm run test:unit`, `npm run minhhong:audit`, `npm run minhhong:rehearse`, `npm run lint`, `npm run build`.
2. Backup production DB tren VPS.
3. Deploy code va chay `prisma migrate deploy`.
4. Vao admin VPS, bam `Kiem tra tu Sheet goc`.
5. Neu preview co blocking issue thi dung, sua Sheet/hoi Minh Hong truoc.
6. Chi bam import scope nao da sach. Neu doi tac con loi Long 11 trieu thi khong bam import doi tac.
7. Sau import, chay `npm run minhhong:audit:compare:raw`. Neu chi import don khach thi chay `npm run minhhong:audit:compare:raw:orders`.

## Case hien tai

Dong `Don hang mua tu long dong 5` voi cot `Con 11.000.000` khong duoc bo qua ngam. Can xac nhan y nghia cua `440.000`, `4.420.000`, va `11.000.000` tren Sheet goc. Sheet hien tai cung dang co ngay `28/01/2029`; neu day la nam 2026 thi sua tren Sheet goc thanh `28/01/2026` truoc khi import doi tac. Khi Sheet duoc sua ro rang, audit/import se doc lai so moi nhat.
