import { getChatbotDashboardMetrics } from "@/lib/chatbot-metrics";
import { getLeadSourceLabel } from "@/lib/lead-sources";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

const OPEN_STATUSES = ["PENDING", "CONTACTED", "IN_PROGRESS"] as const;
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const serviceLabels: Record<string, string> = {
  DONG_PIN: "🔋 Đóng pin",
  DEN_NLMT: "☀️ Đèn năng lượng mặt trời",
  PIN_LUU_TRU: "⚡ Pin lưu trữ",
  CAMERA: "📹 Camera",
  CUSTOM: "🔧 Theo yêu cầu",
  KHAC: "📞 Khác",
  battery: "🔋 Đóng pin",
  camera: "📹 Camera",
  contact: "📞 Liên hệ",
};

const chatbotIntentLabels: Record<string, string> = {
  contact: "Muốn liên hệ",
  faq: "Câu hỏi thường gặp",
  general: "Câu hỏi chung",
  greeting: "Chào hỏi",
  open_question: "Câu hỏi mở",
  quote: "Hỏi báo giá",
};

const statusConfig: Record<string, { label: string; color: string; bar: string }> = {
  PENDING: { label: "Chờ xử lý", color: "bg-yellow-100 text-yellow-700", bar: "bg-yellow-500" },
  CONTACTED: { label: "Đã liên hệ", color: "bg-blue-100 text-blue-700", bar: "bg-blue-500" },
  IN_PROGRESS: { label: "Đang xử lý", color: "bg-orange-100 text-orange-700", bar: "bg-orange-500" },
  COMPLETED: { label: "Hoàn thành", color: "bg-green-100 text-green-700", bar: "bg-green-500" },
  CANCELLED: { label: "Đã huỷ", color: "bg-red-100 text-red-700", bar: "bg-red-500" },
};

