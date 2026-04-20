import { getChatbotDashboardMetrics } from "@/lib/chatbot-metrics";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function DashboardPage() {
  const [
    totalContacts,
    pendingContacts,
    contactedContacts,
    inProgressContacts,
    completedContacts,
    cancelledContacts,
    totalUsers,
    recentContacts,
    chatbotMetrics,
  ] = await Promise.all([
    prisma.contactRequest.count(),
    prisma.contactRequest.count({ where: { status: "PENDING" } }),
    prisma.contactRequest.count({ where: { status: "CONTACTED" } }),
    prisma.contactRequest.count({ where: { status: "IN_PROGRESS" } }),
    prisma.contactRequest.count({ where: { status: "COMPLETED" } }),
    prisma.contactRequest.count({ where: { status: "CANCELLED" } }),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.contactRequest.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    getChatbotDashboardMetrics(),
  ]);

  const serviceLabels: Record<string, string> = {
    DONG_PIN: "🔋 Đóng Pin", DEN_NLMT: "☀️ Đèn NLMT", PIN_LUU_TRU: "⚡ Pin Lưu Trữ",
    CAMERA: "📹 Camera", CUSTOM: "🔧 Custom", KHAC: "📞 Khác",
    battery: "🔋 Đóng Pin", camera: "📹 Camera", contact: "📞 Liên hệ",
  };

  const statusConfig: Record<string, { label: string; color: string }> = {
    PENDING: { label: "Chờ xử lý", color: "bg-yellow-100 text-yellow-700" },
    CONTACTED: { label: "Đã liên hệ", color: "bg-blue-100 text-blue-700" },
    IN_PROGRESS: { label: "Đang xử lý", color: "bg-orange-100 text-orange-700" },
    COMPLETED: { label: "Hoàn thành", color: "bg-green-100 text-green-700" },
    CANCELLED: { label: "Đã huỷ", color: "bg-red-100 text-red-700" },
  };

  const chatbotFallbackRate =
    chatbotMetrics.totalChatsMeasured > 0
      ? Math.round((chatbotMetrics.fallbackCount / chatbotMetrics.totalChatsMeasured) * 100)
      : 0;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h2 className="font-heading font-extrabold text-2xl text-slate-900 mb-1">Tổng Quan Cửa Hàng 👋</h2>
        <p className="font-body text-sm text-slate-500">Dashboard quản lý yêu cầu dịch vụ Minh Hồng</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <p className="font-body text-xs text-slate-400 uppercase tracking-wider mb-1">Tổng yêu cầu</p>
          <p className="font-heading font-extrabold text-3xl text-slate-900">{totalContacts}</p>
        </div>
        <div className="bg-yellow-50 rounded-2xl p-5 border border-yellow-200">
          <p className="font-body text-xs text-yellow-600 uppercase tracking-wider mb-1">Chờ xử lý</p>
          <p className="font-heading font-extrabold text-3xl text-yellow-700">{pendingContacts}</p>
        </div>
        <div className="bg-green-50 rounded-2xl p-5 border border-green-200">
          <p className="font-body text-xs text-green-600 uppercase tracking-wider mb-1">Hoàn thành</p>
          <p className="font-heading font-extrabold text-3xl text-green-700">{completedContacts}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <p className="font-body text-xs text-slate-400 uppercase tracking-wider mb-1">Khách hàng</p>
          <p className="font-heading font-extrabold text-3xl text-slate-900">{totalUsers}</p>
        </div>
      </div>

      {/* Status Pipeline */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h3 className="font-heading font-bold text-slate-900 mb-4">Tiến Trình Xử Lý</h3>
        <div className="grid grid-cols-5 gap-2 text-center">
          {[
            { label: "Chờ xử lý", count: pendingContacts, color: "bg-yellow-500" },
            { label: "Đã liên hệ", count: contactedContacts, color: "bg-blue-500" },
            { label: "Đang xử lý", count: inProgressContacts, color: "bg-orange-500" },
            { label: "Hoàn thành", count: completedContacts, color: "bg-green-500" },
            { label: "Đã huỷ", count: cancelledContacts, color: "bg-red-500" },
          ].map((s, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className={`w-full h-2 rounded-full ${s.color} opacity-80`}></div>
              <span className="font-heading font-extrabold text-lg text-slate-900">{s.count}</span>
              <span className="font-body text-[10px] text-slate-400 leading-tight">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-heading font-bold text-slate-900">Sức Khỏe Chatbot</h3>
            <p className="font-body text-sm text-slate-500">
              Số liệu 7 ngày gần nhất để xem bot đang kéo lead hay còn hụt ý khách ở đâu.
            </p>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-body font-semibold text-slate-500">
            Fallback: {chatbotFallbackRate}%
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
            <p className="font-body text-xs uppercase tracking-wider text-slate-400 mb-1">
              Lượt chat đo được
            </p>
            <p className="font-heading text-3xl font-extrabold text-slate-900">
              {chatbotMetrics.totalChatsMeasured}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="font-body text-xs uppercase tracking-wider text-emerald-600 mb-1">
              Lead signal
            </p>
            <p className="font-heading text-3xl font-extrabold text-emerald-700">
              {chatbotMetrics.leadSignalCount}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="font-body text-xs uppercase tracking-wider text-amber-600 mb-1">
              Câu chưa match
            </p>
            <p className="font-heading text-3xl font-extrabold text-amber-700">
              {chatbotMetrics.unmatchedCount}
            </p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
            <p className="font-body text-xs uppercase tracking-wider text-rose-600 mb-1">
              Fallback
            </p>
            <p className="font-heading text-3xl font-extrabold text-rose-700">
              {chatbotMetrics.fallbackCount}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-100 overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <h4 className="font-heading font-bold text-slate-800">Các câu bot còn chưa match tốt</h4>
          </div>
          {chatbotMetrics.recentUnmatched.length === 0 ? (
            <div className="px-4 py-6 text-sm font-body text-slate-400">
              Chưa có câu unmatched nào trong 7 ngày gần nhất.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {chatbotMetrics.recentUnmatched.map((item, index) => (
                <div key={`${item.createdAt}-${index}`} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-body text-slate-400 mb-1">
                    <span>{new Date(item.createdAt).toLocaleString("vi-VN")}</span>
                    {item.service ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
                        {serviceLabels[item.service] || item.service}
                      </span>
                    ) : null}
                    {item.intent ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
                        intent: {item.intent}
                      </span>
                    ) : null}
                  </div>
                  <p className="font-body text-sm text-slate-700">
                    {item.messagePreview || "Không có message preview"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent + Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-heading font-bold text-slate-900">Yêu Cầu Mới Nhất</h3>
            <Link href="/dashboard/contacts" className="font-body text-sm text-red-600 hover:text-red-700 font-bold">Quản lý →</Link>
          </div>
          {recentContacts.length === 0 ? (
            <div className="p-8 text-center"><p className="font-body text-slate-400">Chưa có yêu cầu nào</p></div>
          ) : (
            <div className="divide-y divide-slate-50">
              {recentContacts.map((c) => (
                <div key={c.id} className="px-6 py-3.5 flex items-center gap-3 hover:bg-slate-50/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-body font-semibold text-sm text-slate-800 truncate">{c.name} — {c.phone}</p>
                    <p className="font-body text-xs text-slate-400">{serviceLabels[c.service] || c.service} · {new Date(c.createdAt).toLocaleDateString("vi-VN")}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusConfig[c.status]?.color}`}>
                    {statusConfig[c.status]?.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Manage */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="font-heading font-bold text-slate-900 mb-4">Quản Lý</h3>
          <div className="space-y-3">
            <Link href="/dashboard/contacts" className="flex items-center gap-3 p-3 rounded-xl bg-yellow-50 border border-yellow-100 hover:bg-yellow-100 transition-colors">
              <span className="text-xl">📋</span>
              <div>
                <p className="font-body font-bold text-sm text-slate-800">Xử lý yêu cầu</p>
                <p className="font-body text-xs text-slate-400">Cập nhật trạng thái, gọi khách</p>
              </div>
            </Link>
            <Link href="/tai-khoan" className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors">
              <span className="text-xl">👤</span>
              <div>
                <p className="font-body font-bold text-sm text-slate-800">Tài khoản</p>
                <p className="font-body text-xs text-slate-400">Quản lý thông tin cá nhân</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
