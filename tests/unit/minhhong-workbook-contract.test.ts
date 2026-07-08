import assert from "node:assert/strict";
import test from "node:test";
import {
  MINHHONG_CUSTOMER_ORDER_COLUMNS,
  MINHHONG_IMPORT_SHEETS,
  MINHHONG_PARTNER_COLUMNS,
  MINHHONG_PAYMENT_COLUMNS,
  MINHHONG_PURCHASE_COLUMNS,
  MINHHONG_RECONCILIATION_KEYS,
  MINHHONG_RETURN_COLUMNS,
} from "../../lib/minhhong-import/workbook-contract";

test("locks Minh Hong production import workbook sheets", () => {
  assert.deepEqual(MINHHONG_IMPORT_SHEETS, ["Đối tác", "Nhập hàng", "Thanh toán", "Trả hàng", "Đơn khách", "Đối soát"]);
});

test("locks partner import columns", () => {
  assert.deepEqual(MINHHONG_PARTNER_COLUMNS, ["Mã đối tác", "Tên đối tác", "Loại", "Số điện thoại", "Ghi chú", "Trạng thái"]);
});

test("locks partner ledger import columns", () => {
  assert.deepEqual(MINHHONG_PURCHASE_COLUMNS, [
    "Mã nhập",
    "Ngày nhập",
    "Mã đối tác",
    "Tên đối tác",
    "Người bán/nguồn gốc",
    "Tên hàng",
    "Loại",
    "Số lượng",
    "Đơn vị",
    "Đơn giá",
    "Thành tiền",
    "Đã nhận hàng",
    "Tính công nợ",
    "Ghi chú",
    "Dòng gốc",
  ]);
  assert.deepEqual(MINHHONG_PAYMENT_COLUMNS, [
    "Mã thanh toán",
    "Ngày",
    "Mã đối tác",
    "Tên đối tác",
    "Số tiền",
    "Phương thức",
    "Tính công nợ",
    "Ghi chú",
    "Dòng gốc",
  ]);
  assert.deepEqual(MINHHONG_RETURN_COLUMNS, [
    "Mã trả",
    "Ngày",
    "Mã đối tác",
    "Tên đối tác",
    "Tên hàng",
    "Loại",
    "Số lượng",
    "Đơn giá",
    "Thành tiền",
    "Tính công nợ",
    "Lý do/Ghi chú",
    "Dòng gốc",
  ]);
});

test("locks customer order import columns", () => {
  assert.deepEqual(MINHHONG_CUSTOMER_ORDER_COLUMNS, [
    "Mã đơn",
    "Ngày mua",
    "Tên khách",
    "Số điện thoại",
    "Sản phẩm",
    "Tổng tiền",
    "Đã thu",
    "Còn nợ",
    "Trạng thái giá",
    "Ghi chú",
    "Dòng gốc",
  ]);
});

test("locks reconciliation keys", () => {
  assert.deepEqual(MINHHONG_RECONCILIATION_KEYS, [
    "long_opening_balance",
    "long_counted_purchase",
    "long_counted_payment",
    "long_payable",
    "long_historical_paid",
    "customer_order_rows",
    "customer_order_total",
    "customer_order_paid",
    "customer_legacy_missing_price_rows",
  ]);
});
