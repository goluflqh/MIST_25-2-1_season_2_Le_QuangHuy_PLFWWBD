"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import VietnameseDateInput from "@/components/admin/VietnameseDateInput";
import { useNotify } from "@/components/NotifyProvider";
import { calculateCouponDiscount, getPayableAmount, getRemainingAmount } from "@/lib/coupon-discounts";
import { formatVietnamDate, todayVietnamText } from "@/lib/vietnam-time";

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
  orderDate: string;
  quotedPrice: number | null;
  paidAmount: number;
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

type SortMode = "newest" | "oldest" | "debt" | "customer";
type AccountFilter = "ALL" | "REGISTERED" | "NO_ACCOUNT";
type CouponFilter = "ALL" | "WITH_COUPON" | "WITHOUT_COUPON";
type PaymentFilter = "ALL" | "DEBT" | "PAID";
type WarrantyFilter = "ALL" | "WITH_WARRANTY" | "WITHOUT_WARRANTY";
const ORDER_PAGE_SIZE = 8;

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
  "da_thu",
  "trang_thai",
  "bao_hanh_thang",
  "ghi_chu",
  "cho_khach_xem",
] as const;

function formatDate(value: string | null) {
  return formatVietnamDate(value) || "Chưa có";
}

function todayText() {
  return todayVietnamText();
}

function formatMoney(value: number | null | undefined) {
  if (!value) return "0đ";
  return `${value.toLocaleString("vi-VN")}đ`;
}

