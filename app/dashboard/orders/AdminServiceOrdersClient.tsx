"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminVietnameseDateRangeFilter from "@/components/admin/AdminVietnameseDateRangeFilter";
import MinhHongWorkbookImportPanel from "@/components/admin/MinhHongWorkbookImportPanel";
import VietnameseDateInput from "@/components/admin/VietnameseDateInput";
import { useNotify } from "@/components/NotifyProvider";
import PaginationControls from "@/components/PaginationControls";
import {
  compareAdminOrders,
  getAdminOrderSortLabel,
  matchesAdminOrderSearch,
  shouldHideImportedFallbackDate,
  type AdminOrderSortMode,
} from "@/lib/admin-order-display";
import { adminTimePresetLabels, matchesAdminTimePreset, type AdminTimePreset } from "@/lib/admin-time-filter";
import { calculateCouponDiscount, getPayableAmount } from "@/lib/coupon-discounts";
import { getServiceOrderReceivableDebt, summarizeServiceOrderFinancials } from "@/lib/financial-calculations";
import { formatMoneyInputValue, parseMoneyText } from "@/lib/money";
import { formatVietnamDate, getVietnamDateKey, todayVietnamText } from "@/lib/vietnam-time";

interface ServiceOrderData {
  id: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string | null;
  service: string;
  productName: string;
  issueDescription: string | null;
  solution: string | null;
  status: string;
  source: string;
  sourceName: string | null;
  sourceRow: number | null;
  orderDate: string;
  quotedPrice: number | null;
  priceStatus: string;
  paidAmount: number;
  paidAt: string | null;
  contactRequestId: string | null;
  couponRedemptionId: string | null;
  couponCode: string | null;
  couponDiscount: string | null;
  discountAmount: number;
  warrantyMonths: number | null;
  warrantyEndDate: string | null;
  customerVisible: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    address: string | null;
    userId: string | null;
  };
  user: {
    id: string;
    name: string;
    phone: string;
  } | null;
  warranty: {
    id: string;
    serialNo: string;
    endDate: string;
  } | null;
  contactRequest: {
    id: string;
    status: string;
    userId: string | null;
    couponRedemptionId: string | null;
  } | null;
  couponRedemption: {
    id: string;
    coupon: {
      code: string;
      description: string;
      discount: string;
    };
  } | null;
}

type SortMode = AdminOrderSortMode;
type AccountFilter = "ALL" | "REGISTERED" | "NO_ACCOUNT";
type CouponFilter = "ALL" | "WITH_COUPON" | "WITHOUT_COUPON";
type PaymentFilter = "ALL" | "DEBT" | "PAID";
type PriceFilter = "ALL" | "CONFIRMED" | "PENDING_QUOTE" | "FREE" | "LEGACY_MISSING";
type WarrantyFilter = "ALL" | "WITH_WARRANTY" | "WITHOUT_WARRANTY";
const ORDER_PAGE_SIZE = 8;

interface OrderFormState {
  contactRequestId: string;
  customerAddress: string;
  customerName: string;
  customerPhone: string;
  customerVisible: boolean;
  couponCode: string;
  couponDiscount: string;
  couponRedemptionId: string;
  issueDescription: string;
  notes: string;
  orderDate: string;
  paidAmount: string;
  priceStatus: string;
  productName: string;
  quotedPrice: string;
  service: string;
  solution: string;
  source: string;
  status: string;
  warrantyMonths: string;
}

const serviceLabels: Record<string, string> = {
  DONG_PIN: "Đóng pin",
  DEN_NLMT: "Đèn năng lượng mặt trời",
  PIN_LUU_TRU: "Pin lưu trữ",
  CAMERA: "Camera an ninh",
  CUSTOM: "Theo yêu cầu",
  KHAC: "Khác",
};

const statusConfig: Record<string, { label: string; color: string; hint: string }> = {
  PENDING: {
    label: "Chờ xử lý",
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
    hint: "Tiếp nhận thông tin, kiểm tra lại khách và thiết bị.",
  },
  CONTACTED: {
    label: "Đã liên hệ",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    hint: "Đã gọi/chốt thông tin, tiếp tục báo phương án hoặc lịch làm.",
  },
  IN_PROGRESS: {
    label: "Đang xử lý",
    color: "bg-orange-100 text-orange-800 border-orange-200",
    hint: "Cập nhật tiến độ nếu khách hỏi.",
  },
  COMPLETED: {
    label: "Hoàn thành",
    color: "bg-green-100 text-green-800 border-green-200",
    hint: "Kiểm tra thanh toán và bảo hành.",
  },
  CANCELLED: {
    label: "Hủy",
    color: "bg-red-100 text-red-800 border-red-200",
    hint: "Giữ lịch sử để tránh chăm sóc trùng.",
  },
};

const priceStatusConfig: Record<string, { label: string; color: string; hint: string }> = {
  CONFIRMED: {
    label: "Đã xác nhận",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    hint: "Đơn đã có giá bán rõ ràng.",
  },
  PENDING_QUOTE: {
    label: "Chưa báo giá",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    hint: "Để trống giá cho tới khi báo khách.",
  },
  FREE: {
    label: "Miễn phí",
    color: "bg-slate-50 text-slate-700 border-slate-200",
    hint: "Không thu tiền đơn này.",
  },
  LEGACY_MISSING: {
    label: "Quên giá",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    hint: "Đơn cũ thiếu giá, cần bổ sung khi có dữ liệu.",
  },
};

const sourceLabels: Record<string, string> = {
  MANUAL: "Nhập tay",
  IMPORT: "Nhập từ Excel/CSV",
  PHONE: "Điện thoại",
  ZALO: "Zalo",
  FACEBOOK: "Facebook",
  WALK_IN: "Khách tới tiệm",
  CONTACT: "Từ yêu cầu web",
  OTHER: "Khác",
};

const productSuggestions: Record<string, string[]> = {
  DONG_PIN: ["Pin xe điện 48V", "Pin máy khoan", "Pin loa kéo", "Bộ pin theo yêu cầu"],
  DEN_NLMT: ["Đèn sân vườn NLMT", "Đèn cổng NLMT", "Thay pin đèn NLMT"],
  PIN_LUU_TRU: ["Pin lưu trữ gia đình", "Bộ kích đề 12V", "Pin dự phòng dung lượng lớn"],
  CAMERA: ["Camera gia đình", "Camera cửa hàng", "Lắp đặt camera an ninh"],
  CUSTOM: ["Bộ pin theo kích thước riêng", "Nguồn dự phòng theo yêu cầu"],
  KHAC: ["Tư vấn khác"],
};

const importColumns = [
  "ngay_don",
  "ten_khach",
  "so_dien_thoai",
  "dia_chi",
  "dich_vu",
  "san_pham",
  "tinh_trang",
  "phuong_an",
  "gia_bao",
  "tinh_trang_gia",
  "da_thu",
  "trang_thai",
  "bao_hanh_thang",
  "ghi_chu",
  "cho_khach_xem",
] as const;

function formatDate(value: string | null) {
  return formatVietnamDate(value) || "Chưa có";
}

function formatOrderDate(order: ServiceOrderData) {
  return shouldHideImportedFallbackDate(order) ? "Chưa có ngày" : formatDate(order.orderDate);
}

function todayText() {
  return todayVietnamText();
}

function createEmptyOrderForm(): OrderFormState {
  return {
    contactRequestId: "",
    customerAddress: "",
    customerName: "",
    customerPhone: "",
    customerVisible: false,
    couponCode: "",
    couponDiscount: "",
    couponRedemptionId: "",
    issueDescription: "",
    notes: "",
    orderDate: todayText(),
    paidAmount: "",
    priceStatus: "PENDING_QUOTE",
    productName: "",
    quotedPrice: "",
    service: "DONG_PIN",
    solution: "",
    source: "MANUAL",
    status: "PENDING",
    warrantyMonths: "6",
  };
}

function formatMoney(value: number | null | undefined) {
  if (!value) return "0đ";
  return `${value.toLocaleString("vi-VN")}đ`;
}

function getDebt(order: ServiceOrderData) {
  return getServiceOrderReceivableDebt(order);
}

function getNextPriceStatusForPrice(value: string, currentStatus: string) {
  const hasPrice = /\d/.test(value);
  if (hasPrice) return "CONFIRMED";
  if (currentStatus === "CONFIRMED") return "PENDING_QUOTE";
  return currentStatus;
}

