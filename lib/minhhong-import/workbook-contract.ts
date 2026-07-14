export const MINHHONG_IMPORT_SHEETS = ["Đối tác", "Nhập hàng", "Thanh toán", "Trả hàng", "Đơn khách", "Đối soát"] as const;

export const MINHHONG_PARTNER_COLUMNS = ["Mã đối tác", "Tên đối tác", "Loại", "Số điện thoại", "Ghi chú", "Trạng thái"] as const;

export const MINHHONG_PURCHASE_COLUMNS = [
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
  "Chiết khấu (%)",
  "Tiền chiết khấu",
  "Thành tiền",
  "Đã nhận hàng",
  "Tính công nợ",
  "Ghi chú",
  "Dòng gốc",
] as const;

export const MINHHONG_PAYMENT_COLUMNS = [
  "Mã thanh toán",
  "Ngày",
  "Mã đối tác",
  "Tên đối tác",
  "Số tiền",
  "Phương thức",
  "Tính công nợ",
  "Ghi chú",
  "Dòng gốc",
] as const;

export const MINHHONG_RETURN_COLUMNS = [
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
] as const;

export const MINHHONG_CUSTOMER_ORDER_COLUMNS = [
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
] as const;

export const MINHHONG_RECONCILIATION_KEYS = [
  "long_opening_balance",
  "long_counted_purchase",
  "long_counted_payment",
  "long_payable",
  "long_historical_paid",
  "customer_order_rows",
  "customer_order_total",
  "customer_order_paid",
  "customer_legacy_missing_price_rows",
] as const;

export type MinhHongImportSheet = (typeof MINHHONG_IMPORT_SHEETS)[number];
export type MinhHongPartnerColumn = (typeof MINHHONG_PARTNER_COLUMNS)[number];
export type MinhHongPurchaseColumn = (typeof MINHHONG_PURCHASE_COLUMNS)[number];
export type MinhHongPaymentColumn = (typeof MINHHONG_PAYMENT_COLUMNS)[number];
export type MinhHongReturnColumn = (typeof MINHHONG_RETURN_COLUMNS)[number];
export type MinhHongCustomerOrderColumn = (typeof MINHHONG_CUSTOMER_ORDER_COLUMNS)[number];
export type MinhHongReconciliationKey = (typeof MINHHONG_RECONCILIATION_KEYS)[number];

export type MinhHongDebtFlag = "Có" | "Không" | "";
export type MinhHongPriceStatus = "Đã có giá" | "Quên giá" | "Chưa rõ" | "";

export interface MinhHongPartnerRow {
  partnerCode: string;
  partnerName: string;
  partnerType: string;
  phone: string;
  notes: string;
  status: string;
}

export interface MinhHongPurchaseRow {
  purchaseCode: string;
  purchaseDate: string;
  partnerCode: string;
  partnerName: string;
  sellerOrSource: string;
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  amount: number;
  receivedGoods: boolean;
  countsInDebt: MinhHongDebtFlag;
  notes: string;
  sourceRow: number;
}

export interface MinhHongPaymentRow {
  paymentCode: string;
  paymentDate: string;
  partnerCode: string;
  partnerName: string;
  amount: number;
  method: string;
  countsInDebt: MinhHongDebtFlag;
  notes: string;
  sourceRow: number;
}

export interface MinhHongReturnRow {
  returnCode: string;
  returnDate: string;
  partnerCode: string;
  partnerName: string;
  itemName: string;
  category: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  countsInDebt: MinhHongDebtFlag;
  notes: string;
  sourceRow: number;
}

export interface MinhHongCustomerOrderRow {
  orderCode: string;
  purchaseDate: string;
  customerName: string;
  customerPhone: string;
  product: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  priceStatus: MinhHongPriceStatus;
  notes: string;
  sourceRow: number;
}

export interface MinhHongReconciliationRow {
  key: MinhHongReconciliationKey;
  label: string;
  expectedAmount: number;
  actualAmount?: number;
  notes?: string;
}
