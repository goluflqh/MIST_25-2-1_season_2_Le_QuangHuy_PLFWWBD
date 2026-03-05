import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function DashboardPage() {
  const [totalContacts, pendingContacts, contactedContacts, inProgressContacts, completedContacts, cancelledContacts, totalUsers, recentContacts] = await Promise.all([
    prisma.contactRequest.count(),
    prisma.contactRequest.count({ where: { status: "PENDING" } }),
    prisma.contactRequest.count({ where: { status: "CONTACTED" } }),
    prisma.contactRequest.count({ where: { status: "IN_PROGRESS" } }),
    prisma.contactRequest.count({ where: { status: "COMPLETED" } }),
    prisma.contactRequest.count({ where: { status: "CANCELLED" } }),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.contactRequest.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
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