function buildOrderFormData(order: ServiceOrderData): OrderFormState {
  return {
    contactRequestId: order.contactRequestId || "",
    customerAddress: order.customerAddress || "",
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerVisible: order.customerVisible,
    couponCode: order.couponCode || "",
    couponDiscount: order.couponDiscount || "",
    couponRedemptionId: order.couponRedemptionId || "",
    issueDescription: order.issueDescription || "",
    notes: order.notes || "",
    orderDate: formatVietnamDate(order.orderDate) || todayText(),
    paidAmount: order.paidAmount ? String(order.paidAmount) : "",
    priceStatus: order.priceStatus || "PENDING_QUOTE",
    productName: order.productName,
    quotedPrice: order.quotedPrice ? String(order.quotedPrice) : "",
    service: normalizeFormService(order.service),
    solution: order.solution || "",
    source: order.source,
    status: order.status,
    warrantyMonths: order.warrantyMonths === null || order.warrantyMonths === undefined ? "" : String(order.warrantyMonths),
  };
}

function splitDelimitedLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"" && next === "\"") {
      current += "\"";
      index += 1;
      continue;
    }

    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function detectDelimiter(text: string) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || "";
  if (firstLine.includes("\t")) return "\t";

  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ";" : ",";
}

function looksLikeHeader(cells: string[]) {
  const joined = cells.join(" ").toLowerCase();
  return joined.includes("ten_khach") || joined.includes("số điện thoại") || joined.includes("so_dien_thoai");
}

function parseImportText(text: string) {
  const delimiter = detectDelimiter(text);
  const rows = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => splitDelimitedLine(line, delimiter));

  const hasHeader = Boolean(rows[0] && looksLikeHeader(rows[0]));
  const dataRows = (hasHeader ? rows.slice(1) : rows).map((cells, index) => ({
    cells,
    rowNumber: hasHeader ? index + 2 : index + 1,
  }));

  return dataRows
    .filter(({ cells }) => cells.some((cell) => cell.trim()))
    .map(({ cells, rowNumber }) => {
      const hasPriceStatusColumn = cells.length >= importColumns.length;

      return {
        orderDate: cells[0] || "",
        customerName: cells[1] || "",
        customerPhone: cells[2] || "",
        customerAddress: cells[3] || "",
        service: cells[4] || "",
        productName: cells[5] || "",
        issueDescription: cells[6] || "",
        solution: cells[7] || "",
        quotedPrice: cells[8] || "",
        priceStatus: hasPriceStatusColumn ? cells[9] || "" : "",
        paidAmount: hasPriceStatusColumn ? cells[10] || "" : cells[9] || "",
        status: hasPriceStatusColumn ? cells[11] || "" : cells[10] || "",
        warrantyMonths: hasPriceStatusColumn ? cells[12] || "" : cells[11] || "",
        notes: hasPriceStatusColumn ? cells[13] || "" : cells[12] || "",
        customerVisible: hasPriceStatusColumn ? cells[14] || "" : cells[13] || "",
        sourceName: "Import đơn dịch vụ",
        sourceRow: rowNumber,
      };
    });
}

function buildTemplateCsv() {
  const sample = [
    "27/04/2026",
    "Nguyễn Văn A",
    "0987443258",
    "Đồng Dương, Đà Nẵng",
    "DONG_PIN",
    "Pin xe điện 48V",
    "Pin chai nhanh",
    "Thay cell, kiểm tra BMS",
    "1500000",
    "CONFIRMED",
    "500000",
    "COMPLETED",
    "6",
    "Đơn cũ nhập lại từ sổ",
    "khong",
  ];
  return `${importColumns.join(",")}\n${sample.map((cell) => `"${cell}"`).join(",")}\n`;
}

