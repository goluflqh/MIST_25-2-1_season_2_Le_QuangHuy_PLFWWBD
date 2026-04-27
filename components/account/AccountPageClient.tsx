"use client";

import { startTransition, type FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getPayableAmount } from "@/lib/coupon-discounts";

interface UserInfo {
  id: string;
  name: string;
  phone: string;
  referralCode: string | null;
  referralCount: number;
  role: string;
  loyaltyPoints: number;
  createdAt: string;
  createdAtLabel: string;
}

interface ServiceRequest {
  id: string;
  service: string;
  message: string | null;
  status: string;
  createdAt: string;
  createdAtLabel: string;
  updatedAtLabel: string;
}

interface WarrantyInfo {
  id: string;
  serialNo: string;
  productName: string;
  service: string;
  startDateLabel: string;
  endDate: string;
  endDateLabel: string;
  isActive: boolean;
  notes: string | null;
}

interface ServiceOrderInfo {
  id: string;
  orderCode: string;
  service: string;
  productName: string;
  status: string;
  orderDateLabel: string;
  quotedPrice: number | null;
  paidAmount: number;
  couponCode: string | null;
  couponDiscount: string | null;
  discountAmount: number;
  warrantyEndDateLabel: string | null;
  notes: string | null;
}

interface WarrantyLookupData {
  id: string;
  serialNo: string;
  productName: string;
  customerName: string;
  customerPhone: string;
  service: string;
  startDate: string;
  endDate: string;
  notes: string | null;
  isValid: boolean;
}

interface FeedbackMessage {
  text: string;
  type: "success" | "error";
}

interface CouponInfo {
  id: string;
  code: string;
  description: string;
  discount: string;
  pointsCost: number;
  remainingUses: number;
  expiresAtLabel: string | null;
  isOwned: boolean;
}

const serviceLabels: Record<string, string> = {
  DONG_PIN: "🔋 Đóng Pin",
  DEN_NLMT: "☀️ Đèn NLMT",
  PIN_LUU_TRU: "⚡ Pin Lưu Trữ",
  CAMERA: "📹 Camera",
  CUSTOM: "🔧 Custom",
  KHAC: "📞 Khác",
};

const statusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Chờ xử lý", color: "bg-yellow-100 text-yellow-700" },
  CONTACTED: { label: "Đã liên hệ", color: "bg-blue-100 text-blue-700" },
  IN_PROGRESS: { label: "Đang thực hiện", color: "bg-orange-100 text-orange-700" },
  COMPLETED: { label: "Hoàn thành", color: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Đã huỷ", color: "bg-red-100 text-red-700" },
};

const orderStatusConfig: Record<string, { label: string; color: string }> = {
  RECEIVED: { label: "Mới nhận", color: "bg-slate-100 text-slate-700" },
  CHECKING: { label: "Đang kiểm tra", color: "bg-amber-100 text-amber-700" },
  QUOTED: { label: "Đã báo giá", color: "bg-blue-100 text-blue-700" },
  IN_PROGRESS: { label: "Đang làm", color: "bg-orange-100 text-orange-700" },
  COMPLETED: { label: "Hoàn thành", color: "bg-green-100 text-green-700" },
  DELIVERED: { label: "Đã giao", color: "bg-emerald-100 text-emerald-700" },
  CANCELLED: { label: "Đã huỷ", color: "bg-red-100 text-red-700" },
};

const requestStages = [
  { key: "PENDING", label: "Tiếp nhận" },
  { key: "CONTACTED", label: "Liên hệ" },
  { key: "IN_PROGRESS", label: "Đang làm" },
  { key: "COMPLETED", label: "Hoàn thành" },
];

function getRequestStageIndex(status: string) {
  if (status === "CANCELLED") return 0;
  const index = requestStages.findIndex((stage) => stage.key === status);
  return index >= 0 ? index : 0;
}

function getRequestNextAction(status: string) {
  switch (status) {
    case "PENDING":
      return "Minh Hồng đang tiếp nhận và sẽ liên hệ để xác nhận thông tin.";
    case "CONTACTED":
      return "Đã liên hệ. Bước tiếp theo là chốt lịch khảo sát hoặc phương án xử lý.";
    case "IN_PROGRESS":
      return "Dịch vụ đang được thực hiện. Bạn có thể theo dõi trạng thái tại đây.";
    case "COMPLETED":
      return "Yêu cầu đã hoàn thành. Bạn có thể gửi đánh giá để Minh Hồng cải thiện dịch vụ.";
    case "CANCELLED":
      return "Yêu cầu đã huỷ. Bạn có thể tạo yêu cầu mới khi cần hỗ trợ.";
    default:
      return "Trạng thái đang được cập nhật.";
  }
}

function getWarrantyRemainingLabel(endDate: string, isActive: boolean) {
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / dayMs);

  if (!isActive || days <= 0) return "Đã hết hạn";
  if (days === 1) return "Còn 1 ngày";
  return `Còn ${days} ngày`;
}

function formatMoney(value: number | null | undefined) {
  if (!value) return "0đ";
  return `${value.toLocaleString("vi-VN")}đ`;
}

function getLoyaltyTier(points: number) {
  if (points >= 500) {
    return { label: "Kim Cương", next: "Hạng cao nhất", color: "bg-yellow-100 text-yellow-700" };
  }
  if (points >= 200) {
    return { label: "Vàng", next: `Còn ${500 - points} điểm để lên Kim Cương`, color: "bg-slate-200 text-slate-700" };
  }
  if (points >= 50) {
    return { label: "Bạc", next: `Còn ${200 - points} điểm để lên Vàng`, color: "bg-orange-100 text-orange-700" };
  }
  return { label: "Đồng", next: `Còn ${50 - points} điểm để lên Bạc`, color: "bg-slate-100 text-slate-500" };
}