function getPercent(value: number, total: number) {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

function formatDate(value: Date) {
  return value.toLocaleDateString("vi-VN");
}

function getChatbotIntentLabel(intent: string | null) {
  if (!intent) return null;
  return chatbotIntentLabels[intent] || "Nhóm câu hỏi khác";
}

function getVietnamDayRange(now: Date) {
  const vietnamNow = new Date(now.getTime() + VIETNAM_OFFSET_MS);
  const vietnamDayStartUtc = Date.UTC(
    vietnamNow.getUTCFullYear(),
    vietnamNow.getUTCMonth(),
    vietnamNow.getUTCDate()
  ) - VIETNAM_OFFSET_MS;

  return {
    start: new Date(vietnamDayStartUtc),
    end: new Date(vietnamDayStartUtc + DAY_MS),
  };
}

export default async function DashboardPage() {
  const now = new Date();
  const todayRange = getVietnamDayRange(now);
  const staleCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const warrantySoonCutoff = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const activeContactWhere = { deletedAt: null };

  const [
    totalContacts,
    pendingContacts,
    contactedContacts,
    inProgressContacts,
    completedContacts,
    cancelledContacts,
    newContactsToday,
    newUsersToday,
    staleContacts,
    totalUsers,
    pendingReviews,
    activeWarranties,
    expiringWarranties,
    activeCoupons,
    activePricingItems,
    recentContacts,
    serviceGroups,
    sourceGroups,
    chatbotMetrics,
  ] = await Promise.all([
    prisma.contactRequest.count({ where: activeContactWhere }),
    prisma.contactRequest.count({ where: { ...activeContactWhere, status: "PENDING" } }),
    prisma.contactRequest.count({ where: { ...activeContactWhere, status: "CONTACTED" } }),
    prisma.contactRequest.count({ where: { ...activeContactWhere, status: "IN_PROGRESS" } }),
    prisma.contactRequest.count({ where: { ...activeContactWhere, status: "COMPLETED" } }),
    prisma.contactRequest.count({ where: { ...activeContactWhere, status: "CANCELLED" } }),
    prisma.contactRequest.count({
      where: { ...activeContactWhere, createdAt: { gte: todayRange.start, lt: todayRange.end } },
    }),
    prisma.user.count({
      where: {
        role: "CUSTOMER",
        deletedAt: null,
        createdAt: { gte: todayRange.start, lt: todayRange.end },
      },
    }),
    prisma.contactRequest.count({
      where: {
        ...activeContactWhere,
        status: { in: [...OPEN_STATUSES] },
        createdAt: { lt: staleCutoff },
      },
    }),
    prisma.user.count({ where: { role: "CUSTOMER", deletedAt: null } }),
    prisma.review.count({ where: { deletedAt: null, approved: false } }),
    prisma.warranty.count({ where: { deletedAt: null, endDate: { gte: now } } }),
    prisma.warranty.count({
      where: { deletedAt: null, endDate: { gte: now, lte: warrantySoonCutoff } },
    }),
    prisma.coupon.count({ where: { active: true } }),
    prisma.pricingItem.count({ where: { active: true } }),
    prisma.contactRequest.findMany({
      where: activeContactWhere,
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.contactRequest.groupBy({
      by: ["service"],
      where: activeContactWhere,
      _count: { _all: true },
    }),
    prisma.contactRequest.groupBy({
      by: ["source"],
      where: { ...activeContactWhere, source: { not: null } },
      _count: { _all: true },
    }),
    getChatbotDashboardMetrics(),
  ]);

  const openContacts = pendingContacts + contactedContacts + inProgressContacts;
  const completionRate = getPercent(completedContacts, totalContacts);
  const chatbotReviewCount = chatbotMetrics.unmatchedCount + chatbotMetrics.fallbackCount;
  const chatbotReviewRate = getPercent(chatbotReviewCount, chatbotMetrics.totalChatsMeasured);

  const pipelineStages = [
    { key: "PENDING", count: pendingContacts },
    { key: "CONTACTED", count: contactedContacts },
    { key: "IN_PROGRESS", count: inProgressContacts },
    { key: "COMPLETED", count: completedContacts },
    { key: "CANCELLED", count: cancelledContacts },
  ];

  const topServices = serviceGroups
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 4);

  const topSources = sourceGroups
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 4);

  return (
    <div data-testid="dashboard-page" className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-body text-xs font-bold uppercase tracking-wider text-red-600">
            Bảng điều hành
          </p>
          <h2 className="font-heading font-extrabold text-2xl text-slate-900 mb-1">
            Tổng Quan Chăm Sóc Khách
          </h2>
          <p className="font-body text-sm text-slate-500">
            Theo dõi khách cần tư vấn, chăm sóc khách, bảo hành và các việc cần xử lý trong ngày.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/contacts"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-body font-bold text-white transition-colors hover:bg-slate-800"
          >
            Mở danh sách khách
          </Link>
          <Link
            href="/dashboard/pricing"
            className="rounded-xl bg-white px-4 py-2 text-sm font-body font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
          >
            Cập nhật bảng giá
          </Link>
        </div>
      </div>

      <div data-testid="dashboard-crm-overview" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <p className="font-body text-xs text-slate-400 uppercase tracking-wider mb-1">Khách mới hôm nay</p>
          <p className="font-heading font-extrabold text-3xl text-slate-900">{newUsersToday}</p>
          <p className="mt-1 font-body text-xs text-slate-400">
            Tài khoản khách mới · {newContactsToday} yêu cầu mới
          </p>
        </div>
        <div className="bg-yellow-50 rounded-2xl p-5 border border-yellow-200">
          <p className="font-body text-xs text-yellow-700 uppercase tracking-wider mb-1">Khách đang chờ xử lý</p>
          <p className="font-heading font-extrabold text-3xl text-yellow-700">{openContacts}</p>
          <p className="mt-1 font-body text-xs text-yellow-700">{staleContacts} khách quá 48 giờ chưa xong</p>
        </div>
        <div className="bg-green-50 rounded-2xl p-5 border border-green-200">
          <p className="font-body text-xs text-green-700 uppercase tracking-wider mb-1">Tỉ lệ chốt</p>
          <p className="font-heading font-extrabold text-3xl text-green-700">{completionRate}%</p>
          <p className="mt-1 font-body text-xs text-green-700">{completedContacts} hoàn thành</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <p className="font-body text-xs text-slate-400 uppercase tracking-wider mb-1">Khách hàng</p>
          <p className="font-heading font-extrabold text-3xl text-slate-900">{totalUsers}</p>
          <p className="mt-1 font-body text-xs text-slate-400">{activeWarranties} bảo hành còn hiệu lực</p>
        </div>
      </div>

      <div data-testid="dashboard-action-queue" className="grid gap-4 lg:grid-cols-4">
        <Link href="/dashboard/contacts" className="rounded-2xl border border-red-100 bg-red-50 p-5 transition-colors hover:bg-red-100">
          <p className="font-body text-xs font-bold uppercase tracking-wider text-red-700">Cần gọi lại</p>
          <p className="mt-1 font-heading text-2xl font-extrabold text-red-700">{pendingContacts}</p>
          <p className="mt-1 font-body text-xs text-red-700">Khách đang chờ tư vấn</p>
        </Link>
        <Link href="/dashboard/reviews" className="rounded-2xl border border-amber-100 bg-amber-50 p-5 transition-colors hover:bg-amber-100">
          <p className="font-body text-xs font-bold uppercase tracking-wider text-amber-700">Đánh giá chờ duyệt</p>
          <p className="mt-1 font-heading text-2xl font-extrabold text-amber-700">{pendingReviews}</p>
          <p className="mt-1 font-body text-xs text-amber-700">Phản hồi khách hàng mới</p>
        </Link>
        <Link href="/dashboard/warranty" className="rounded-2xl border border-blue-100 bg-blue-50 p-5 transition-colors hover:bg-blue-100">
          <p className="font-body text-xs font-bold uppercase tracking-wider text-blue-700">Sắp hết bảo hành</p>
          <p className="mt-1 font-heading text-2xl font-extrabold text-blue-700">{expiringWarranties}</p>
          <p className="mt-1 font-body text-xs text-blue-700">Trong 30 ngày tới</p>
        </Link>
        <Link href="/dashboard/coupons" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-colors hover:bg-slate-50">
          <p className="font-body text-xs font-bold uppercase tracking-wider text-slate-400">Mã giảm giá</p>
          <p className="mt-1 font-heading text-2xl font-extrabold text-slate-900">{activeCoupons}</p>
          <p className="mt-1 font-body text-xs text-slate-500">{activePricingItems} mục giá đang bật</p>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h3 className="font-heading font-bold text-slate-900">Tiến Độ Xử Lý Khách</h3>
              <p className="font-body text-sm text-slate-500">Khách đang ở bước nào trong quy trình tư vấn và chăm sóc.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-body font-bold text-slate-500">
              {openContacts} đang cần theo dõi
            </span>
          </div>
          <div className="space-y-3">
            {pipelineStages.map((stage) => {
              const config = statusConfig[stage.key];
              return (
                <div key={stage.key}>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="font-body text-xs font-bold text-slate-600">{config.label}</span>
                    <span className="font-body text-xs text-slate-400">
                      {stage.count} · {getPercent(stage.count, totalContacts)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className={`h-2 rounded-full ${config.bar}`}
                      style={{ width: `${getPercent(stage.count, totalContacts)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-2 grid gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <h3 className="font-heading font-bold text-slate-900 mb-3">Dịch Vụ Được Hỏi Nhiều</h3>
            {topServices.length === 0 ? (
              <p className="font-body text-sm text-slate-400">Chưa có dữ liệu dịch vụ.</p>
            ) : (
              <div className="space-y-2">
                {topServices.map((item) => (
                  <div key={item.service} className="flex items-center justify-between gap-3">
                    <span className="font-body text-sm font-semibold text-slate-700">
                      {serviceLabels[item.service] || item.service}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-body font-bold text-slate-500">
                      {item._count._all}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <h3 className="font-heading font-bold text-slate-900 mb-3">Nguồn Khách Liên Hệ Nổi Bật</h3>
            {topSources.length === 0 ? (
              <p className="font-body text-sm text-slate-400">Chưa có dữ liệu nguồn khách liên hệ.</p>
            ) : (
              <div className="space-y-2">
                {topSources.map((item) => (
                  <div key={item.source || "unknown"} className="flex items-center justify-between gap-3">
                    <span className="truncate font-body text-sm font-semibold text-slate-700">
                      {getLeadSourceLabel(item.source)}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-body font-bold text-slate-500">
                      {item._count._all}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        data-testid="dashboard-chatbot-health"
        className="scroll-mt-28 bg-white rounded-2xl p-4 shadow-sm border border-slate-100 sm:p-6"
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="font-heading text-lg font-bold text-slate-900 sm:text-base">
              Hiệu Quả Chatbot Tư Vấn
            </h3>
            <p className="mt-1 font-body text-sm leading-relaxed text-slate-500">
              Mục này dùng để biết 7 ngày qua chatbot có tạo được khách cần tư vấn không và câu nào cần bổ sung câu trả lời.
            </p>
          </div>
          <div className="inline-flex shrink-0 items-center justify-center self-start whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-body font-semibold text-slate-600">
            Cần xem lại: {chatbotReviewRate}%
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="mb-1 font-body text-xs uppercase text-slate-400">
              Lượt phản hồi
            </p>
            <p className="font-heading text-3xl font-extrabold text-slate-900">
              {chatbotMetrics.totalChatsMeasured}
            </p>
            <p className="mt-1 font-body text-xs leading-relaxed text-slate-500">Số câu chatbot đã xử lý trong 7 ngày.</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="mb-1 font-body text-xs uppercase text-emerald-600">
              Khách có nhu cầu
            </p>
            <p className="font-heading text-3xl font-extrabold text-emerald-700">
              {chatbotMetrics.leadSignalCount}
            </p>
            <p className="mt-1 font-body text-xs leading-relaxed text-emerald-700">Có tín hiệu tư vấn, báo giá hoặc để lại thông tin.</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="mb-1 font-body text-xs uppercase text-amber-600">
              Câu cần bổ sung
            </p>
            <p className="font-heading text-3xl font-extrabold text-amber-700">
              {chatbotMetrics.unmatchedCount}
            </p>
            <p className="mt-1 font-body text-xs leading-relaxed text-amber-700">Câu còn thiếu dữ liệu huấn luyện rõ ràng.</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="mb-1 font-body text-xs uppercase text-rose-600">
              Trả lời tạm
            </p>
            <p className="font-heading text-3xl font-extrabold text-rose-700">
              {chatbotMetrics.fallbackCount}
            </p>
            <p className="mt-1 font-body text-xs leading-relaxed text-rose-700">Bot phải dùng câu dự phòng thay vì AI chuẩn.</p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-100 overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <h4 className="font-heading text-sm font-bold text-slate-800 sm:text-base">
              Câu Khách Hỏi Cần Bổ Sung Câu Trả Lời
            </h4>
          </div>
          {chatbotMetrics.recentUnmatched.length === 0 ? (
            <div className="px-4 py-6 text-sm font-body text-slate-400">
              Chưa có câu nào cần bổ sung trong 7 ngày gần nhất.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {chatbotMetrics.recentUnmatched.map((item, index) => (
                <div key={`${item.createdAt}-${index}`} className="px-4 py-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-body text-slate-400">
                    <span>{new Date(item.createdAt).toLocaleString("vi-VN")}</span>
                    {item.eventType === "fallback" ? (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-600">
                        Trả lời tạm
                      </span>
                    ) : null}
                    {item.service ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
                        {serviceLabels[item.service] || item.service}
                      </span>
                    ) : null}
                    {item.intent ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
                        Nhóm câu hỏi: {getChatbotIntentLabel(item.intent)}
                      </span>
                    ) : null}
                  </div>
                  <p className="break-words font-body text-sm leading-relaxed text-slate-700">
                    {item.messagePreview || "Không có nội dung xem trước"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-heading font-bold text-slate-900">Khách Mới Liên Hệ</h3>
            <Link href="/dashboard/contacts" className="font-body text-sm text-red-600 hover:text-red-700 font-bold">
              Quản lý →
            </Link>
          </div>
          {recentContacts.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-body text-slate-400">Chưa có yêu cầu nào</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {recentContacts.map((contact) => (
                <div key={contact.id} className="px-6 py-3.5 flex items-center gap-3 hover:bg-slate-50/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-body font-semibold text-sm text-slate-800 truncate">
                      {contact.name} — {contact.phone}
                    </p>
                    <p className="font-body text-xs text-slate-400">
                      {serviceLabels[contact.service] || contact.service} · {formatDate(contact.createdAt)}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusConfig[contact.status]?.color}`}>
                    {statusConfig[contact.status]?.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="font-heading font-bold text-slate-900 mb-4">Lối Tắt Quản Trị</h3>
          <div className="space-y-3">
            {[
              { href: "/dashboard/contacts", title: "Xử lý yêu cầu", helper: "Tiến độ, ghi chú, nguồn khách biết đến" },
              { href: "/dashboard/users", title: "Khách hàng", helper: "Điểm thưởng, tài khoản, giới thiệu bạn bè" },
              { href: "/dashboard/warranty", title: "Bảo hành", helper: "Tra mã bảo hành, phiếu sắp hết hạn" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-xl border border-slate-100 bg-slate-50 p-3 transition-colors hover:bg-slate-100"
              >
                <p className="font-body font-bold text-sm text-slate-800">{item.title}</p>
                <p className="font-body text-xs text-slate-400">{item.helper}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