function downloadImportTemplate() {
  const blob = new Blob([`\uFEFF${buildTemplateCsv()}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "mau-import-don-dich-vu-minh-hong.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function normalizeFormService(value: string | null) {
  const raw = String(value || "").trim();
  const upper = raw.toUpperCase();
  if (upper in serviceLabels) return upper;

  const aliases: Record<string, string> = {
    battery: "DONG_PIN",
    camera: "CAMERA",
    contact: "KHAC",
    custom: "CUSTOM",
  };

  return aliases[raw.toLowerCase()] || "KHAC";
}

export default function AdminServiceOrdersClient({
  initialOrders,
}: {
  initialOrders: ServiceOrderData[];
}) {
  const { showToast, showConfirm } = useNotify();
  const orderFormRef = useRef<HTMLFormElement | null>(null);
  const orderFirstFieldRef = useRef<HTMLInputElement | null>(null);
  const importPanelRef = useRef<HTMLDivElement | null>(null);
  const importTextRef = useRef<HTMLTextAreaElement | null>(null);
  const appliedPrefillRef = useRef(false);
  const editDrawerOpenerRef = useRef<HTMLElement | null>(null);
  const [orders, setOrders] = useState(initialOrders);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importFailures, setImportFailures] = useState<Array<{ rowNumber: number; message: string }>>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [syncingSheet, setSyncingSheet] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [serviceFilter, setServiceFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [showFilterControls, setShowFilterControls] = useState(true);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [orderTimePreset, setOrderTimePreset] = useState<AdminTimePreset>("ALL");
  const [orderCustomFromDate, setOrderCustomFromDate] = useState("");
  const [orderCustomToDate, setOrderCustomToDate] = useState("");
  const [accountFilter, setAccountFilter] = useState<AccountFilter>("ALL");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("ALL");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("ALL");
  const [warrantyFilter, setWarrantyFilter] = useState<WarrantyFilter>("ALL");
  const [couponFilter, setCouponFilter] = useState<CouponFilter>("ALL");
  const [sortMode, setSortMode] = useState<SortMode>("excel");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [warrantyCreatingId, setWarrantyCreatingId] = useState<string | null>(null);
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [formData, setFormData] = useState<OrderFormState>(() => createEmptyOrderForm());
  const editingOrder = editingId ? orders.find((order) => order.id === editingId) || null : null;

  const importPreview = useMemo(() => {
    if (!importText.trim()) return [];
    return parseImportText(importText);
  }, [importText]);

  const metrics = useMemo(() => {
    const financials = summarizeServiceOrderFinancials(orders);
    return {
      debt: financials.debt,
      discount: financials.discount,
      legacyMissing: orders.filter((order) => order.priceStatus === "LEGACY_MISSING").length,
      paid: financials.paid,
      pendingQuote: orders.filter((order) => order.priceStatus === "PENDING_QUOTE").length,
      quoted: financials.quoted,
      total: orders.length,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const todayKey = getVietnamDateKey(new Date());

    return orders
      .filter((order) => {
        const orderDateKey = shouldHideImportedFallbackDate(order) ? "" : getVietnamDateKey(order.orderDate);
        const matchesStatus = statusFilter === "ALL" || order.status === statusFilter;
        const matchesService = serviceFilter === "ALL" || order.service === serviceFilter;
        const matchesSource = sourceFilter === "ALL" || order.source === sourceFilter;
        const matchesTime = matchesAdminTimePreset(
          orderDateKey,
          orderTimePreset,
          todayKey,
          orderCustomFromDate,
          orderCustomToDate
        );
        const hasAccount = Boolean(order.user || order.customer.userId);
        const matchesAccount =
          accountFilter === "ALL"
          || (accountFilter === "REGISTERED" && hasAccount)
          || (accountFilter === "NO_ACCOUNT" && !hasAccount);
        const debt = getDebt(order);
        const matchesPrice = priceFilter === "ALL" || order.priceStatus === priceFilter;
        const matchesPayment =
          paymentFilter === "ALL"
          || (paymentFilter === "DEBT" && debt > 0)
          || (paymentFilter === "PAID" && debt === 0);
        const matchesWarranty =
          warrantyFilter === "ALL"
          || (warrantyFilter === "WITH_WARRANTY" && Boolean(order.warranty))
          || (warrantyFilter === "WITHOUT_WARRANTY" && !order.warranty);
        const matchesCoupon =
          couponFilter === "ALL"
          || (couponFilter === "WITH_COUPON" && Boolean(order.couponCode))
          || (couponFilter === "WITHOUT_COUPON" && !order.couponCode);
        const matchesSearch = matchesAdminOrderSearch(order, searchQuery);

        return matchesStatus
          && matchesService
          && matchesSource
          && matchesTime
          && matchesAccount
          && matchesPrice
          && matchesPayment
          && matchesWarranty
          && matchesCoupon
          && matchesSearch;
      })
      .sort((first, second) => compareAdminOrders(
        { ...first, debtAmount: getDebt(first) },
        { ...second, debtAmount: getDebt(second) },
        sortMode
      ));
  }, [accountFilter, couponFilter, orderCustomFromDate, orderCustomToDate, orderTimePreset, orders, paymentFilter, priceFilter, searchQuery, serviceFilter, sortMode, sourceFilter, statusFilter, warrantyFilter]);

  const filteredOrderStats = useMemo(() => {
    return filteredOrders.reduce(
      (summary, order) => {
        summary.debt += getDebt(order);
        summary.paid += order.paidAmount;
        summary.quoted += order.quotedPrice || 0;
        return summary;
      },
      { debt: 0, paid: 0, quoted: 0 }
    );
  }, [filteredOrders]);

  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / ORDER_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleOrders = filteredOrders.slice((currentPage - 1) * ORDER_PAGE_SIZE, currentPage * ORDER_PAGE_SIZE);
  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onClear: () => void }> = [];
    if (searchQuery.trim()) chips.push({ key: "search", label: `Tìm: ${searchQuery.trim()}`, onClear: () => setSearchQuery("") });
    if (orderTimePreset !== "ALL") chips.push({ key: "time", label: `Thời gian: ${adminTimePresetLabels[orderTimePreset]}`, onClear: () => { setOrderTimePreset("ALL"); setOrderCustomFromDate(""); setOrderCustomToDate(""); } });
    if (statusFilter !== "ALL") chips.push({ key: "status", label: `Trạng thái: ${statusConfig[statusFilter]?.label || statusFilter}`, onClear: () => setStatusFilter("ALL") });
    if (serviceFilter !== "ALL") chips.push({ key: "service", label: `Dịch vụ: ${serviceLabels[serviceFilter] || serviceFilter}`, onClear: () => setServiceFilter("ALL") });
    if (sourceFilter !== "ALL") chips.push({ key: "source", label: `Nguồn: ${sourceLabels[sourceFilter] || sourceFilter}`, onClear: () => setSourceFilter("ALL") });
    if (accountFilter !== "ALL") chips.push({ key: "account", label: accountFilter === "REGISTERED" ? "Có tài khoản" : "Chưa có tài khoản", onClear: () => setAccountFilter("ALL") });
    if (paymentFilter !== "ALL") chips.push({ key: "payment", label: paymentFilter === "DEBT" ? "Còn nợ" : "Đã thu đủ", onClear: () => setPaymentFilter("ALL") });
    if (priceFilter !== "ALL") chips.push({ key: "price", label: `Giá: ${priceStatusConfig[priceFilter]?.label || priceFilter}`, onClear: () => setPriceFilter("ALL") });
    if (warrantyFilter !== "ALL") chips.push({ key: "warranty", label: warrantyFilter === "WITH_WARRANTY" ? "Có bảo hành" : "Chưa có bảo hành", onClear: () => setWarrantyFilter("ALL") });
    if (couponFilter !== "ALL") chips.push({ key: "coupon", label: couponFilter === "WITH_COUPON" ? "Có mã giảm giá" : "Không có mã", onClear: () => setCouponFilter("ALL") });
    if (sortMode !== "excel") chips.push({ key: "sort", label: `Sắp xếp: ${getAdminOrderSortLabel(sortMode)}`, onClear: () => setSortMode("excel") });
    return chips;
  }, [accountFilter, couponFilter, orderTimePreset, paymentFilter, priceFilter, searchQuery, serviceFilter, sortMode, sourceFilter, statusFilter, warrantyFilter]);

  const hasActiveFilters = activeFilterChips.length > 0;

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setServiceFilter("ALL");
    setSourceFilter("ALL");
    setOrderTimePreset("ALL");
    setOrderCustomFromDate("");
    setOrderCustomToDate("");
    setAccountFilter("ALL");
    setPaymentFilter("ALL");
    setPriceFilter("ALL");
    setWarrantyFilter("ALL");
    setCouponFilter("ALL");
    setSortMode("excel");
    setPage(1);
  };

  useEffect(() => {
    setImportFailures([]);
  }, [importText]);

  useEffect(() => {
    setPage(1);
  }, [accountFilter, couponFilter, orderCustomFromDate, orderCustomToDate, orderTimePreset, paymentFilter, priceFilter, searchQuery, serviceFilter, sortMode, sourceFilter, statusFilter, warrantyFilter]);

  const scrollToWorkArea = useCallback((
    panelRef: React.RefObject<HTMLElement | null>,
    focusRef: React.RefObject<HTMLElement | null>
  ) => {
    window.setTimeout(() => {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      focusRef.current?.focus({ preventScroll: true });
    }, 50);
  }, []);

  const openCreateForm = useCallback(() => {
    setEditingId(null);
    setFormData(createEmptyOrderForm());
    setShowImport(false);
    setShowForm(true);
    setError("");
    scrollToWorkArea(orderFormRef, orderFirstFieldRef);
  }, [scrollToWorkArea]);

  const openImportPanel = useCallback(() => {
    setShowForm(false);
    setShowImport(true);
    setError("");
    scrollToWorkArea(importPanelRef, importTextRef);
  }, [scrollToWorkArea]);

  useEffect(() => {
    if (appliedPrefillRef.current) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("source") !== "CONTACT") return;

    const customerName = params.get("customerName") || "";
    const customerPhone = params.get("customerPhone") || "";
    if (!customerName && !customerPhone) return;

    appliedPrefillRef.current = true;
    setFormData((prev) => ({
      ...prev,
      contactRequestId: params.get("contactRequestId") || "",
      couponCode: params.get("couponCode") || "",
      couponDiscount: params.get("couponDiscount") || "",
      couponRedemptionId: params.get("couponRedemptionId") || "",
      customerVisible: true,
      customerName,
      customerPhone,
      issueDescription: params.get("issueDescription") || "",
      notes: params.get("notes") || "",
      priceStatus: "PENDING_QUOTE",
      productName: params.get("productName") || "",
      service: normalizeFormService(params.get("service")),
      source: "CONTACT",
      status: params.get("status") || "PENDING",
      warrantyMonths: "6",
    }));
    setEditingId(null);
    setShowImport(false);
    setShowForm(true);
    setError("");
    scrollToWorkArea(orderFormRef, orderFirstFieldRef);
  }, [scrollToWorkArea]);

  const resetForm = () => {
    setEditingId(null);
    setFormData(createEmptyOrderForm());
  };

  const editOrder = (order: ServiceOrderData) => {
    editDrawerOpenerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setEditingId(order.id);
    setFormData(buildOrderFormData(order));
    setShowImport(false);
    setShowForm(true);
    setError("");
    window.setTimeout(() => {
      orderFirstFieldRef.current?.focus({ preventScroll: true });
    }, 50);
  };

  useEffect(() => {
    if (!editingId) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setShowForm(false);
        setEditingId(null);
        setFormData(createEmptyOrderForm());
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = orderFormRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const opener = editDrawerOpenerRef.current;
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, [editingId]);

  const saveOrderForm = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    const payload = {
      ...formData,
      customerAddress: formData.customerAddress.trim(),
      customerName: formData.customerName.trim(),
      customerPhone: formData.customerPhone.trim(),
      issueDescription: formData.issueDescription.trim(),
      notes: formData.notes.trim(),
      paidAmount: formData.paidAmount.trim() ? String(parseMoneyText(formData.paidAmount)) : "",
      productName: formData.productName.trim(),
      quotedPrice: formData.quotedPrice.trim() ? String(parseMoneyText(formData.quotedPrice)) : "",
      solution: formData.solution.trim(),
    };

    if (!payload.customerName || !payload.customerPhone || !payload.productName) {
      const message = "Nhập tối thiểu tên khách, số điện thoại và sản phẩm/thiết bị.";
      setError(message);
      showToast(message, "error");
      return;
    }

    if (payload.priceStatus === "CONFIRMED" && parseMoneyText(payload.quotedPrice) <= 0) {
      const message = "Đơn đã xác nhận giá cần có giá bán lớn hơn 0đ.";
      setError(message);
      showToast(message, "error");
      return;
    }

    try {
      if (editingId) {
        const saved = await updateOrder(editingId, payload, null);
        if (!saved) return;

        setShowForm(false);
        resetForm();
        showToast("Đã lưu đầy đủ đơn.", "success");
        return;
      }

      const response = await fetch("/api/admin/service-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        const message = data.message || "Chưa tạo được đơn dịch vụ.";
        setError(message);
        showToast(message, "error");
        return;
      }

      setOrders((prev) => [data.order, ...prev]);
      setShowForm(false);
      resetForm();
      showToast("Đã tạo đơn dịch vụ.", "success");
    } catch {
      const message = "Kết nối bị gián đoạn khi tạo đơn.";
      setError(message);
      showToast(message, "error");
    }
  };

  const updateOrder = async (
    id: string,
    patch: Record<string, unknown>,
    optimisticPatch: Partial<ServiceOrderData> | null = patch as Partial<ServiceOrderData>
  ) => {
    const previousOrder = orders.find((order) => order.id === id);
    if (!previousOrder) return false;

    setSavingId(id);
    if (optimisticPatch) {
      setOrders((prev) => prev.map((order) => (order.id === id ? { ...order, ...optimisticPatch } : order)));
    }

    try {
      const response = await fetch("/api/admin/service-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        if (optimisticPatch) {
          setOrders((prev) => prev.map((order) => (order.id === id ? previousOrder : order)));
        }
        showToast(data.message || "Chưa cập nhật được đơn.", "error");
        return false;
      }

      setOrders((prev) => prev.map((order) => (order.id === id ? data.order : order)));
      if (!editingId) {
        showToast(
          !previousOrder.warranty && data.order?.warranty
            ? "Đã cập nhật đơn và tự tạo phiếu bảo hành 6 tháng."
            : "Đã cập nhật đơn.",
          "success"
        );
      }
      return true;
    } catch {
      if (optimisticPatch) {
        setOrders((prev) => prev.map((order) => (order.id === id ? previousOrder : order)));
      }
      showToast("Kết nối bị gián đoạn khi cập nhật đơn.", "error");
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const savePayment = (order: ServiceOrderData) => {
    const input = paymentInputs[order.id] ?? String(order.paidAmount || "");
    updateOrder(order.id, { paidAmount: parseMoneyText(input) });
  };

  const markPaidInFull = (order: ServiceOrderData) => {
    updateOrder(order.id, { paidAmount: getPayableAmount(order.quotedPrice, order.discountAmount) });
  };

  const deleteOrder = (id: string) => {
    showConfirm("Xoá đơn dịch vụ này khỏi danh sách quản trị?", async () => {
      setDeletingId(id);

      try {
        const response = await fetch("/api/admin/service-orders", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          showToast(data.message || "Chưa xoá được đơn.", "error");
          return;
        }

        setOrders((prev) => prev.filter((order) => order.id !== id));
        showToast("Đã xoá đơn dịch vụ.", "success");
      } catch {
        showToast("Kết nối bị gián đoạn khi xoá đơn.", "error");
      } finally {
        setDeletingId(null);
      }
    });
  };

  const createWarrantyFromOrder = async (order: ServiceOrderData) => {
    if (order.warranty) return;

    setWarrantyCreatingId(order.id);
    try {
      const response = await fetch("/api/admin/warranty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceOrderId: order.id,
          warrantyMonths: order.warrantyMonths ?? 6,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        showToast(data.message || "Chưa tạo được phiếu bảo hành từ đơn này.", "error");
        return;
      }

      setOrders((prev) =>
        prev.map((item) =>
          item.id === order.id
            ? {
                ...item,
                warranty: {
                  id: data.warranty.id,
                  serialNo: data.warranty.serialNo,
                  endDate: data.warranty.endDate,
                },
                warrantyEndDate: data.warranty.endDate,
                warrantyMonths: item.warrantyMonths ?? 6,
              }
            : item
        )
      );
      showToast(data.created ? "Đã tạo phiếu bảo hành 6 tháng từ đơn." : "Đơn này đã có phiếu bảo hành.", "success");
    } catch {
      showToast("Kết nối bị gián đoạn khi tạo bảo hành từ đơn.", "error");
    } finally {
      setWarrantyCreatingId(null);
    }
  };

  const importOrders = async () => {
    if (importPreview.length === 0) {
      showToast("Chưa có dòng import hợp lệ.", "error");
      return;
    }

    setIsImporting(true);
    setImportFailures([]);

    try {
      const response = await fetch("/api/admin/service-orders/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders: importPreview }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        showToast(data.message || "Chưa import được đơn.", "error");
        return;
      }

      if (data.orders?.length) {
        setOrders((prev: ServiceOrderData[]) => [...data.orders, ...prev]);
      }
      setImportFailures(data.failed || []);
      if (!data.failed?.length) {
        setImportText("");
        setShowImport(false);
      }
      showToast(
        data.failed?.length
          ? `Đã import ${data.createdCount || 0} đơn, còn vài dòng cần sửa.`
          : `Đã import ${data.createdCount || 0} đơn.`,
        "success"
      );
    } catch {
      showToast("Kết nối bị gián đoạn khi import đơn.", "error");
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportFile = (file: File | undefined) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setImportText(String(reader.result || ""));
    reader.onerror = () => showToast("Không đọc được file import.", "error");
    reader.readAsText(file, "utf-8");
  };

  const syncGoogleSheet = async () => {
    showConfirm("Xuất danh sách đơn bán/đơn dịch vụ hiện tại trên web sang tab WEB_Đơn hàng trong Google Sheet? Các tab gốc Minh Hồng và tab đối tác sẽ không bị ghi hoặc xoá.", async () => {
      setSyncingSheet(true);
      try {
        const response = await fetch("/api/admin/sheets-sync?scope=service-orders", { method: "POST" });
        const data = await response.json();

        if (!response.ok || !data.success) {
          showToast(data.message || "Chưa xuất được dữ liệu web sang Google Sheet.", "error");
          return;
        }

        showToast(`Đã xuất ${data.tabs?.length || 0} tab đơn bán từ web sang Google Sheet.`, "success");
      } catch {
        showToast("Kết nối bị gián đoạn khi xuất web sang Google Sheet.", "error");
      } finally {
        setSyncingSheet(false);
      }
    }, "Xuất");
  };

  const formQuotedPrice = parseMoneyText(formData.quotedPrice);
  const formDiscountAmount = calculateCouponDiscount(formData.couponDiscount, formQuotedPrice);
  const formPayableAmount = getPayableAmount(formQuotedPrice, formDiscountAmount);

  return (
    <div data-testid="dashboard-service-orders" className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-body text-xs font-bold uppercase tracking-wider text-red-600">Sổ đơn nội bộ</p>
          <h2 className="font-heading text-xl font-extrabold text-slate-900">Đơn Dịch Vụ & Đơn Cũ</h2>
          <p className="font-body text-sm text-slate-500">
            Nhập đơn từ tiệm, điện thoại, Zalo hoặc nhập lại sổ cũ theo số điện thoại khách.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button
            type="button"
            onClick={syncGoogleSheet}
            disabled={syncingSheet}
            className="min-h-11 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-body font-bold text-slate-700 transition-colors hover:bg-slate-200 disabled:bg-slate-200 disabled:text-slate-400"
          >
            {syncingSheet ? "Đang xuất…" : "Xuất web → Sheet"}
          </button>
          <button
            type="button"
            data-testid="dashboard-orders-open-import"
            onClick={openImportPanel}
            className="min-h-11 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-body font-bold text-white transition-colors hover:bg-slate-800"
          >
            CSV đơn lẻ (nâng cao)
          </button>
          <button
            type="button"
            data-testid="dashboard-orders-open-create"
            onClick={openCreateForm}
            className="col-span-2 min-h-11 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-body font-bold text-white transition-colors hover:bg-red-700 sm:col-span-1"
          >
            + Thêm đơn
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="font-body text-xs uppercase tracking-wider text-slate-400">Tổng đơn</p>
          <p className="mt-1 font-heading text-3xl font-extrabold text-slate-900">{metrics.total}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="font-body text-xs uppercase tracking-wider text-slate-400">Giá gốc đã báo</p>
          <p className="mt-1 font-heading text-2xl font-extrabold text-slate-900">{formatMoney(metrics.quoted)}</p>
          <p className="mt-1 font-body text-xs text-emerald-700">Đã giảm: {formatMoney(metrics.discount)}</p>
          <p className="mt-1 font-body text-xs text-amber-700">
            Quên giá {metrics.legacyMissing} · chưa báo {metrics.pendingQuote}
          </p>
        </div>
        <div className="rounded-2xl border border-green-100 bg-green-50 p-5">
          <p className="font-body text-xs uppercase tracking-wider text-green-700">Đã thu</p>
          <p className="mt-1 font-heading text-2xl font-extrabold text-green-700">{formatMoney(metrics.paid)}</p>
        </div>
        <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
          <p className="font-body text-xs uppercase tracking-wider text-red-700">Còn phải thu</p>
          <p className="mt-1 font-heading text-2xl font-extrabold text-red-700">{formatMoney(metrics.debt)}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-red-100 bg-red-50/40 p-3 shadow-sm sm:p-4">
        <MinhHongWorkbookImportPanel scope="service-orders" onImported={() => window.location.reload()} />
      </div>

      {showForm ? (
        <div className={editingId ? "fixed inset-0 z-[80] flex items-end bg-slate-950/30 p-0 backdrop-blur-[1px] sm:items-stretch sm:justify-end" : ""}>
          {editingId ? (
            <div
              aria-hidden="true"
              onMouseDown={() => {
                setShowForm(false);
                resetForm();
              }}
              className="absolute inset-0 cursor-default"
            />
          ) : null}
          <form
            ref={orderFormRef}
            onSubmit={saveOrderForm}
            role={editingId ? "dialog" : undefined}
            aria-modal={editingId ? true : undefined}
            aria-labelledby={editingId ? "dashboard-order-edit-title" : undefined}
            className={editingId
              ? "relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-slate-100 bg-white p-4 shadow-2xl sm:h-full sm:max-h-none sm:w-[min(760px,100vw)] sm:rounded-none sm:p-6"
              : "scroll-mt-28 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6"}
          >
            <div className={`${editingId ? "sticky top-0 z-10 -mx-4 -mt-4 mb-4 border-b border-slate-100 bg-white/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:-mt-6 sm:px-6" : "mb-4"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 id={editingId ? "dashboard-order-edit-title" : undefined} className="font-heading text-lg font-bold text-slate-900">
                    {editingId ? "Sửa đơn đang xem" : "Thêm đơn nhanh"}
                  </h3>
                  <p className="font-body text-sm text-slate-500">
                    {editingId && editingOrder
                      ? `${editingOrder.orderCode} · ${editingOrder.customerName} · ${editingOrder.customerPhone}`
                      : "Chỉ cần nhập tên, SĐT và sản phẩm. Nếu chưa có giá, để trạng thái giá là Chưa báo giá."}
                  </p>
                </div>
                {editingId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                    className="min-h-11 rounded-xl bg-slate-100 px-4 py-2 text-sm font-body font-bold text-slate-700 hover:bg-slate-200"
                  >
                    Đóng
                  </button>
                ) : null}
              </div>
            </div>
          {error ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-body text-red-600">
              {error}
            </div>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-3">
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-600">Tên khách</span>
              <input
                ref={orderFirstFieldRef}
                data-testid="dashboard-order-customer-name-input"
                value={formData.customerName}
                onChange={(event) => setFormData({ ...formData, customerName: event.target.value })}
                placeholder="Ví dụ: Nguyễn Văn A"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              />
            </label>
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-600">Số điện thoại</span>
              <input
                type="tel"
                inputMode="tel"
                value={formData.customerPhone}
                onChange={(event) => setFormData({ ...formData, customerPhone: event.target.value })}
                placeholder="Ví dụ: 0912345678"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              />
            </label>
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-600">Địa chỉ</span>
              <input
                value={formData.customerAddress}
                onChange={(event) => setFormData({ ...formData, customerAddress: event.target.value })}
                placeholder="Xã/phường, Đà Nẵng"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              />
            </label>
            <VietnameseDateInput
              dataTestId="dashboard-order-date-input"
              label="Ngày đơn"
              name="orderDate"
              value={formData.orderDate}
              onChange={(value) => setFormData({ ...formData, orderDate: value })}
            />
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-600">Dịch vụ</span>
              <select
                value={formData.service}
                onChange={(event) => setFormData({ ...formData, service: event.target.value, productName: "" })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
                title="Chọn dịch vụ"
              >
                {Object.entries(serviceLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-600">Trạng thái</span>
              <select
                value={formData.status}
                onChange={(event) => setFormData({ ...formData, status: event.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
                title="Chọn trạng thái"
              >
                {Object.entries(statusConfig).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 lg:col-span-2">
              <span className="font-body text-xs font-bold text-slate-600">Sản phẩm / thiết bị</span>
              <input
                data-testid="dashboard-order-product-input"
                value={formData.productName}
                onChange={(event) => setFormData({ ...formData, productName: event.target.value })}
                placeholder="Ví dụ: Pin xe điện 48V"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              />
              <div className="flex flex-wrap gap-2 pt-1">
                {(productSuggestions[formData.service] || []).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setFormData({ ...formData, productName: suggestion })}
                    className="min-h-10 rounded-full bg-slate-100 px-3 py-2 text-sm font-body font-bold text-slate-600 hover:bg-slate-200"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </label>
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-600">Nguồn đơn</span>
              <select
                value={formData.source}
                onChange={(event) => setFormData({ ...formData, source: event.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
                title="Nguồn đơn"
              >
                {Object.entries(sourceLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-600">Giá báo gốc</span>
              <input
                inputMode="numeric"
                data-testid="dashboard-order-quoted-price-input"
                value={formData.quotedPrice}
                onChange={(event) => setFormData({
                  ...formData,
                  priceStatus: getNextPriceStatusForPrice(event.target.value, formData.priceStatus),
                  quotedPrice: event.target.value,
                })}
                onBlur={() => setFormData((current) => ({ ...current, quotedPrice: formatMoneyInputValue(current.quotedPrice) }))}
                placeholder="Ví dụ: 100k hoặc 1.000.000"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              />
            </label>
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-600">Tình trạng giá</span>
              <select
                value={formData.priceStatus}
                onChange={(event) => setFormData({
                  ...formData,
                  priceStatus: event.target.value,
                  quotedPrice: event.target.value === "FREE" ? "" : formData.quotedPrice,
                })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
                title="Tình trạng giá"
              >
                {Object.entries(priceStatusConfig).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
              <p className="font-body text-xs text-slate-400">
                {priceStatusConfig[formData.priceStatus]?.hint || priceStatusConfig.PENDING_QUOTE.hint}
              </p>
            </label>
            {formData.couponRedemptionId ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                <p className="font-body text-xs font-bold text-emerald-700">Mã khách chọn</p>
                <p className="mt-1 font-heading text-sm font-extrabold text-emerald-900">
                  {formData.couponCode || "Mã ưu đãi"} - giảm {formData.couponDiscount || "theo mã"}
                </p>
                <p className="mt-1 font-body text-xs text-emerald-800">
                  Giảm dự kiến {formatMoney(formDiscountAmount)} · khách cần trả {formatMoney(formPayableAmount)}
                </p>
              </div>
            ) : null}
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-600">Đã thu</span>
              <input
                inputMode="numeric"
                data-testid="dashboard-order-paid-amount-input"
                value={formData.paidAmount}
                onChange={(event) => setFormData({ ...formData, paidAmount: event.target.value })}
                onBlur={() => setFormData((current) => ({ ...current, paidAmount: formatMoneyInputValue(current.paidAmount) }))}
                placeholder="Ví dụ: 100k hoặc 500.000"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              />
            </label>
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-600">Bảo hành tháng</span>
              <input
                inputMode="numeric"
                value={formData.warrantyMonths}
                onChange={(event) => setFormData({ ...formData, warrantyMonths: event.target.value })}
                placeholder="Mặc định: 6"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              />
            </label>
            <label className="space-y-1.5 lg:col-span-3">
              <span className="font-body text-xs font-bold text-slate-600">Tình trạng khách báo</span>
              <textarea
                value={formData.issueDescription}
                onChange={(event) => setFormData({ ...formData, issueDescription: event.target.value })}
                rows={2}
                placeholder="Ví dụ: pin sạc không vào, dùng nhanh tụt áp"
                className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              />
            </label>
            <label className="space-y-1.5 lg:col-span-3">
              <span className="font-body text-xs font-bold text-slate-600">Phương án xử lý</span>
              <textarea
                value={formData.solution}
                onChange={(event) => setFormData({ ...formData, solution: event.target.value })}
                rows={2}
                placeholder="Ví dụ: thay cell, giữ vỏ, kiểm tra lại BMS"
                className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              />
            </label>
            <label className="space-y-1.5 lg:col-span-2">
              <span className="font-body text-xs font-bold text-slate-600">Ghi chú nội bộ</span>
              <input
                value={formData.notes}
                onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
                placeholder="Ví dụ: khách hẹn lấy chiều mai"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              />
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
              <input
                type="checkbox"
                checked={formData.customerVisible}
                onChange={(event) => setFormData({ ...formData, customerVisible: event.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-red-600"
              />
              <span className="font-body text-sm font-bold text-slate-700">Hiện trong tài khoản khách</span>
            </label>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="submit"
              data-testid="dashboard-order-save-button"
              disabled={Boolean(editingId && savingId === editingId)}
              className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-body font-bold text-white hover:bg-red-700 disabled:bg-slate-300"
            >
              {editingId && savingId === editingId ? "Đang lưu..." : "Lưu đơn"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-body font-bold text-slate-600 hover:bg-slate-200"
            >
              Huỷ
            </button>
            </div>
          </form>
        </div>
      ) : null}

      {showImport ? (
        <div
          ref={importPanelRef}
          data-testid="dashboard-orders-single-import-panel"
          className="scroll-mt-28 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-heading text-lg font-bold text-slate-900">Nâng cao: nhập CSV/TSV một đơn</h3>
              <p className="font-body text-sm text-slate-500">
                Luồng chính là Sheet/Excel chuẩn ở phía trên. Mục này chỉ dùng khi cần nhập nhanh một danh sách đơn lẻ từ CSV/TSV.
              </p>
            </div>
            <button
              type="button"
              onClick={downloadImportTemplate}
              className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-body font-bold text-slate-700 hover:bg-slate-200"
            >
              Tải mẫu CSV
            </button>
            <button
              type="button"
              data-testid="dashboard-orders-import-close"
              onClick={() => setShowImport(false)}
              aria-label="Đóng nhập CSV nâng cao"
              className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-body font-bold text-slate-700 hover:bg-slate-200"
            >
              Đóng
            </button>
          </div>
          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="font-body text-xs font-bold uppercase tracking-wider text-slate-500">Thứ tự cột</p>
            <p className="mt-1 break-words font-mono text-xs text-slate-500">{importColumns.join(" | ")}</p>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[0.8fr_1fr]">
            <label className="space-y-2">
              <span className="font-body text-xs font-bold text-slate-600">Chọn file CSV/TSV</span>
              <input
                type="file"
                accept=".csv,.tsv,text/csv,text/tab-separated-values"
                onChange={(event) => handleImportFile(event.target.files?.[0])}
                className="block w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body"
              />
            </label>
            <label className="space-y-2">
              <span className="font-body text-xs font-bold text-slate-600">Hoặc dán bảng từ Excel</span>
              <textarea
                ref={importTextRef}
                data-testid="dashboard-orders-import-text"
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                rows={5}
                placeholder="Dán dữ liệu ở đây..."
                className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={importOrders}
              disabled={isImporting || importPreview.length === 0}
              className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-body font-bold text-white disabled:bg-slate-300"
            >
              {isImporting ? "Đang nhập..." : `Nhập ${importPreview.length} đơn`}
            </button>
            <button
              type="button"
              onClick={() => setImportText("")}
              className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-body font-bold text-slate-600 hover:bg-slate-200"
            >
              Xoá dữ liệu dán
            </button>
          </div>
          {importFailures.length > 0 ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="font-body text-sm font-bold text-amber-800">
                {importFailures.length} dòng chưa nhập được
              </p>
              <ul className="mt-2 space-y-1">
                {importFailures.slice(0, 8).map((failure) => (
                  <li key={`${failure.rowNumber}-${failure.message}`} className="font-body text-xs text-amber-800">
                    Dòng {failure.rowNumber}: {failure.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        data-testid="dashboard-orders-filter-panel"
        className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <h3 className="font-heading text-base font-extrabold text-slate-900">Bộ lọc đơn hàng</h3>
            <span className="font-body text-xs font-bold text-slate-500">{filteredOrders.length} đơn khớp</span>
          </div>
          <button
            type="button"
            data-testid="dashboard-orders-filter-controls-toggle"
            aria-expanded={showFilterControls}
            onClick={() => setShowFilterControls((current) => !current)}
            className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-body font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <span>{showFilterControls ? "Thu gọn" : "Mở lọc"}</span>
            <span aria-hidden="true" className="text-xs">{showFilterControls ? "▲" : "▼"}</span>
          </button>
        </div>
        {showFilterControls ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
          <label className="space-y-1.5 md:col-span-2 xl:col-span-4">
            <span className="font-body text-xs font-bold text-slate-600">Tìm kiếm</span>
            <input
              data-testid="dashboard-orders-search-input"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Mã đơn, SĐT, khách hàng, sản phẩm, ghi chú"
              className="min-h-11 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-body outline-none focus:border-red-400"
            />
          </label>
          <label className="space-y-1.5 xl:col-span-2">
            <span className="font-body text-xs font-bold text-slate-600">Thời gian</span>
            <select
              value={orderTimePreset}
              onChange={(event) => setOrderTimePreset(event.target.value as AdminTimePreset)}
              title="Lọc thời gian"
              className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none focus:border-red-400"
              data-testid="dashboard-orders-time-filter"
            >
              {Object.entries(adminTimePresetLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>
          {orderTimePreset === "CUSTOM" ? (
            <div className="md:col-span-2 xl:col-span-4" data-testid="dashboard-orders-date-range">
              <AdminVietnameseDateRangeFilter
                fromDataTestId="dashboard-orders-from-date-filter"
                fromName="ordersFromDateFilter"
                fromValue={orderCustomFromDate}
                onFromChange={setOrderCustomFromDate}
                onToChange={setOrderCustomToDate}
                toDataTestId="dashboard-orders-to-date-filter"
                toName="ordersToDateFilter"
                toValue={orderCustomToDate}
                className="grid gap-3 sm:grid-cols-2"
              />
            </div>
          ) : null}
          <label className="space-y-1.5 xl:col-span-2">
            <span className="font-body text-xs font-bold text-slate-600">Trạng thái</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              title="Lọc trạng thái đơn"
              className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none focus:border-red-400"
            >
              <option value="ALL">Tất cả trạng thái</option>
              {Object.entries(statusConfig).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 xl:col-span-2">
            <span className="font-body text-xs font-bold text-slate-600">Sắp xếp</span>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              title="Sắp xếp đơn"
              className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none focus:border-red-400"
            >
              <option value="excel">Thứ tự bảng Excel</option>
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
              <option value="debt">Còn nợ nhiều</option>
              <option value="customer">Tên khách A-Z</option>
            </select>
          </label>
          <label className="hidden space-y-1.5 md:block xl:col-span-2">
            <span className="font-body text-xs font-bold text-slate-600">Dịch vụ</span>
            <select
              value={serviceFilter}
              onChange={(event) => setServiceFilter(event.target.value)}
              title="Lọc dịch vụ"
              className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none focus:border-red-400"
            >
              <option value="ALL">Tất cả dịch vụ</option>
              {Object.entries(serviceLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            data-testid="dashboard-orders-advanced-filters-toggle"
            aria-expanded={showAdvancedFilters}
            onClick={() => setShowAdvancedFilters((current) => !current)}
            className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-left text-sm font-body font-bold text-slate-700 transition-colors hover:bg-slate-50 xl:col-span-2 xl:self-end"
          >
            <span>{showAdvancedFilters ? "Thu gọn lọc" : "Lọc nâng cao"}</span>
            <span aria-hidden="true" className="text-lg leading-none">{showAdvancedFilters ? "−" : "+"}</span>
          </button>
          {showAdvancedFilters ? (
            <div
              data-testid="dashboard-orders-advanced-filters-panel"
              className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 md:col-span-2 md:grid-cols-2 xl:col-span-12 xl:grid-cols-7"
            >
              <label className="space-y-1.5 md:hidden">
                <span className="font-body text-xs font-bold text-slate-600">Dịch vụ</span>
                <select
                  value={serviceFilter}
                  onChange={(event) => setServiceFilter(event.target.value)}
                  title="Lọc dịch vụ"
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-body outline-none focus:border-red-400"
                >
                  <option value="ALL">Tất cả dịch vụ</option>
                  {Object.entries(serviceLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="font-body text-xs font-bold text-slate-600">Nguồn đơn</span>
                <select
                  data-testid="dashboard-orders-source-filter"
                  value={sourceFilter}
                  onChange={(event) => setSourceFilter(event.target.value)}
                  title="Lọc nguồn đơn"
                  className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none focus:border-red-400"
                >
                  <option value="ALL">Tất cả nguồn</option>
                  {Object.entries(sourceLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="font-body text-xs font-bold text-slate-600">Tài khoản khách</span>
                <select
                  data-testid="dashboard-orders-account-filter"
                  value={accountFilter}
                  onChange={(event) => setAccountFilter(event.target.value as AccountFilter)}
                  title="Lọc tài khoản khách"
                  className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none focus:border-red-400"
                >
                  <option value="ALL">Tất cả tài khoản</option>
                  <option value="REGISTERED">Có tài khoản</option>
                  <option value="NO_ACCOUNT">Chưa có tài khoản</option>
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="font-body text-xs font-bold text-slate-600">Thanh toán</span>
                <select
                  data-testid="dashboard-orders-payment-filter"
                  value={paymentFilter}
                  onChange={(event) => setPaymentFilter(event.target.value as PaymentFilter)}
                  title="Lọc thanh toán"
                  className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none focus:border-red-400"
                >
                  <option value="ALL">Tất cả công nợ</option>
                  <option value="DEBT">Còn nợ</option>
                  <option value="PAID">Đã thu đủ</option>
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="font-body text-xs font-bold text-slate-600">Tình trạng giá</span>
                <select
                  data-testid="dashboard-orders-price-filter"
                  value={priceFilter}
                  onChange={(event) => setPriceFilter(event.target.value as PriceFilter)}
                  title="Lọc tình trạng giá"
                  className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none focus:border-red-400"
                >
                  <option value="ALL">Tất cả giá</option>
                  {Object.entries(priceStatusConfig).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="font-body text-xs font-bold text-slate-600">Bảo hành</span>
                <select
                  data-testid="dashboard-orders-warranty-filter"
                  value={warrantyFilter}
                  onChange={(event) => setWarrantyFilter(event.target.value as WarrantyFilter)}
                  title="Lọc bảo hành"
                  className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none focus:border-red-400"
                >
                  <option value="ALL">Tất cả bảo hành</option>
                  <option value="WITH_WARRANTY">Có bảo hành</option>
                  <option value="WITHOUT_WARRANTY">Chưa có bảo hành</option>
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="font-body text-xs font-bold text-slate-600">Mã giảm giá</span>
                <select
                  data-testid="dashboard-orders-coupon-filter"
                  value={couponFilter}
                  onChange={(event) => setCouponFilter(event.target.value as CouponFilter)}
                  title="Lọc mã giảm giá"
                  className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none focus:border-red-400"
                >
                  <option value="ALL">Tất cả mã giảm giá</option>
                  <option value="WITH_COUPON">Có mã giảm giá</option>
                  <option value="WITHOUT_COUPON">Không có mã</option>
                </select>
              </label>
            </div>
          ) : null}
          </div>
        ) : null}
        {activeFilterChips.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2" data-testid="dashboard-orders-active-filter-chips">
            {activeFilterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.onClear}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-body text-xs font-bold text-slate-700 hover:bg-white"
              >
                {chip.label} ×
              </button>
            ))}
          </div>
        ) : null}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="min-w-0 rounded-xl bg-slate-50 px-2.5 py-2 sm:px-3">
            <p className="font-body text-xs font-bold text-slate-600">Tổng tiền lọc</p>
            <p className="break-words font-heading text-sm font-extrabold leading-tight text-slate-900 sm:text-base">{formatMoney(filteredOrderStats.quoted)}</p>
          </div>
          <div className="min-w-0 rounded-xl bg-green-50 px-2.5 py-2 sm:px-3">
            <p className="font-body text-xs font-bold text-green-700">Đã thu lọc</p>
            <p className="break-words font-heading text-sm font-extrabold leading-tight text-green-700 sm:text-base">{formatMoney(filteredOrderStats.paid)}</p>
          </div>
          <div className="min-w-0 rounded-xl bg-red-50 px-2.5 py-2 sm:px-3">
            <p className="font-body text-xs font-bold text-red-700">Còn nợ lọc</p>
            <p className="break-words font-heading text-sm font-extrabold leading-tight text-red-700 sm:text-base">{formatMoney(filteredOrderStats.debt)}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-body text-xs text-slate-400">
            Hiển thị {visibleOrders.length} / {filteredOrders.length} đơn khớp lọc, tổng {orders.length} đơn
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="self-start rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-body font-bold text-slate-700 transition-colors hover:bg-slate-50 sm:self-auto"
            >
              Xóa lọc
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-5 md:space-y-2.5">
        {filteredOrders.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-sm">
            <p className="font-body text-sm text-slate-400">Chưa có đơn nào khớp bộ lọc.</p>
          </div>
        ) : (
          visibleOrders.map((order, index) => {
            const status = statusConfig[order.status] || statusConfig.PENDING;
            const priceStatus = priceStatusConfig[order.priceStatus] || priceStatusConfig.PENDING_QUOTE;
            const debt = getDebt(order);
            const payable = order.priceStatus === "CONFIRMED"
              ? getPayableAmount(order.quotedPrice, order.discountAmount)
              : 0;
            const paymentTag = debt > 0
              ? { label: "Còn nợ", color: "bg-red-50 text-red-700 border-red-200" }
              : order.priceStatus === "CONFIRMED" || order.priceStatus === "FREE"
                ? { label: "Đã thu đủ", color: "bg-green-50 text-green-700 border-green-200" }
                : { label: "Chưa xác nhận", color: "bg-slate-50 text-slate-600 border-slate-200" };
            const sourceContext = [order.sourceName, order.sourceRow ? `dòng ${order.sourceRow}` : ""].filter(Boolean).join(" · ");
            const boundaryClass = debt > 0
              ? "border-l-red-500"
              : order.status === "COMPLETED"
                ? "border-l-green-500"
                : "border-l-amber-400";
            const toplineClass = debt > 0
              ? "border-red-100 bg-red-50/95"
              : order.status === "COMPLETED"
                ? "border-green-100 bg-green-50/95"
                : "border-amber-100 bg-amber-50/95";
            return (
              <div
                key={order.id}
                data-testid="dashboard-order-card"
                className={`overflow-visible rounded-2xl border border-l-4 border-slate-100 bg-white shadow-sm md:grid md:grid-cols-[minmax(0,1fr)_360px] md:gap-x-4 md:rounded-xl md:border-l-[3px] md:px-4 md:py-3 ${boundaryClass} ${deletingId === order.id ? "opacity-60" : ""}`}
              >
                <div
                  data-testid="dashboard-order-card-topline"
                  className={`sticky top-2 z-20 rounded-t-2xl border-b px-4 py-3 backdrop-blur md:static md:col-start-1 md:row-start-1 md:rounded-none md:border-b-0 md:bg-white md:p-0 md:backdrop-blur-0 ${toplineClass}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 md:gap-1.5">
                        <code className="rounded bg-white/80 px-2 py-0.5 text-xs font-bold text-slate-700">{order.orderCode}</code>
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${status.color}`}>
                          {status.label}
                        </span>
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${paymentTag.color}`}>
                          {paymentTag.label}
                        </span>
                        <span className="hidden rounded-full bg-white/70 px-2.5 py-1 text-xs font-bold text-slate-500 sm:inline-flex">
                          {serviceLabels[order.service] || order.service}
                        </span>
                        <span className="hidden rounded-full bg-white/70 px-2.5 py-1 text-xs font-bold text-slate-500 sm:inline-flex">
                          {sourceLabels[order.source] || order.source}
                        </span>
                        <span className={`hidden rounded-full border px-2.5 py-1 text-xs font-bold sm:inline-flex ${priceStatus.color}`}>
                          {priceStatus.label}
                        </span>
                        {order.user ? (
                          <span className="hidden rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700 sm:inline-flex">
                            Có tài khoản
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-2 font-heading text-lg font-extrabold leading-snug text-slate-950 md:text-base">{order.productName}</h3>
                      <p className="mt-1 font-body text-sm font-semibold text-slate-600 md:text-xs">
                        {order.customerName} · {order.customerPhone}
                        {order.customerAddress ? ` · ${order.customerAddress}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 rounded-xl bg-white/80 px-3 py-2 text-right shadow-sm md:hidden">
                      <p className="font-body text-[10px] font-bold uppercase text-slate-500">Còn lại</p>
                      <p className={`font-heading text-sm font-extrabold ${debt > 0 ? "text-red-700" : "text-green-700"}`}>
                        {formatMoney(debt)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-4 px-4 pb-4 pt-3 sm:px-5 sm:pb-5 md:contents">
                  <div className="min-w-0 flex-1 md:col-start-1 md:row-start-2 md:mt-2">
                    <div className="mt-3 grid grid-cols-2 gap-2 font-body text-sm md:hidden">
                      <span className="rounded-xl bg-slate-50 px-3 py-2 text-slate-600">Ngày: <strong>{formatOrderDate(order)}</strong></span>
                      <span className="rounded-xl bg-slate-50 px-3 py-2 text-slate-600">Phải thu: <strong>{order.priceStatus === "CONFIRMED" ? formatMoney(payable) : priceStatus.label}</strong></span>
                      <span className="rounded-xl bg-green-50 px-3 py-2 text-green-700">
                        Đã thu: <strong>{formatMoney(order.paidAmount)}</strong>
                        {order.paidAt ? <small className="mt-0.5 block font-semibold text-green-600">Ngày thu {formatDate(order.paidAt)}</small> : null}
                      </span>
                      <span className="rounded-xl bg-red-50 px-3 py-2 text-red-700">Còn lại: <strong>{formatMoney(debt)}</strong></span>
                    </div>
                    <div className="mt-2 hidden gap-x-4 gap-y-1 font-body text-[12px] leading-5 text-slate-500 md:grid md:grid-cols-3 xl:grid-cols-4">
                      <span>Ngày đơn: <strong>{formatOrderDate(order)}</strong></span>
                      {sourceContext ? <span>Dòng gốc: <strong>{sourceContext}</strong></span> : null}
                      <span>Giá gốc: <strong>{order.priceStatus === "CONFIRMED" ? formatMoney(order.quotedPrice) : priceStatus.label}</strong></span>
                      <span>Giảm giá: <strong className="text-emerald-700">{formatMoney(order.discountAmount)}</strong></span>
                      <span>Phải thu: <strong>{order.priceStatus === "CONFIRMED" ? formatMoney(payable) : priceStatus.label}</strong></span>
                      <span>
                        Đã thu: <strong>{formatMoney(order.paidAmount)}</strong>
                        {order.paidAt ? ` · ${formatDate(order.paidAt)}` : ""}
                      </span>
                      <span>Còn lại: <strong className={debt > 0 ? "text-red-600" : "text-green-700"}>{formatMoney(debt)}</strong></span>
                    </div>
                    {order.couponCode ? (
                      <p className="mt-2 font-body text-xs font-semibold text-emerald-700">
                        Mã ưu đãi: {order.couponCode} ({order.couponDiscount || "đã áp dụng"})
                      </p>
                    ) : null}
                    <details className="mt-3 rounded-xl border border-slate-100 bg-slate-50 md:hidden">
                      <summary className="flex min-h-11 cursor-pointer items-center px-3 py-2 font-body text-sm font-bold text-slate-700">
                        Chi tiết đơn
                      </summary>
                      <div className="space-y-2 border-t border-slate-100 px-3 py-3 font-body text-sm text-slate-600">
                        {sourceContext ? <p>Dòng gốc: <strong>{sourceContext}</strong></p> : null}
                        <p>Giá gốc: <strong>{order.priceStatus === "CONFIRMED" ? formatMoney(order.quotedPrice) : priceStatus.label}</strong></p>
                        <p>Giảm giá: <strong className="text-emerald-700">{formatMoney(order.discountAmount)}</strong></p>
                        {order.issueDescription ? <p><strong>Tình trạng:</strong> {order.issueDescription}</p> : null}
                        {order.solution ? <p><strong>Phương án:</strong> {order.solution}</p> : null}
                        {order.notes ? <p><strong>Ghi chú:</strong> {order.notes}</p> : null}
                        <p className="font-semibold text-slate-500">{status.hint}</p>
                      </div>
                    </details>
                    {order.issueDescription || order.solution || order.notes ? (
                      <div className="mt-2 hidden gap-2 md:grid lg:grid-cols-3">
                        {order.issueDescription ? (
                          <p className="rounded-lg bg-slate-50 px-2.5 py-1.5 font-body text-xs text-slate-500">
                            <strong>Tình trạng:</strong> {order.issueDescription}
                          </p>
                        ) : null}
                        {order.solution ? (
                          <p className="rounded-lg bg-slate-50 px-2.5 py-1.5 font-body text-xs text-slate-500">
                            <strong>Phương án:</strong> {order.solution}
                          </p>
                        ) : null}
                        {order.notes ? (
                          <p className="rounded-lg bg-slate-50 px-2.5 py-1.5 font-body text-xs text-slate-500">
                            <strong>Ghi chú:</strong> {order.notes}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    <p className="mt-2 hidden font-body text-xs font-semibold text-slate-400 md:block">{status.hint}</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3 md:col-start-2 md:row-span-2 md:row-start-1 md:grid-cols-2 md:self-start">
                    <button
                      type="button"
                      data-testid="dashboard-order-edit-button"
                      onClick={() => editOrder(order)}
                      disabled={savingId === order.id}
                      className="min-h-11 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-body font-bold text-white disabled:bg-slate-300 sm:col-span-3 md:col-span-2 md:min-h-9 md:rounded-lg md:py-2 md:text-xs"
                    >
                      Sửa đầy đủ
                    </button>
                    <select
                      value={order.status}
                      onChange={(event) => updateOrder(order.id, { status: event.target.value })}
                      disabled={savingId === order.id}
                      title="Cập nhật trạng thái"
                      className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none md:min-h-9 md:rounded-lg md:py-1.5 md:text-xs"
                    >
                      {Object.entries(statusConfig).map(([key, config]) => (
                        <option key={key} value={key}>{config.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => updateOrder(order.id, { customerVisible: !order.customerVisible })}
                      disabled={savingId === order.id}
                      className={`min-h-11 rounded-xl px-3 py-2 text-sm font-body font-bold md:min-h-9 md:rounded-lg md:py-1.5 md:text-xs ${
                        order.customerVisible
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {order.customerVisible ? "Đang hiện cho khách" : "Ẩn với khách"}
                    </button>
                    <div className="grid grid-cols-2 gap-2 sm:col-span-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] md:col-span-2 md:grid-cols-[minmax(0,1fr)_72px_72px]">
                      <input
                        inputMode="numeric"
                        value={paymentInputs[order.id] ?? ""}
                        onChange={(event) => setPaymentInputs((prev) => ({ ...prev, [order.id]: event.target.value }))}
                        onBlur={() => setPaymentInputs((prev) => ({ ...prev, [order.id]: formatMoneyInputValue(prev[order.id] || "") }))}
                        placeholder={`Đã thu: ${formatMoney(order.paidAmount)}`}
                        className="col-span-2 min-h-11 min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none focus:border-red-400 sm:col-span-1 md:min-h-9 md:rounded-lg md:py-1.5 md:text-xs"
                        title="Cập nhật số tiền đã thu"
                      />
                      <button
                        type="button"
                        onClick={() => savePayment(order)}
                        disabled={savingId === order.id}
                        className="min-h-11 rounded-xl bg-green-50 px-3 py-2 text-sm font-body font-bold text-green-700 disabled:bg-slate-100 disabled:text-slate-300 md:min-h-9 md:rounded-lg md:px-2 md:py-1.5 md:text-xs"
                      >
                        Ghi thu
                      </button>
                      <button
                        type="button"
                        onClick={() => markPaidInFull(order)}
                        disabled={savingId === order.id || payable === 0}
                        className="min-h-11 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-body font-bold text-white disabled:bg-slate-300 md:min-h-9 md:rounded-lg md:px-2 md:py-1.5 md:text-xs"
                      >
                        Thu đủ
                      </button>
                    </div>
                    {order.warranty ? (
                      <p className="min-h-11 rounded-xl bg-green-50 px-3 py-2 text-sm font-body font-bold text-green-700 md:min-h-9 md:rounded-lg md:py-1.5 md:text-xs">
                        BH: {order.warranty.serialNo}
                        <span className="hidden md:inline">
                          {order.warrantyEndDate ? ` - ${formatDate(order.warrantyEndDate)}` : ""}
                        </span>
                      </p>
                    ) : order.status === "COMPLETED" ? (
                      <button
                        type="button"
                        onClick={() => createWarrantyFromOrder(order)}
                        disabled={warrantyCreatingId === order.id || order.warrantyMonths === 0}
                        className="min-h-11 rounded-xl bg-blue-50 px-3 py-2 text-sm font-body font-bold text-blue-700 disabled:bg-slate-100 disabled:text-slate-300 md:min-h-9 md:rounded-lg md:py-1.5 md:text-xs"
                      >
                        {warrantyCreatingId === order.id ? "Đang tạo BH..." : "Tạo BH 6 tháng"}
                      </button>
                    ) : (
                      <p className="min-h-11 rounded-xl bg-slate-50 px-3 py-2 text-sm font-body text-slate-500 md:min-h-9 md:rounded-lg md:py-1.5 md:text-xs">
                        BH tự tạo khi hoàn thành
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteOrder(order.id)}
                      disabled={deletingId === order.id}
                      className="min-h-11 rounded-xl bg-red-50 px-3 py-2 text-sm font-body font-bold text-red-600 disabled:bg-slate-100 disabled:text-slate-300 md:min-h-9 md:rounded-lg md:py-1.5 md:text-xs"
                    >
                      {deletingId === order.id ? "Đang xoá..." : "Xoá"}
                    </button>
                    {order.status === "COMPLETED" && order.warrantyEndDate ? (
                      <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-body text-slate-500 sm:col-span-3 md:hidden">
                        Bảo hành đến: <strong>{formatDate(order.warrantyEndDate)}</strong>
                      </p>
                    ) : null}
                  </div>
                </div>
                <div
                  data-testid="dashboard-order-card-end"
                  className="mx-4 mb-4 flex min-h-9 items-center justify-between rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 font-body text-[11px] font-bold text-slate-400 sm:mx-5 sm:mb-5 md:hidden"
                >
                  <span>Hết đơn {order.orderCode}</span>
                  <span>{index + 1}/{visibleOrders.length} trang này</span>
                </div>
              </div>
            );
          })
        )}
      </div>
      <PaginationControls
        itemLabel="đơn"
        onPageChange={setPage}
        page={currentPage}
        pageCount={pageCount}
        pageSize={ORDER_PAGE_SIZE}
        totalItems={filteredOrders.length}
      />
    </div>
  );
}