function getLoyaltyProgress(points: number) {
  if (points >= 500) return 100;
  if (points >= 200) return Math.min(100, Math.round((points / 500) * 100));
  if (points >= 50) return Math.min(100, Math.round((points / 200) * 100));
  return Math.min(100, Math.round((points / 50) * 100));
}

function getInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("");

  return (initials || "M").toUpperCase();
}

const clientDateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
});

function formatClientVietnamDateTime(date: Date) {
  return clientDateTimeFormatter.format(date);
}

function WarrantyCards({ warranties }: { warranties: WarrantyInfo[] }) {
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupResults, setLookupResults] = useState<WarrantyLookupData[]>([]);
  const [lookupMessage, setLookupMessage] = useState<FeedbackMessage | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  const lookupWarranty = async (event: FormEvent) => {
    event.preventDefault();
    const query = lookupQuery.trim();
    if (!query) {
      setLookupMessage({ text: "Nhập số serial hoặc số điện thoại cần tra cứu.", type: "error" });
      return;
    }

    setIsLookingUp(true);
    setLookupMessage(null);
    setLookupResults([]);

    try {
      const response = await fetch(`/api/warranty/lookup?query=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        setLookupMessage({
          text: data.message || "Chưa tra cứu được bảo hành lúc này.",
          type: "error",
        });
        return;
      }

      const results = Array.isArray(data.warranties) ? data.warranties : data.warranty ? [data.warranty] : [];
      setLookupResults(results);
      setLookupMessage({
        text: results.length > 1 ? `Đã tìm thấy ${results.length} phiếu bảo hành.` : "Đã tìm thấy thông tin bảo hành.",
        type: "success",
      });
    } catch {
      setLookupMessage({ text: "Kết nối bị gián đoạn khi tra cứu bảo hành.", type: "error" });
    } finally {
      setIsLookingUp(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 mb-6 p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div>
          <h3 className="font-heading font-bold text-slate-900">🛡️ Phiếu Bảo Hành</h3>
          <p className="font-body text-xs text-slate-400">
            Theo dõi hạn bảo hành và tra cứu nhanh bằng số serial hoặc số điện thoại.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-body font-bold text-slate-500">
          {warranties.length} phiếu
        </span>
      </div>

      {warranties.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center">
          <p className="font-body text-sm font-semibold text-slate-600">Chưa có phiếu bảo hành gắn với tài khoản.</p>
          <p className="font-body text-xs text-slate-400 mt-1">
            Nếu đã có serial hoặc số điện thoại mua hàng, bạn vẫn có thể tra cứu trực tiếp bên dưới.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {warranties.map((warranty) => {
            const isValid = warranty.isActive;
            return (
              <div
                key={warranty.id}
                className={`rounded-xl p-4 border ${isValid ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-xs font-bold bg-white/70 px-2 py-0.5 rounded">
                        {warranty.serialNo}
                      </code>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isValid ? "bg-green-200 text-green-800" : "bg-red-200 text-red-800"}`}
                      >
                        {isValid ? "Còn bảo hành" : "Hết bảo hành"}
                      </span>
                    </div>
                    <p className="font-body font-semibold text-sm text-slate-800 mt-1">
                      {warranty.productName}
                    </p>
                    <p className="font-body text-xs text-slate-400">
                      {serviceLabels[warranty.service]} · Từ {warranty.startDateLabel} đến {warranty.endDateLabel}
                    </p>
                    {warranty.notes ? (
                      <p className="font-body text-xs text-slate-500 mt-2">{warranty.notes}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded-lg bg-white/80 px-2.5 py-1 text-[10px] font-body font-bold text-slate-600">
                    {getWarrantyRemainingLabel(warranty.endDate, isValid)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={lookupWarranty} className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
        <label className="block font-body text-xs font-bold text-slate-500 mb-2">
          Tra cứu bằng serial hoặc số điện thoại
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            data-testid="account-warranty-query"
            value={lookupQuery}
            onChange={(event) => setLookupQuery(event.target.value)}
            placeholder="Ví dụ: MH-BH-001 hoặc 0912345678"
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-body outline-none focus:ring-2 focus:ring-red-500"
          />
          <button
            data-testid="account-warranty-lookup"
            type="submit"
            disabled={isLookingUp}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-body font-bold text-white transition-colors disabled:bg-slate-300"
          >
            {isLookingUp ? "Đang tra..." : "Tra cứu"}
          </button>
        </div>
        {lookupMessage ? (
          <div
            data-testid="account-warranty-message"
            aria-live="polite"
            className={`mt-3 rounded-lg border px-3 py-2 text-xs font-body font-semibold ${
              lookupMessage.type === "success"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-600"
            }`}
          >
            {lookupMessage.text}
          </div>
        ) : null}
        {lookupResults.length > 0 ? (
          <div data-testid="account-warranty-result" className="mt-3 space-y-2">
            {lookupResults.map((lookupResult) => (
              <div key={lookupResult.id || lookupResult.serialNo} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <code className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      {lookupResult.serialNo}
                    </code>
                    <p className="mt-1 font-body text-sm font-bold text-slate-800">{lookupResult.productName}</p>
                    <p className="font-body text-xs text-slate-400">
                      {serviceLabels[lookupResult.service] || lookupResult.service} · {lookupResult.customerName}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-body font-bold ${
                      lookupResult.isValid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {lookupResult.isValid ? "Còn hiệu lực" : "Hết hạn"}
                  </span>
                </div>
                <p className="mt-2 font-body text-xs text-slate-500">
                  Hết hạn: {new Date(lookupResult.endDate).toLocaleDateString("vi-VN")} ·{" "}
                  {getWarrantyRemainingLabel(lookupResult.endDate, lookupResult.isValid)}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </form>
    </div>
  );
}

function ServiceOrderCards({ orders }: { orders: ServiceOrderInfo[] }) {
  return (
    <div data-testid="account-service-orders" className="bg-white rounded-2xl shadow-sm border border-slate-100 mb-6 p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div>
          <h3 className="font-heading font-bold text-slate-900">🧾 Lịch Sử Dịch Vụ</h3>
          <p className="font-body text-xs text-slate-400">
            Các đơn Minh Hồng đã xác nhận hiển thị trong tài khoản của bạn.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-body font-bold text-slate-500">
          {orders.length} đơn
        </span>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center">
          <p className="font-body text-sm font-semibold text-slate-600">Chưa có đơn dịch vụ được hiển thị.</p>
          <p className="font-body text-xs text-slate-400 mt-1">
            Nếu bạn từng làm dịch vụ trước đây, cửa hàng có thể đối chiếu và gắn lại theo số điện thoại.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const status = orderStatusConfig[order.status] || orderStatusConfig.RECEIVED;
            const payable = getPayableAmount(order.quotedPrice, order.discountAmount);
            const remaining = Math.max(payable - order.paidAmount, 0);

            return (
              <div key={order.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="rounded bg-white px-2 py-0.5 text-xs font-bold text-slate-700">
                        {order.orderCode}
                      </code>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-1 font-body text-sm font-semibold text-slate-800">{order.productName}</p>
                    <p className="font-body text-xs text-slate-400">
                      {serviceLabels[order.service] || order.service} · {order.orderDateLabel}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 font-body text-[10px] text-slate-500">
                      <span>Giá gốc: {formatMoney(order.quotedPrice)}</span>
                      {order.discountAmount > 0 ? (
                        <span>Giảm: {formatMoney(order.discountAmount)}</span>
                      ) : null}
                      <span>Phải trả: {formatMoney(payable)}</span>
                      <span>Đã thu: {formatMoney(order.paidAmount)}</span>
                      {remaining > 0 ? <span>Còn lại: {formatMoney(remaining)}</span> : null}
                      {order.warrantyEndDateLabel ? <span>BH đến: {order.warrantyEndDateLabel}</span> : null}
                    </div>
                    {order.couponCode ? (
                      <p className="mt-2 font-body text-xs font-semibold text-emerald-700">
                        Đã áp dụng mã {order.couponCode} ({order.couponDiscount || "ưu đãi"})
                      </p>
                    ) : null}
                    {order.notes ? (
                      <p className="mt-2 font-body text-xs text-slate-500">{order.notes}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RewardsSection({
  initialCoupons,
  initialReferralCount,
  initialReferralCode,
  loyaltyPoints,
  onLoyaltyPointsChange,
}: {
  initialCoupons: CouponInfo[];
  initialReferralCount: number;
  initialReferralCode: string | null;
  loyaltyPoints: number;
  onLoyaltyPointsChange: (points: number) => void;
}) {
  const [referralCode, setReferralCode] = useState<string | null>(initialReferralCode);
  const [coupons, setCoupons] = useState<CouponInfo[]>(initialCoupons);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [couponMessage, setCouponMessage] = useState<FeedbackMessage | null>(null);
  const tier = getLoyaltyTier(loyaltyPoints);
  const progress = getLoyaltyProgress(loyaltyPoints);
  const availableCoupons = coupons.filter((coupon) => !coupon.isOwned);
  const ownedCoupons = coupons.filter((coupon) => coupon.isOwned);

  const generateCode = async () => {
    setError(null);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/referral", { method: "POST" });
      const data = await response.json();

      if (response.ok && data.success) {
        setReferralCode(data.code);
        return;
      }

      setError(data.message || "Chưa tạo được link mời lúc này.");
    } catch {
      setError("Kết nối bị gián đoạn khi tạo link mời.");
    } finally {
      setIsGenerating(false);
    }
  };

  const redeemCoupon = async (couponId: string) => {
    setCouponMessage(null);
    setRedeemingId(couponId);

    try {
      const response = await fetch("/api/coupons/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponId }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setCouponMessage({
          text: data.message || "Chưa đổi được mã ưu đãi lúc này.",
          type: "error",
        });
        return;
      }

      setCoupons((prev) =>
        prev.map((coupon) =>
          coupon.id === couponId
            ? {
                ...coupon,
                ...(data.coupon || {}),
                isOwned: true,
                remainingUses: Math.max(0, coupon.remainingUses - 1),
              }
            : coupon
        )
      );
      if (typeof data.loyaltyPoints === "number") {
        onLoyaltyPointsChange(data.loyaltyPoints);
      }
      setCouponMessage({
        text: data.message || "Đã đổi mã ưu đãi thành công.",
        type: "success",
      });
    } catch {
      setCouponMessage({ text: "Kết nối bị gián đoạn khi đổi mã ưu đãi.", type: "error" });
    } finally {
      setRedeemingId(null);
    }
  };

  const referralLink =
    typeof window !== "undefined" && referralCode
      ? `${window.location.origin}/dang-ky?ref=${referralCode}`
      : "";

  const copyLink = () => {
    if (!referralLink) return;

    navigator.clipboard
      .writeText(referralLink)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        setError("Chưa sao chép được link, bạn thử lại nhé.");
      });
  };

  return (
    <div data-testid="account-rewards-section" className="bg-white rounded-2xl shadow-sm border border-slate-100 mb-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div>
          <h3 className="font-heading font-bold text-slate-900">🎁 Điểm Thưởng & Giới Thiệu</h3>
          <p className="font-body text-xs text-slate-400 mt-1">
            Gửi link mời, đổi điểm lấy ưu đãi và theo dõi hạng thành viên.
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2 text-right">
          <p className="font-body text-[10px] uppercase tracking-wider text-slate-400">Hạng hiện tại</p>
          <p className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-body font-bold ${tier.color}`}>
            {tier.label}
          </p>
        </div>
      </div>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <p className="font-body text-[10px] uppercase tracking-wider text-slate-400">Điểm hiện có</p>
          <p className="font-heading text-2xl font-extrabold text-slate-900">{loyaltyPoints}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-yellow-400" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <p className="font-body text-[10px] uppercase tracking-wider text-slate-400">Mốc tiếp theo</p>
          <p className="font-body text-sm font-bold text-slate-700">{tier.next}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 sm:col-span-2">
          <p className="font-body text-[10px] uppercase tracking-wider text-slate-400">Người đã đăng ký từ link mời</p>
          <p data-testid="account-referral-count" className="font-heading text-2xl font-extrabold text-slate-900">
            {initialReferralCount}
          </p>
        </div>
      </div>
      {error ? (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-body font-semibold text-red-600">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
        <div className="mb-3">
          <p className="font-body text-xs font-bold uppercase tracking-wider text-slate-500">Link mời bạn bè</p>
          <p className="mt-1 font-body text-xs text-slate-400">
            Gửi link này cho người thân hoặc bạn bè. Khi họ đăng ký bằng link, hệ thống sẽ ghi nhận vào số người đã mời.
          </p>
        </div>
        {!referralCode ? (
          <button
            data-testid="account-referral-generate"
            type="button"
            onClick={generateCode}
            disabled={isGenerating}
            className="px-5 py-2.5 bg-yellow-500 text-slate-900 rounded-xl font-body font-bold text-sm hover:bg-yellow-600 disabled:bg-slate-200 disabled:text-slate-500 transition-colors"
          >
            {isGenerating ? "Đang tạo link…" : "Lấy Link Mời"}
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                data-testid="account-referral-link"
                readOnly
                value={referralLink}
                aria-label="Link giới thiệu"
                className="flex-1 px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-mono text-slate-600 select-all"
              />
              <button
                data-testid="account-referral-copy"
                type="button"
                onClick={copyLink}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${copied ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}
              >
                {copied ? "✓ Đã copy" : "📋 Copy"}
              </button>
            </div>
            <p className="font-body text-[10px] text-slate-400">Mã: {referralCode}</p>
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="font-body text-xs font-bold uppercase tracking-wider text-slate-400">Ưu đãi đổi điểm</p>
          <p className="font-body text-[10px] text-slate-400">{ownedCoupons.length} mã đã đổi</p>
        </div>
        {couponMessage ? (
          <div
            data-testid="account-coupon-message"
            aria-live="polite"
            className={`mb-3 rounded-xl border px-3 py-2 text-xs font-body font-semibold ${
              couponMessage.type === "success"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-600"
            }`}
          >
            {couponMessage.text}
          </div>
        ) : null}
        {coupons.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center">
            <p className="font-body text-sm font-semibold text-slate-600">Chưa có mã ưu đãi đang mở.</p>
            <p className="font-body text-xs text-slate-400 mt-1">
              Điểm của bạn vẫn được giữ và sẽ dùng được khi có chương trình mới.
            </p>
          </div>
        ) : (
          <div data-testid="account-coupon-list" className="space-y-3">
            {availableCoupons.map((coupon) => {
              const canRedeem = loyaltyPoints >= coupon.pointsCost && coupon.remainingUses > 0;

              return (
                <div key={coupon.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-slate-800">
                          {coupon.code}
                        </code>
                        <span className="text-xs font-heading font-bold text-red-600">-{coupon.discount}</span>
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-700">
                          {coupon.pointsCost} điểm
                        </span>
                      </div>
                      <p className="mt-1 font-body text-xs text-slate-500">{coupon.description}</p>
                      <p className="mt-0.5 font-body text-[10px] text-slate-400">
                        Còn {coupon.remainingUses} lượt{coupon.expiresAtLabel ? ` · Hết hạn ${coupon.expiresAtLabel}` : ""}
                      </p>
                    </div>
                    <button
                      data-testid="account-coupon-redeem"
                      type="button"
                      onClick={() => redeemCoupon(coupon.id)}
                      disabled={redeemingId === coupon.id || !canRedeem}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-body font-bold text-white transition-colors disabled:bg-slate-200 disabled:text-slate-400"
                    >
                      {redeemingId === coupon.id ? "Đang đổi..." : canRedeem ? "Đổi mã" : "Chưa đủ điểm"}
                    </button>
                  </div>
                </div>
              );
            })}
            {ownedCoupons.map((coupon) => (
              <div
                key={coupon.id}
                data-testid="account-coupon-owned"
                className="rounded-xl border border-green-200 bg-green-50 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded-lg bg-white/80 px-2 py-1 text-xs font-bold text-green-800">
                    {coupon.code}
                  </code>
                  <span className="text-xs font-heading font-bold text-green-700">-{coupon.discount}</span>
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold text-green-700">
                    Đã đổi
                  </span>
                </div>
                <p className="mt-1 font-body text-xs text-green-700">{coupon.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AccountHero({
  initialUser,
  isLoggingOut,
  requestCount,
  serviceOrderCount,
  warrantyCount,
  onLogout,
}: {
  initialUser: UserInfo;
  isLoggingOut: boolean;
  requestCount: number;
  serviceOrderCount: number;
  warrantyCount: number;
  onLogout: () => void;
}) {
  const accountStats = [
    { label: "Yêu cầu đã gửi", value: requestCount, helper: requestCount > 0 ? "Đang được theo dõi" : "Chưa có yêu cầu" },
    { label: "Đơn dịch vụ", value: serviceOrderCount, helper: serviceOrderCount > 0 ? "Đã gắn với tài khoản" : "Chưa có đơn hiển thị" },
    { label: "Phiếu bảo hành", value: warrantyCount, helper: warrantyCount > 0 ? "Gắn với tài khoản" : "Có thể tra serial" },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 border border-slate-100 mb-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white text-xl font-heading font-extrabold shadow-lg shrink-0">
          {getInitials(initialUser.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-body text-xs font-bold uppercase tracking-wider text-red-500">Hồ sơ khách hàng</p>
          <h1 data-testid="account-name" className="mt-1 font-heading font-extrabold text-xl text-slate-900">
            {initialUser.name}
          </h1>
          <p className="font-body text-sm text-slate-500 break-words">
            {initialUser.phone} · Thành viên từ {initialUser.createdAtLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {initialUser.role === "ADMIN" ? (
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-slate-900 text-white rounded-xl font-body font-bold text-sm hover:bg-slate-800 transition-colors"
            >
              Admin
            </Link>
          ) : null}
          <button
            data-testid="account-logout"
            onClick={onLogout}
            disabled={isLoggingOut}
            className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl font-body font-bold text-sm hover:bg-red-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 transition-colors"
          >
            {isLoggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-slate-100">
        {accountStats.map((item) => (
          <div key={item.label} className="sm:px-4 first:sm:pl-0 last:sm:pr-0">
            <p className="font-body text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {item.label}
            </p>
            <p className="mt-1 font-heading text-lg font-extrabold text-slate-900">{item.value}</p>
            <p className="mt-0.5 font-body text-xs text-slate-400">{item.helper}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PasswordChangeSection() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [msg, setMsg] = useState<FeedbackMessage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const passwordChecks = [
    { label: "Mật khẩu mới có ít nhất 6 ký tự", done: newPw.length >= 6 },
    { label: "Mật khẩu mới khác mật khẩu hiện tại", done: Boolean(currentPw && newPw && currentPw !== newPw) },
  ];
  const canSubmit = currentPw.trim().length > 0 && passwordChecks.every((check) => check.done);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMsg(null);
    if (!currentPw.trim()) {
      setMsg({ text: "Nhập mật khẩu hiện tại.", type: "error" });
      return;
    }
    if (newPw.length < 6) {
      setMsg({ text: "Mật khẩu mới phải ≥ 6 ký tự.", type: "error" });
      return;
    }
    if (currentPw === newPw) {
      setMsg({ text: "Mật khẩu mới phải khác mật khẩu cũ.", type: "error" });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMsg({ text: "✓ Đổi mật khẩu thành công!", type: "success" });
        setCurrentPw("");
        setNewPw("");
      } else {
        setMsg({ text: data.message || "Lỗi đổi mật khẩu.", type: "error" });
      }
    } catch {
      setMsg({ text: "Lỗi kết nối.", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 mb-6 overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center justify-between w-full px-6 py-4 hover:bg-slate-50 transition-colors">
        <span className="text-left">
          <span className="block font-heading font-bold text-slate-900">Bảo mật đăng nhập</span>
          <span className="block font-body text-xs text-slate-400 mt-0.5">
            Đổi mật khẩu khi cần, với kiểm tra điều kiện rõ ràng trước khi gửi.
          </span>
        </span>
        <span className="text-slate-400 text-sm">{isOpen ? "Thu gọn" : "Mở"}</span>
      </button>
      {isOpen ? (
        <form onSubmit={handleSubmit} className="space-y-4 border-t border-slate-100 px-6 py-5">
          {msg ? (
            <div
              className={`rounded-xl border px-3 py-2 text-xs font-body font-bold ${
                msg.type === "success"
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-red-50 text-red-700 border-red-200"
              }`}
            >
              {msg.text}
            </div>
          ) : null}
          <div>
            <label className="block text-xs font-body font-semibold text-slate-600 mb-1">
              Mật khẩu hiện tại
            </label>
            <input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              autoComplete="current-password"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-body outline-none focus:ring-2 focus:ring-red-500"
              placeholder="••••••"
            />
          </div>
          <div>
            <label className="block text-xs font-body font-semibold text-slate-600 mb-1">
              Mật khẩu mới
            </label>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-body outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Ít nhất 6 ký tự"
            />
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-3">
            <p className="font-body text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Kiểm tra trước khi đổi
            </p>
            <div className="space-y-1.5">
              {passwordChecks.map((check) => (
                <p
                  key={check.label}
                  className={`font-body text-xs font-semibold ${check.done ? "text-green-700" : "text-slate-400"}`}
                >
                  {check.done ? "✓" : "•"} {check.label}
                </p>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading || !canSubmit}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-body font-bold text-sm transition-colors"
          >
            {isLoading ? "Đang đổi..." : "Xác Nhận Đổi Mật Khẩu"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

function AccountStatusPanel({
  dataWarning,
  initialUser,
  requests,
}: {
  dataWarning?: string | null;
  initialUser: UserInfo;
  requests: ServiceRequest[];
}) {
  const actionableUpdates = requests.filter((request) => request.status !== "PENDING").length;
  const latestRequest = requests[0] ?? null;
  const profileRows = [
    { label: "Họ tên", value: initialUser.name },
    { label: "Số điện thoại", value: initialUser.phone },
    { label: "Ngày tham gia", value: initialUser.createdAtLabel },
  ];

  return (
    <div data-testid="account-status-panel" className="bg-white rounded-2xl shadow-sm border border-slate-100 mb-6 p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-heading font-bold text-slate-900">Hồ sơ & thông báo</h3>
          <p className="font-body text-xs text-slate-400 mt-1">
            Thông tin định danh, trạng thái đồng bộ và các cập nhật dịch vụ.
          </p>
        </div>
        <span
          className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-body font-bold sm:mt-0 ${
            dataWarning ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
          }`}
        >
          {dataWarning ? "Đang đồng bộ" : "Đã đồng bộ"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {profileRows.map((row) => (
          <div key={row.label} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="font-body text-[10px] font-bold uppercase tracking-wider text-slate-400">{row.label}</p>
            <p className="mt-1 break-words font-body text-sm font-bold text-slate-800">{row.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <p className="font-body text-[10px] font-bold uppercase tracking-wider text-slate-400">Cập nhật mới</p>
          <p className="mt-1 font-heading text-2xl font-extrabold text-slate-900">{actionableUpdates}</p>
          <p className="font-body text-xs text-slate-500">
            {actionableUpdates > 0
              ? "Có yêu cầu đã chuyển trạng thái."
              : "Chưa có thay đổi cần chú ý."}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <p className="font-body text-[10px] font-bold uppercase tracking-wider text-slate-400">Theo dõi gần nhất</p>
          {latestRequest ? (
            <>
              <p className="mt-1 font-body text-sm font-bold text-slate-800">
                {serviceLabels[latestRequest.service] || latestRequest.service}
              </p>
              <p className="font-body text-xs text-slate-500">
                {statusConfig[latestRequest.status]?.label || "Đang cập nhật"} · {latestRequest.updatedAtLabel}
              </p>
            </>
          ) : (
            <p className="mt-1 font-body text-sm font-semibold text-slate-500">Chưa có yêu cầu để theo dõi.</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface AccountPageClientProps {
  dataWarning?: string | null;
  initialCoupons: CouponInfo[];
  initialRequests: ServiceRequest[];
  initialServiceOrders: ServiceOrderInfo[];
  initialUser: UserInfo;
  initialWarranties: WarrantyInfo[];
}

export default function AccountPageClient({
  dataWarning,
  initialCoupons,
  initialRequests,
  initialServiceOrders,
  initialUser,
  initialWarranties,
}: AccountPageClientProps) {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const requestFormRef = useRef<HTMLDivElement>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>(initialRequests);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ service: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [requestFeedback, setRequestFeedback] = useState<FeedbackMessage | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewData, setReviewData] = useState({ rating: 5, service: "", comment: "" });
  const [isReviewSubmitting, setIsReviewSubmitting] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState<FeedbackMessage | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [loyaltyPoints, setLoyaltyPoints] = useState(initialUser.loyaltyPoints);
  const canSubmitRequest = formData.service.length > 0;
  const canSubmitReview = reviewData.service.length > 0 && reviewData.comment.trim().length > 0;

  const openRequestForm = () => {
    setShowForm(true);
    window.setTimeout(() => {
      requestFormRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;

    const previousUser = user ?? {
      id: initialUser.id,
      name: initialUser.name,
      role: initialUser.role,
    };

    setIsLoggingOut(true);
    setUser(null);

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      startTransition(() => {
        router.replace("/dang-nhap");
      });
    } catch {
      setUser(previousUser);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleSubmitRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.service) return;

    setRequestFeedback(null);
    setSubmitSuccess(false);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: initialUser.name,
          phone: initialUser.phone,
          service: formData.service,
          message: formData.message,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSubmitSuccess(true);
        setRequestFeedback({
          text: "Yêu cầu đã được gửi và xuất hiện ngay trong lịch sử của bạn.",
          type: "success",
        });
        setRequests((prev) => [
          {
            id: data.id || `temp-${Date.now()}`,
            service: formData.service,
            message: formData.message.trim() || null,
            status: "PENDING",
            createdAt: new Date().toISOString(),
            createdAtLabel: formatClientVietnamDateTime(new Date()),
            updatedAtLabel: formatClientVietnamDateTime(new Date()),
          },
          ...prev,
        ]);
        setFormData({ service: "", message: "" });
        setTimeout(() => {
          setSubmitSuccess(false);
          setShowForm(false);
        }, 3000);
      } else {
        setRequestFeedback({
          text: data.message || "Chưa gửi được yêu cầu. Bạn thử lại sau ít phút nhé.",
          type: "error",
        });
      }
    } catch {
      setRequestFeedback({
        text: "Kết nối đang chập chờn. Yêu cầu của bạn chưa được gửi.",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitReview = async (e: FormEvent) => {
    e.preventDefault();
    if (!reviewData.comment || !reviewData.service) return;

    setReviewFeedback(null);
    setReviewSuccess(false);
    setIsReviewSubmitting(true);

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setReviewSuccess(true);
        setReviewFeedback({
          text: "Đánh giá đã được ghi nhận và sẽ hiển thị sau khi duyệt.",
          type: "success",
        });
        setReviewData({ rating: 5, service: "", comment: "" });
        setTimeout(() => {
          setReviewSuccess(false);
          setShowReviewForm(false);
        }, 4000);
      } else {
        setReviewFeedback({
          text: data.message || "Chưa gửi được đánh giá. Bạn thử lại giúp mình nhé.",
          type: "error",
        });
      }
    } catch {
      setReviewFeedback({
        text: "Kết nối bị gián đoạn nên đánh giá chưa được gửi.",
        type: "error",
      });
    } finally {
      setIsReviewSubmitting(false);
    }
  };

  const openReviewForRequest = (request: ServiceRequest) => {
    setReviewData((prev) => ({ ...prev, service: request.service }));
    setReviewFeedback(null);
    setReviewSuccess(false);
    setShowReviewForm(true);
    window.setTimeout(() => {
      document.getElementById("account-review-section")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  };

  return (
    <div
      data-testid="account-page"
      className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 animate-fade-in-up"
    >
      {dataWarning ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-body font-semibold text-amber-800">
          {dataWarning}
        </div>
      ) : null}

      <AccountHero
        initialUser={initialUser}
        isLoggingOut={isLoggingOut}
        requestCount={requests.length}
        serviceOrderCount={initialServiceOrders.length}
        warrantyCount={initialWarranties.length}
        onLogout={handleLogout}
      />

      <AccountStatusPanel dataWarning={dataWarning} initialUser={initialUser} requests={requests} />

      <div ref={requestFormRef} className="bg-white rounded-2xl shadow-sm border border-slate-100 mb-6 overflow-hidden">
        <button
          data-testid="account-request-toggle"
          type="button"
          aria-expanded={showForm}
          onClick={() => {
            if (showForm) {
              setShowForm(false);
              return;
            }

            openRequestForm();
          }}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <span className="font-heading font-bold text-slate-900 flex items-center gap-2">
            ✏️ Gửi Yêu Cầu Báo Giá / Tư Vấn Mới
          </span>
          <svg
            className={`w-5 h-5 text-slate-400 transition-transform ${showForm ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showForm ? (
          <div className="px-6 pb-6 border-t border-slate-100 pt-4">
            {submitSuccess ? (
              <div className="text-center py-6">
                <p className="text-3xl mb-2">✅</p>
                <p className="font-body font-bold text-green-700">
                  Gửi thành công! Đội ngũ kỹ thuật sẽ liên hệ bạn sớm.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitRequest} className="space-y-4">
                {requestFeedback ? (
                  <div
                    className={`rounded-xl border px-3 py-2 text-sm font-body ${
                      requestFeedback.type === "success"
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-red-200 bg-red-50 text-red-600"
                    }`}
                  >
                    {requestFeedback.text}
                  </div>
                ) : null}
                <div>
                  <label className="font-body font-semibold text-sm text-slate-700 mb-1 block">
                    Dịch vụ cần tư vấn
                  </label>
                  <select
                    data-testid="account-request-service"
                    value={formData.service}
                    onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 font-body text-sm focus:ring-2 focus:ring-red-500 outline-none"
                    required
                    title="Chọn dịch vụ"
                  >
                    <option value="">-- Chọn dịch vụ --</option>
                    <option value="DONG_PIN">🔋 Đóng Pin (xe điện, máy công cụ, loa kéo)</option>
                    <option value="DEN_NLMT">☀️ Đèn Năng Lượng Mặt Trời</option>
                    <option value="PIN_LUU_TRU">⚡ Pin Lưu Trữ / Kích Đề / Dự Phòng</option>
                    <option value="CAMERA">📹 Lắp Đặt Camera An Ninh</option>
                    <option value="CUSTOM">🔧 Đóng Bình Theo Yêu Cầu Riêng</option>
                    <option value="KHAC">📞 Tư Vấn Khác</option>
                  </select>
                </div>
                <div>
                  <label className="font-body font-semibold text-sm text-slate-700 mb-1 block">
                    Ghi chú (tuỳ chọn)
                  </label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 font-body text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none"
                    placeholder="Mô tả yêu cầu, thiết bị, kích thước pin..."
                  />
                </div>
                <button
                  data-testid="account-request-submit"
                  type="submit"
                  disabled={isSubmitting || !canSubmitRequest}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-heading font-bold rounded-xl transition-colors"
                >
                  {isSubmitting ? "Đang gửi..." : "Gửi Yêu Cầu"}
                </button>
              </form>
            )}
          </div>
        ) : null}
      </div>

      <div
        id="account-review-section"
        data-testid="account-review-section"
        className="bg-white rounded-2xl shadow-sm border border-slate-100 mb-6 overflow-hidden"
      >
        <button
          data-testid="account-review-toggle"
          aria-expanded={showReviewForm}
          onClick={() => setShowReviewForm(!showReviewForm)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <span className="font-heading font-bold text-slate-900 flex items-center gap-2">⭐ Đánh Giá Dịch Vụ</span>
          <svg
            className={`w-5 h-5 text-slate-400 transition-transform ${showReviewForm ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showReviewForm ? (
          <div className="px-6 pb-6 border-t border-slate-100 pt-4">
            {reviewSuccess ? (
              <div className="text-center py-6">
                <p className="text-3xl mb-2">🎉</p>
                <p className="font-body font-bold text-green-700">
                  Cảm ơn bạn đã đánh giá dịch vụ của Minh Hồng!
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReview} className="space-y-4">
                {reviewFeedback ? (
                  <div
                    className={`rounded-xl border px-3 py-2 text-sm font-body ${
                      reviewFeedback.type === "success"
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-red-200 bg-red-50 text-red-600"
                    }`}
                  >
                    {reviewFeedback.text}
                  </div>
                ) : null}
                <div>
                  <label className="font-body font-semibold text-sm text-slate-700 mb-2 block">
                    Đánh giá của bạn
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewData({ ...reviewData, rating: star })}
                        className={`text-2xl transition-colors ${star <= reviewData.rating ? "text-yellow-400" : "text-slate-200"} hover:text-yellow-400`}
                      >
                        ★
                      </button>
                    ))}
                    <span className="font-body text-sm text-slate-400 ml-2 self-center">
                      {reviewData.rating}/5
                    </span>
                  </div>
                </div>
                <div>
                  <label className="font-body font-semibold text-sm text-slate-700 mb-1 block">
                    Dịch vụ đã sử dụng
                  </label>
                  <select
                    data-testid="account-review-service"
                    value={reviewData.service}
                    onChange={(e) => setReviewData({ ...reviewData, service: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 font-body text-sm focus:ring-2 focus:ring-red-500 outline-none"
                    required
                    title="Chọn dịch vụ đánh giá"
                  >
                    <option value="">-- Chọn dịch vụ --</option>
                    <option value="DONG_PIN">🔋 Đóng Pin</option>
                    <option value="DEN_NLMT">☀️ Đèn NLMT</option>
                    <option value="PIN_LUU_TRU">⚡ Pin Lưu Trữ</option>
                    <option value="CAMERA">📹 Camera</option>
                    <option value="KHAC">📞 Khác</option>
                  </select>
                </div>
                <div>
                  <label className="font-body font-semibold text-sm text-slate-700 mb-1 block">
                    Bình luận
                  </label>
                  <textarea
                    data-testid="account-review-comment"
                    value={reviewData.comment}
                    onChange={(e) => setReviewData({ ...reviewData, comment: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 font-body text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none"
                    placeholder="Chia sẻ trải nghiệm của bạn..."
                    required
                  />
                </div>
                <button
                  data-testid="account-review-submit"
                  type="submit"
                  disabled={isReviewSubmitting || !canSubmitReview}
                  className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 disabled:bg-slate-200 disabled:text-slate-400 text-slate-900 font-heading font-bold rounded-xl transition-colors"
                >
                  {isReviewSubmitting ? "Đang gửi..." : "Gửi Đánh Giá ⭐"}
                </button>
              </form>
            )}
          </div>
        ) : null}
      </div>

      <ServiceOrderCards orders={initialServiceOrders} />
      <WarrantyCards warranties={initialWarranties} />
      <RewardsSection
        initialCoupons={initialCoupons}
        initialReferralCount={initialUser.referralCount}
        initialReferralCode={initialUser.referralCode}
        loyaltyPoints={loyaltyPoints}
        onLoyaltyPointsChange={setLoyaltyPoints}
      />
      <PasswordChangeSection />

      <div
        data-testid="account-request-history"
        className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-heading font-bold text-slate-900">📋 Lịch Sử Yêu Cầu Của Bạn</h3>
          <p className="font-body text-xs text-slate-400 mt-0.5">{requests.length} yêu cầu</p>
        </div>
        {requests.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-3xl mb-2">📭</p>
            <p className="font-body text-slate-400 mb-3">Bạn chưa có yêu cầu nào</p>
            <button
              data-testid="account-request-empty-open"
              type="button"
              onClick={openRequestForm}
              className="font-body font-bold text-sm text-red-600 hover:text-red-700"
            >
              + Gửi yêu cầu đầu tiên
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {requests.map((request) => {
              const status = statusConfig[request.status] || {
                label: "Đang cập nhật",
                color: "bg-slate-100 text-slate-600",
              };
              const stageIndex = getRequestStageIndex(request.status);
              const isCancelled = request.status === "CANCELLED";

              return (
                <div key={request.id} className="px-6 py-5">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-body font-semibold text-sm text-slate-800">
                            {serviceLabels[request.service] || request.service}
                          </p>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${status.color}`}>
                            {status.label}
                          </span>
                        </div>
                        <p className="font-body text-[10px] text-slate-300 mt-1">{request.createdAtLabel}</p>
                      </div>
                      <p className="font-body text-xs font-semibold text-slate-500 sm:text-right">
                        {getRequestNextAction(request.status)}
                      </p>
                    </div>

                    <div className="grid grid-cols-4 gap-2" aria-label="Tiến độ yêu cầu">
                      {requestStages.map((stage, index) => {
                        const isReached = !isCancelled && index <= stageIndex;
                        const isCurrent = !isCancelled && stage.key === request.status;

                        return (
                          <div key={stage.key} className="min-w-0">
                            <span
                              className={`block h-1.5 rounded-full ${
                                isReached ? "bg-red-500" : "bg-slate-100"
                              }`}
                            />
                            <span
                              className={`mt-1 block truncate text-[10px] font-body ${
                                isCurrent ? "font-bold text-red-600" : "text-slate-400"
                              }`}
                            >
                              {stage.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {request.message ? (
                      <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                        <p className="font-body text-xs text-slate-500 break-words">{request.message}</p>
                      </div>
                    ) : null}
                    {request.status === "COMPLETED" ? (
                      <div>
                        <button
                          data-testid="account-review-from-request"
                          type="button"
                          onClick={() => openReviewForRequest(request)}
                          className="rounded-xl bg-yellow-100 px-3 py-2 text-xs font-body font-bold text-yellow-800 transition-colors hover:bg-yellow-200"
                        >
                          Đánh giá dịch vụ này
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
