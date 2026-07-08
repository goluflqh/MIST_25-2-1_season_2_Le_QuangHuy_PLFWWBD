export type AdminOrderSortMode = "excel" | "newest" | "oldest" | "debt" | "customer";

export interface AdminOrderDisplayInput {
  id?: string;
  source?: string | null;
  sourceName?: string | null;
  sourceRow?: number | null;
  orderDate?: string | Date | null;
  createdAt?: string | Date | null;
  customerPhone?: string | null;
  issueDescription?: string | null;
  notes?: string | null;
  orderCode?: string | null;
  productName?: string | null;
  solution?: string | null;
  customerName?: string | null;
  debtAmount?: number | null;
}

const IMPORT_FALLBACK_DATE_YEAR = 1900;
const IMPORT_FALLBACK_WINDOW_MS = 2 * 60 * 1000;

export const adminOrderSortLabels: Record<AdminOrderSortMode, string> = {
  customer: "Tên khách A-Z",
  debt: "Còn nợ nhiều",
  excel: "Thứ tự bảng Excel",
  newest: "Mới nhất",
  oldest: "Cũ nhất",
};

function toTime(value: string | Date | null | undefined) {
  if (!value) return Number.NaN;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.NaN;
}

function toDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function sourceRowValue(order: AdminOrderDisplayInput) {
  return Number.isFinite(order.sourceRow) && order.sourceRow ? Number(order.sourceRow) : Number.POSITIVE_INFINITY;
}

function createdAtTime(order: AdminOrderDisplayInput) {
  const time = toTime(order.createdAt);
  return Number.isFinite(time) ? time : 0;
}

function isImportedOrder(order: AdminOrderDisplayInput) {
  return String(order.source || "").toUpperCase() === "IMPORT";
}

export function getImportedFallbackOrderDate(sourceRow: number | null | undefined) {
  const safeRow = Number.isFinite(sourceRow) && sourceRow && sourceRow > 0 ? Math.floor(sourceRow) : 1;
  return new Date(Date.UTC(IMPORT_FALLBACK_DATE_YEAR, 0, safeRow));
}

export function isImportedOrderDateFallback(order: AdminOrderDisplayInput) {
  if (!isImportedOrder(order)) return false;

  const orderDate = toDate(order.orderDate);
  if (!orderDate) return false;

  if (orderDate.getUTCFullYear() === IMPORT_FALLBACK_DATE_YEAR) return true;

  const orderTime = orderDate.getTime();
  const createdTime = toTime(order.createdAt);
  if (!Number.isFinite(orderTime) || !Number.isFinite(createdTime)) return false;

  return Math.abs(orderTime - createdTime) <= IMPORT_FALLBACK_WINDOW_MS;
}

export function shouldHideImportedFallbackDate(order: AdminOrderDisplayInput) {
  return isImportedOrderDateFallback(order);
}

export function getAdminOrderSortLabel(sortMode: AdminOrderSortMode) {
  return adminOrderSortLabels[sortMode];
}

export function normalizeAdminOrderSearchText(value: string | number | null | undefined) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesAdminOrderSearch(order: AdminOrderDisplayInput, rawQuery: string) {
  const query = normalizeAdminOrderSearchText(rawQuery);
  if (!query) return true;

  return [
    order.orderCode,
    order.customerName,
    order.customerPhone,
    order.productName,
    order.issueDescription,
    order.solution,
    order.notes,
  ].some((value) => normalizeAdminOrderSearchText(value).includes(query));
}

function validOrderDateTime(order: AdminOrderDisplayInput) {
  if (isImportedOrderDateFallback(order)) return Number.NaN;
  return toTime(order.orderDate);
}

function compareBySourceRow(first: AdminOrderDisplayInput, second: AdminOrderDisplayInput) {
  const firstRow = sourceRowValue(first);
  const secondRow = sourceRowValue(second);
  if (firstRow !== secondRow) return firstRow - secondRow;
  return createdAtTime(second) - createdAtTime(first);
}

function compareByDate(first: AdminOrderDisplayInput, second: AdminOrderDisplayInput, direction: "asc" | "desc") {
  const firstTime = validOrderDateTime(first);
  const secondTime = validOrderDateTime(second);
  const firstHasDate = Number.isFinite(firstTime);
  const secondHasDate = Number.isFinite(secondTime);

  if (firstHasDate && !secondHasDate) return -1;
  if (!firstHasDate && secondHasDate) return 1;
  if (!firstHasDate && !secondHasDate) return compareBySourceRow(first, second);

  if (firstTime !== secondTime) {
    return direction === "asc" ? firstTime - secondTime : secondTime - firstTime;
  }

  return compareBySourceRow(first, second);
}

export function compareAdminOrders(
  first: AdminOrderDisplayInput,
  second: AdminOrderDisplayInput,
  sortMode: AdminOrderSortMode
) {
  if (sortMode === "excel") return compareBySourceRow(first, second);
  if (sortMode === "oldest") return compareByDate(first, second, "asc");
  if (sortMode === "debt") {
    const firstDebt = Number(first.debtAmount || 0);
    const secondDebt = Number(second.debtAmount || 0);
    if (firstDebt !== secondDebt) return secondDebt - firstDebt;
    return compareByDate(first, second, "desc");
  }
  if (sortMode === "customer") {
    const byCustomer = String(first.customerName || "").localeCompare(String(second.customerName || ""), "vi");
    return byCustomer || compareByDate(first, second, "desc");
  }
  return compareByDate(first, second, "desc");
}