function parseMoneyText(value: string) {
  const parsed = Number.parseInt(value.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getDebt(order: ServiceOrderData) {
  return getRemainingAmount(order.quotedPrice, order.discountAmount, order.paidAmount);
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

  const dataRows = rows[0] && looksLikeHeader(rows[0]) ? rows.slice(1) : rows;

  return dataRows
    .filter((cells) => cells.some((cell) => cell.trim()))
    .map((cells) => ({
      orderDate: cells[0] || "",
      customerName: cells[1] || "",
      customerPhone: cells[2] || "",
      customerAddress: cells[3] || "",
      service: cells[4] || "",
      productName: cells[5] || "",
      issueDescription: cells[6] || "",
      solution: cells[7] || "",
      quotedPrice: cells[8] || "",
      paidAmount: cells[9] || "",
      status: cells[10] || "",
      warrantyMonths: cells[11] || "",
      notes: cells[12] || "",
      customerVisible: cells[13] || "",
    }));
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
  const [orders, setOrders] = useState(initialOrders);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importFailures, setImportFailures] = useState<Array<{ rowNumber: number; message: string }>>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [serviceFilter, setServiceFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [accountFilter, setAccountFilter] = useState<AccountFilter>("ALL");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("ALL");
  const [warrantyFilter, setWarrantyFilter] = useState<WarrantyFilter>("ALL");
  const [couponFilter, setCouponFilter] = useState<CouponFilter>("ALL");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [page, setPage] = useState(1);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [warrantyCreatingId, setWarrantyCreatingId] = useState<string | null>(null);
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
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
    productName: "",
    quotedPrice: "",
    service: "DONG_PIN",
    solution: "",
    source: "MANUAL",
    status: "PENDING",
    warrantyMonths: "6",
  });

  const importPreview = useMemo(() => {
    if (!importText.trim()) return [];
    return parseImportText(importText);
  }, [importText]);

  const metrics = useMemo(() => {
    return orders.reduce(
      (summary, order) => {
        summary.total += 1;
        summary.debt += getDebt(order);
        summary.discount += order.discountAmount || 0;
        summary.paid += order.paidAmount;
        summary.quoted += order.quotedPrice || 0;
        return summary;
      },
      { debt: 0, discount: 0, paid: 0, quoted: 0, total: 0 }
    );
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return orders
      .filter((order) => {
        const matchesStatus = statusFilter === "ALL" || order.status === statusFilter;
        const matchesService = serviceFilter === "ALL" || order.service === serviceFilter;
        const matchesSource = sourceFilter === "ALL" || order.source === sourceFilter;
        const hasAccount = Boolean(order.user || order.customer.userId);
        const matchesAccount =
          accountFilter === "ALL"
          || (accountFilter === "REGISTERED" && hasAccount)
          || (accountFilter === "NO_ACCOUNT" && !hasAccount);
        const debt = getDebt(order);
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
        const matchesSearch =
          !query ||
          order.orderCode.toLowerCase().includes(query) ||
          order.customerName.toLowerCase().includes(query) ||
          order.customerPhone.toLowerCase().includes(query) ||
          order.productName.toLowerCase().includes(query) ||
          (order.issueDescription || "").toLowerCase().includes(query) ||
          (order.solution || "").toLowerCase().includes(query) ||
          (order.notes || "").toLowerCase().includes(query);

        return matchesStatus
          && matchesService
          && matchesSource
          && matchesAccount
          && matchesPayment
          && matchesWarranty
          && matchesCoupon
          && matchesSearch;
      })
      .sort((first, second) => {
        if (sortMode === "oldest") {
          return new Date(first.orderDate).getTime() - new Date(second.orderDate).getTime();
        }
        if (sortMode === "debt") {
          return getDebt(second) - getDebt(first);
        }
        if (sortMode === "customer") {
          return first.customerName.localeCompare(second.customerName, "vi");
        }
        return new Date(second.orderDate).getTime() - new Date(first.orderDate).getTime();
      });
  }, [accountFilter, couponFilter, orders, paymentFilter, searchQuery, serviceFilter, sortMode, sourceFilter, statusFilter, warrantyFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / ORDER_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleOrders = filteredOrders.slice((currentPage - 1) * ORDER_PAGE_SIZE, currentPage * ORDER_PAGE_SIZE);
  const hasActiveFilters = searchQuery.trim().length > 0
    || statusFilter !== "ALL"
    || serviceFilter !== "ALL"
    || sourceFilter !== "ALL"
    || accountFilter !== "ALL"
    || paymentFilter !== "ALL"
    || warrantyFilter !== "ALL"
    || couponFilter !== "ALL"
    || sortMode !== "newest";

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setServiceFilter("ALL");
    setSourceFilter("ALL");
    setAccountFilter("ALL");
    setPaymentFilter("ALL");
    setWarrantyFilter("ALL");
    setCouponFilter("ALL");
    setSortMode("newest");
    setPage(1);
  };

  useEffect(() => {
    setImportFailures([]);
  }, [importText]);

  useEffect(() => {
    setPage(1);
  }, [accountFilter, couponFilter, paymentFilter, searchQuery, serviceFilter, sortMode, sourceFilter, statusFilter, warrantyFilter]);

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
      productName: params.get("productName") || "",
      service: normalizeFormService(params.get("service")),
      source: "CONTACT",
      status: params.get("status") || "PENDING",
      warrantyMonths: "6",
    }));
    openCreateForm();
  }, [openCreateForm]);

  const resetForm = () => {
    setFormData({
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
      productName: "",
      quotedPrice: "",
      service: "DONG_PIN",
      solution: "",
      source: "MANUAL",
      status: "PENDING",
      warrantyMonths: "6",
    });
  };

  const createOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    const payload = {
      ...formData,
      customerAddress: formData.customerAddress.trim(),
      customerName: formData.customerName.trim(),
      customerPhone: formData.customerPhone.trim(),
      issueDescription: formData.issueDescription.trim(),
      notes: formData.notes.trim(),
      productName: formData.productName.trim(),
      solution: formData.solution.trim(),
    };

    if (!payload.customerName || !payload.customerPhone || !payload.productName) {
      const message = "Nhập tối thiểu tên khách, số điện thoại và sản phẩm/thiết bị.";
      setError(message);
      showToast(message, "error");
      return;
    }

    try {
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

  const updateOrder = async (id: string, patch: Partial<ServiceOrderData>) => {
    const previousOrder = orders.find((order) => order.id === id);
    if (!previousOrder) return;

    setSavingId(id);
    setOrders((prev) => prev.map((order) => (order.id === id ? { ...order, ...patch } : order)));

    try {
      const response = await fetch("/api/admin/service-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setOrders((prev) => prev.map((order) => (order.id === id ? previousOrder : order)));
        showToast(data.message || "Chưa cập nhật được đơn.", "error");
        return;
      }

      setOrders((prev) => prev.map((order) => (order.id === id ? data.order : order)));
      showToast(
        !previousOrder.warranty && data.order?.warranty
          ? "Đã cập nhật đơn và tự tạo phiếu bảo hành 6 tháng."
          : "Đã cập nhật đơn.",
        "success"
      );
    } catch {
      setOrders((prev) => prev.map((order) => (order.id === id ? previousOrder : order)));
      showToast("Kết nối bị gián đoạn khi cập nhật đơn.", "error");
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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="dashboard-orders-open-import"
            onClick={openImportPanel}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-body font-bold text-white transition-colors hover:bg-slate-800"
          >
            Nhập từ Excel/CSV
          </button>
          <button
            type="button"
            data-testid="dashboard-orders-open-create"
            onClick={openCreateForm}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-body font-bold text-white transition-colors hover:bg-red-700"
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

      {showForm ? (
        <form
          ref={orderFormRef}
          onSubmit={createOrder}
          className="scroll-mt-28 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="mb-4">
            <h3 className="font-heading text-lg font-bold text-slate-900">Thêm đơn nhanh</h3>
            <p className="font-body text-sm text-slate-500">
              Chỉ cần nhập tên, SĐT và sản phẩm. Các phần còn lại có thể bổ sung sau.
            </p>
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
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-body font-bold text-slate-600 hover:bg-slate-200"
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
                value={formData.quotedPrice}
                onChange={(event) => setFormData({ ...formData, quotedPrice: event.target.value })}
                placeholder="Ví dụ: 1500000"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              />
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
                value={formData.paidAmount}
                onChange={(event) => setFormData({ ...formData, paidAmount: event.target.value })}
                placeholder="Ví dụ: 500000"
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
            <button type="submit" className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-body font-bold text-white hover:bg-red-700">
              Lưu đơn
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-body font-bold text-slate-600 hover:bg-slate-200">
              Huỷ
            </button>
          </div>
        </form>
      ) : null}

      {showImport ? (
        <div
          ref={importPanelRef}
          className="scroll-mt-28 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-heading text-lg font-bold text-slate-900">Nhập từ Excel/CSV</h3>
              <p className="font-body text-sm text-slate-500">
                Lập file theo đúng thứ tự cột, rồi lưu dạng CSV UTF-8 hoặc sao chép bảng từ Excel dán vào đây.
              </p>
            </div>
            <button
              type="button"
              onClick={downloadImportTemplate}
              className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-body font-bold text-slate-700 hover:bg-slate-200"
            >
              Tải mẫu CSV
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

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Tìm mã đơn, SĐT, khách hàng, sản phẩm, ghi chú"
            className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-sm font-body outline-none focus:border-red-400 md:col-span-2 xl:col-span-2"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            title="Lọc trạng thái đơn"
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none focus:border-red-400"
          >
            <option value="ALL">Tất cả trạng thái</option>
            {Object.entries(statusConfig).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
          <select
            value={serviceFilter}
            onChange={(event) => setServiceFilter(event.target.value)}
            title="Lọc dịch vụ"
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none focus:border-red-400"
          >
            <option value="ALL">Tất cả dịch vụ</option>
            {Object.entries(serviceLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select
            data-testid="dashboard-orders-source-filter"
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
            title="Lọc nguồn đơn"
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none focus:border-red-400"
          >
            <option value="ALL">Tất cả nguồn</option>
            {Object.entries(sourceLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select
            data-testid="dashboard-orders-account-filter"
            value={accountFilter}
            onChange={(event) => setAccountFilter(event.target.value as AccountFilter)}
            title="Lọc tài khoản khách"
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none focus:border-red-400"
          >
            <option value="ALL">Tất cả tài khoản</option>
            <option value="REGISTERED">Có tài khoản</option>
            <option value="NO_ACCOUNT">Chưa có tài khoản</option>
          </select>
          <select
            data-testid="dashboard-orders-payment-filter"
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value as PaymentFilter)}
            title="Lọc thanh toán"
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none focus:border-red-400"
          >
            <option value="ALL">Tất cả công nợ</option>
            <option value="DEBT">Còn nợ</option>
            <option value="PAID">Đã thu đủ</option>
          </select>
          <select
            data-testid="dashboard-orders-warranty-filter"
            value={warrantyFilter}
            onChange={(event) => setWarrantyFilter(event.target.value as WarrantyFilter)}
            title="Lọc bảo hành"
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none focus:border-red-400"
          >
            <option value="ALL">Tất cả bảo hành</option>
            <option value="WITH_WARRANTY">Có bảo hành</option>
            <option value="WITHOUT_WARRANTY">Chưa có bảo hành</option>
          </select>
          <select
            data-testid="dashboard-orders-coupon-filter"
            value={couponFilter}
            onChange={(event) => setCouponFilter(event.target.value as CouponFilter)}
            title="Lọc mã giảm giá"
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none focus:border-red-400"
          >
            <option value="ALL">Tất cả mã giảm giá</option>
            <option value="WITH_COUPON">Có mã giảm giá</option>
            <option value="WITHOUT_COUPON">Không có mã</option>
          </select>
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            title="Sắp xếp đơn"
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none focus:border-red-400"
          >
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="debt">Còn nợ nhiều</option>
            <option value="customer">Tên khách A-Z</option>
          </select>
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

      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-sm">
            <p className="font-body text-sm text-slate-400">Chưa có đơn nào khớp bộ lọc.</p>
          </div>
        ) : (
          visibleOrders.map((order) => {
            const status = statusConfig[order.status] || statusConfig.PENDING;
            const debt = getDebt(order);
            const payable = getPayableAmount(order.quotedPrice, order.discountAmount);
            return (
              <div
                key={order.id}
                className={`rounded-2xl border bg-white p-5 shadow-sm ${deletingId === order.id ? "opacity-60" : "border-slate-100"}`}
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">{order.orderCode}</code>
                      <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${status.color}`}>
                        {status.label}
                      </span>
                      <span className="rounded-full bg-slate-50 px-2.5 py-0.5 text-[10px] font-bold text-slate-500">
                        {serviceLabels[order.service] || order.service}
                      </span>
                      <span className="rounded-full bg-slate-50 px-2.5 py-0.5 text-[10px] font-bold text-slate-500">
                        {sourceLabels[order.source] || order.source}
                      </span>
                      {order.user ? (
                        <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-[10px] font-bold text-green-700">
                          Có tài khoản
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-2 font-heading text-base font-extrabold text-slate-900">{order.productName}</h3>
                    <p className="mt-1 font-body text-sm text-slate-600">
                      {order.customerName} · {order.customerPhone}
                      {order.customerAddress ? ` · ${order.customerAddress}` : ""}
                    </p>
                    <div className="mt-3 grid gap-2 font-body text-xs text-slate-500 md:grid-cols-2 xl:grid-cols-4">
                      <span>Ngày đơn: <strong>{formatDate(order.orderDate)}</strong></span>
                      <span>Giá gốc: <strong>{formatMoney(order.quotedPrice)}</strong></span>
                      <span>Giảm giá: <strong className="text-emerald-700">{formatMoney(order.discountAmount)}</strong></span>
                      <span>Phải thu: <strong>{formatMoney(payable)}</strong></span>
                      <span>Đã thu: <strong>{formatMoney(order.paidAmount)}</strong></span>
                      <span>Còn lại: <strong className={debt > 0 ? "text-red-600" : "text-green-700"}>{formatMoney(debt)}</strong></span>
                    </div>
                    {order.couponCode ? (
                      <p className="mt-2 font-body text-xs font-semibold text-emerald-700">
                        Mã ưu đãi: {order.couponCode} ({order.couponDiscount || "đã áp dụng"})
                      </p>
                    ) : null}
                    {order.issueDescription || order.solution || order.notes ? (
                      <div className="mt-3 grid gap-2 lg:grid-cols-3">
                        {order.issueDescription ? (
                          <p className="rounded-xl bg-slate-50 px-3 py-2 font-body text-xs text-slate-500">
                            <strong>Tình trạng:</strong> {order.issueDescription}
                          </p>
                        ) : null}
                        {order.solution ? (
                          <p className="rounded-xl bg-slate-50 px-3 py-2 font-body text-xs text-slate-500">
                            <strong>Phương án:</strong> {order.solution}
                          </p>
                        ) : null}
                        {order.notes ? (
                          <p className="rounded-xl bg-slate-50 px-3 py-2 font-body text-xs text-slate-500">
                            <strong>Ghi chú:</strong> {order.notes}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    <p className="mt-3 font-body text-xs font-semibold text-slate-400">{status.hint}</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3 xl:w-[430px]">
                    <select
                      value={order.status}
                      onChange={(event) => updateOrder(order.id, { status: event.target.value })}
                      disabled={savingId === order.id}
                      title="Cập nhật trạng thái"
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-body outline-none"
                    >
                      {Object.entries(statusConfig).map(([key, config]) => (
                        <option key={key} value={key}>{config.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => updateOrder(order.id, { customerVisible: !order.customerVisible })}
                      disabled={savingId === order.id}
                      className={`rounded-xl px-3 py-2 text-xs font-body font-bold ${
                        order.customerVisible
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {order.customerVisible ? "Đang hiện cho khách" : "Ẩn với khách"}
                    </button>
                    <div className="flex gap-2 sm:col-span-3">
                      <input
                        inputMode="numeric"
                        value={paymentInputs[order.id] ?? ""}
                        onChange={(event) => setPaymentInputs((prev) => ({ ...prev, [order.id]: event.target.value }))}
                        placeholder={`Đã thu: ${formatMoney(order.paidAmount)}`}
                        className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-body outline-none focus:border-red-400"
                        title="Cập nhật số tiền đã thu"
                      />
                      <button
                        type="button"
                        onClick={() => savePayment(order)}
                        disabled={savingId === order.id}
                        className="rounded-xl bg-green-50 px-3 py-2 text-xs font-body font-bold text-green-700 disabled:bg-slate-100 disabled:text-slate-300"
                      >
                        Ghi thu
                      </button>
                      <button
                        type="button"
                        onClick={() => markPaidInFull(order)}
                        disabled={savingId === order.id || payable === 0}
                        className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-body font-bold text-white disabled:bg-slate-300"
                      >
                        Thu đủ
                      </button>
                    </div>
                    {order.warranty ? (
                      <p className="rounded-xl bg-green-50 px-3 py-2 text-xs font-body font-bold text-green-700">
                        BH: {order.warranty.serialNo}
                      </p>
                    ) : order.status === "COMPLETED" ? (
                      <button
                        type="button"
                        onClick={() => createWarrantyFromOrder(order)}
                        disabled={warrantyCreatingId === order.id || order.warrantyMonths === 0}
                        className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-body font-bold text-blue-700 disabled:bg-slate-100 disabled:text-slate-300"
                      >
                        {warrantyCreatingId === order.id ? "Đang tạo BH..." : "Tạo BH 6 tháng"}
                      </button>
                    ) : (
                      <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-body text-slate-500">
                        BH tự tạo khi hoàn thành
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteOrder(order.id)}
                      disabled={deletingId === order.id}
                      className="rounded-xl bg-red-50 px-3 py-2 text-xs font-body font-bold text-red-600 disabled:bg-slate-100 disabled:text-slate-300"
                    >
                      {deletingId === order.id ? "Đang xoá..." : "Xoá"}
                    </button>
                    {order.status === "COMPLETED" && order.warrantyEndDate ? (
                      <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-body text-slate-500 sm:col-span-3">
                        Bảo hành đến: <strong>{formatDate(order.warrantyEndDate)}</strong>
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      {filteredOrders.length > ORDER_PAGE_SIZE ? (
        <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:flex-row">
          <p className="font-body text-sm font-semibold text-slate-500">
            Trang {currentPage} / {pageCount}
          </p>
          <div className="flex w-full gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={currentPage === 1}
              className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-body font-bold text-slate-700 disabled:bg-slate-100 disabled:text-slate-300 sm:flex-none"
            >
              Trước
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              disabled={currentPage === pageCount}
              className="min-h-11 flex-1 rounded-xl bg-slate-900 px-4 py-2 text-sm font-body font-bold text-white disabled:bg-slate-200 disabled:text-slate-400 sm:flex-none"
            >
              Tiếp
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
