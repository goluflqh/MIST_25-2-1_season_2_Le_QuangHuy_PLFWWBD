"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

interface UserInfo {
  id: string;
  name: string;
  phone: string;
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
}

interface WarrantyInfo {
  id: string;
  serialNo: string;
  productName: string;
  service: string;
  endDate: string;
  endDateLabel: string;
  isActive: boolean;
  notes: string | null;
}

interface FeedbackMessage {
  text: string;
  type: "success" | "error";
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
  if (warranties.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 mb-6 p-6">
      <h3 className="font-heading font-bold text-slate-900 mb-3">🛡️ Phiếu Bảo Hành Của Bạn</h3>
      <div className="space-y-3">
        {warranties.map((warranty) => {
          const isValid = warranty.isActive;
          return (
            <div
              key={warranty.id}
              className={`rounded-xl p-4 border ${isValid ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-bold bg-white/70 px-2 py-0.5 rounded">
                      {warranty.serialNo}
                    </code>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isValid ? "bg-green-200 text-green-800" : "bg-red-200 text-red-800"}`}
                    >
                      {isValid ? "✅ Còn BH" : "❌ Hết BH"}
                    </span>
                  </div>
                  <p className="font-body font-semibold text-sm text-slate-800 mt-1">
                    {warranty.productName}
                  </p>
                  <p className="font-body text-xs text-slate-400">
                    {serviceLabels[warranty.service]} · Hết hạn:{" "}
                    {warranty.endDateLabel}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReferralSection() {
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const referralLink =
    typeof window !== "undefined" && referralCode
      ? `${window.location.origin}/dang-ky?ref=${referralCode}`
      : "";

  const copyLink = () => {
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
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 mb-6 p-6">
      <h3 className="font-heading font-bold text-slate-900 mb-2">🎁 Giới Thiệu Bạn Bè</h3>
      <p className="font-body text-xs text-slate-400 mb-3">
        Gửi link mời cho bạn bè → bạn bè đăng ký thành công → cả 2 nhận +20 điểm thưởng!
      </p>
      {error ? (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-body font-semibold text-red-600">
          {error}
        </div>
      ) : null}
      {!referralCode ? (
        <button
          onClick={generateCode}
          disabled={isGenerating}
          className="px-5 py-2.5 bg-yellow-500 text-slate-900 rounded-xl font-body font-bold text-sm hover:bg-yellow-600 disabled:bg-slate-200 disabled:text-slate-500 transition-colors"
        >
          {isGenerating ? "Đang tạo link..." : "Lấy Link Mời"}
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              readOnly
              value={referralLink}
              aria-label="Link giới thiệu"
              className="flex-1 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono text-slate-600 select-all"
            />
            <button
              onClick={copyLink}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${copied ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}
            >
              {copied ? "✓ Đã copy" : "📋 Copy"}
            </button>
          </div>
          <p className="font-body text-[10px] text-slate-300">Mã: {referralCode}</p>
        </div>
      )}
    </div>
  );
}

function PasswordChangeSection() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [msg, setMsg] = useState<FeedbackMessage | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
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
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 mb-6 p-6">
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center justify-between w-full">
        <h3 className="font-heading font-bold text-slate-900">🔐 Đổi Mật Khẩu</h3>
        <span className="text-slate-400 text-sm">{isOpen ? "▲" : "▼"}</span>
      </button>
      {isOpen ? (
        <div className="mt-4 space-y-3">
          {msg ? (
            <div
              className={`p-2 rounded-xl text-xs font-body font-bold text-center ${msg.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}
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
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-body outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Ít nhất 6 ký tự"
            />
            {newPw.length > 0 && newPw.length < 6 ? (
              <p className="text-[10px] text-red-500 font-body mt-1">
                Cần thêm {6 - newPw.length} ký tự
              </p>
            ) : null}
            {newPw.length >= 6 ? (
              <p className="text-[10px] text-green-600 font-body mt-1">✓ Đủ dài</p>
            ) : null}
          </div>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-xl font-body font-bold text-sm transition-colors"
          >
            {isLoading ? "Đang đổi..." : "Xác Nhận Đổi Mật Khẩu"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

interface AccountPageClientProps {
  dataWarning?: string | null;
  initialRequests: ServiceRequest[];
  initialUser: UserInfo;
  initialWarranties: WarrantyInfo[];
}

export default function AccountPageClient({
  dataWarning,
  initialRequests,
  initialUser,
  initialWarranties,
}: AccountPageClientProps) {
  const router = useRouter();
  const { user, setUser } = useAuth();
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

  const handleSubmitRequest = async (e: React.FormEvent) => {
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

  const handleSubmitReview = async (e: React.FormEvent) => {
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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 animate-fade-in-up">
      {dataWarning ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-body font-semibold text-amber-800">
          {dataWarning}
        </div>
      ) : null}

      <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 border border-slate-100 mb-6">
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white text-2xl font-heading font-extrabold shadow-lg shrink-0">
            {initialUser.name.charAt(0).toUpperCase()}
          </div>
          <div className="text-center sm:text-left flex-1">
            <h1 className="font-heading font-extrabold text-xl text-slate-900">{initialUser.name}</h1>
            <p className="font-body text-sm text-slate-500">
              📱 {initialUser.phone} · Thành viên từ {initialUser.createdAtLabel}
            </p>
          </div>
          <div className="flex gap-2">
            {initialUser.role === "ADMIN" ? (
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-slate-900 text-white rounded-xl font-body font-bold text-sm hover:bg-slate-800 transition-colors"
              >
                🛠 Admin
              </Link>
            ) : null}
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl font-body font-bold text-sm hover:bg-red-100 transition-colors"
            >
              {isLoggingOut ? "Đang đăng xuất..." : "Đăng Xuất"}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 mb-6 p-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-body text-xs text-slate-400 uppercase tracking-wider mb-1">Điểm Thưởng Tích Luỹ</p>
            <div className="flex items-center gap-3">
              <span className="font-heading font-extrabold text-3xl text-slate-900">
                {initialUser.loyaltyPoints}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  initialUser.loyaltyPoints >= 500
                    ? "bg-yellow-100 text-yellow-700"
                    : initialUser.loyaltyPoints >= 200
                      ? "bg-slate-200 text-slate-700"
                      : initialUser.loyaltyPoints >= 50
                        ? "bg-orange-100 text-orange-700"
                        : "bg-slate-100 text-slate-500"
                }`}
              >
                {initialUser.loyaltyPoints >= 500
                  ? "💎 Kim Cương"
                  : initialUser.loyaltyPoints >= 200
                    ? "🥇 Vàng"
                    : initialUser.loyaltyPoints >= 50
                      ? "🥈 Bạc"
                      : "🥉 Đồng"}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="font-body text-xs text-slate-400">
              {initialUser.loyaltyPoints < 50
                ? `Còn ${50 - initialUser.loyaltyPoints} điểm → Bạc`
                : initialUser.loyaltyPoints < 200
                  ? `Còn ${200 - initialUser.loyaltyPoints} điểm → Vàng`
                  : initialUser.loyaltyPoints < 500
                    ? `Còn ${500 - initialUser.loyaltyPoints} điểm → Kim Cương`
                    : "🎉 Hạng cao nhất!"}
            </p>
          </div>
        </div>
        <div className="mt-3 bg-slate-50 rounded-xl p-3">
          <p className="font-body text-xs text-slate-500">
            💡 Tích điểm khi sử dụng dịch vụ tại Minh Hồng! Đổi điểm để nhận ưu đãi giảm giá, bảo
            hành mở rộng và quà tặng.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 mb-6 overflow-hidden">
        <button
          onClick={() => setShowForm(!showForm)}
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
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white font-heading font-bold rounded-xl transition-colors"
                >
                  {isSubmitting ? "Đang gửi..." : "Gửi Yêu Cầu"}
                </button>
              </form>
            )}
          </div>
        ) : null}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 mb-6 overflow-hidden">
        <button
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
                    value={reviewData.comment}
                    onChange={(e) => setReviewData({ ...reviewData, comment: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 font-body text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none"
                    placeholder="Chia sẻ trải nghiệm của bạn..."
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isReviewSubmitting}
                  className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 disabled:bg-slate-400 text-slate-900 font-heading font-bold rounded-xl transition-colors"
                >
                  {isReviewSubmitting ? "Đang gửi..." : "Gửi Đánh Giá ⭐"}
                </button>
              </form>
            )}
          </div>
        ) : null}
      </div>

      <WarrantyCards warranties={initialWarranties} />
      <ReferralSection />
      <PasswordChangeSection />

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-heading font-bold text-slate-900">📋 Lịch Sử Yêu Cầu Của Bạn</h3>
          <p className="font-body text-xs text-slate-400 mt-0.5">{requests.length} yêu cầu</p>
        </div>
        {requests.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-3xl mb-2">📭</p>
            <p className="font-body text-slate-400 mb-3">Bạn chưa có yêu cầu nào</p>
            <button
              onClick={() => setShowForm(true)}
              className="font-body font-bold text-sm text-red-600 hover:text-red-700"
            >
              + Gửi yêu cầu đầu tiên
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {requests.map((request) => (
              <div key={request.id} className="px-6 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-body font-semibold text-sm text-slate-800">
                      {serviceLabels[request.service] || request.service}
                    </p>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusConfig[request.status]?.color}`}
                    >
                      {statusConfig[request.status]?.label || request.status}
                    </span>
                  </div>
                  {request.message ? (
                    <p className="font-body text-xs text-slate-400 mt-0.5 truncate">{request.message}</p>
                  ) : null}
                  <p className="font-body text-[10px] text-slate-300 mt-1">{request.createdAtLabel}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
