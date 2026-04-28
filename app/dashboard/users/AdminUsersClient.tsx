"use client";

import { useEffect, useMemo, useState } from "react";
import { useNotify } from "@/components/NotifyProvider";
import { formatVietnamDate } from "@/lib/vietnam-time";

interface UserData {
  id: string;
  name: string;
  phone: string;
  role: string;
  loyaltyPoints: number;
  referralCode: string;
  createdAt: string;
  customerOrigin: "WEB_REGISTERED" | "LINKED_OLD_CUSTOMER";
  hasRecentOrder: boolean;
  hasWarranty: boolean;
  recentOrderDate: string | null;
  serviceOrderCount: number;
  totalDebt: number;
  warrantyCount: number;
  _count: { contactRequests: number; reviews: number };
}

type TierKey = "diamond" | "gold" | "silver" | "bronze";
type RoleFilter = "all" | "CUSTOMER" | "ADMIN";
type TierFilter = "all" | TierKey;
type CustomerOriginFilter = "all" | "WEB_REGISTERED" | "LINKED_OLD_CUSTOMER";
type DebtFilter = "all" | "hasDebt" | "noDebt";
type RecentOrderFilter = "all" | "recent" | "noRecent";
type SortMode = "newest" | "points" | "engagement" | "name";
type WarrantyFilter = "all" | "hasWarranty" | "noWarranty";

const USER_PAGE_SIZE = 8;

const getTier = (points: number) => {
  if (points >= 500) return { key: "diamond" as const, label: "💎 Kim Cương", color: "bg-yellow-100 text-yellow-700" };
  if (points >= 200) return { key: "gold" as const, label: "🥇 Vàng", color: "bg-slate-200 text-slate-700" };
  if (points >= 50) return { key: "silver" as const, label: "🥈 Bạc", color: "bg-orange-100 text-orange-700" };
  return { key: "bronze" as const, label: "🥉 Đồng", color: "bg-slate-100 text-slate-500" };
};

function getEngagementScore(user: UserData) {
  return user._count.contactRequests + user._count.reviews;
}

function formatDate(value: string) {
  return formatVietnamDate(value);
}

function formatMoney(value: number) {
  if (!value) return "0đ";
  return `${value.toLocaleString("vi-VN")}đ`;
}

function getOriginLabel(origin: UserData["customerOrigin"]) {
  return origin === "LINKED_OLD_CUSTOMER" ? "Khách cũ nối tài khoản" : "Đăng ký web";
}

function generateTempPassword() {
  const chars = "abcdefghkmnpqrstuvwxyz23456789";
  let code = "";
  for (let index = 0; index < 6; index += 1) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function sanitizeSignedIntegerText(value: string) {
  const sign = value.trimStart().startsWith("-") ? "-" : "";
  return sign + value.replace(/\D/g, "");
}

export default function AdminUsersClient({ initialUsers }: { initialUsers: UserData[] }) {
  const { showToast, showConfirm } = useNotify();
  const [users, setUsers] = useState<UserData[]>(initialUsers);
  const [editingPoints, setEditingPoints] = useState<string | null>(null);
  const [pointsAdd, setPointsAdd] = useState("");
  const [resetPwId, setResetPwId] = useState<string | null>(null);
  const [tempCode, setTempCode] = useState("");
  const [savingPointsId, setSavingPointsId] = useState<string | null>(null);
  const [resettingPointsId, setResettingPointsId] = useState<string | null>(null);
  const [resettingPasswordId, setResettingPasswordId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [originFilter, setOriginFilter] = useState<CustomerOriginFilter>("all");
  const [debtFilter, setDebtFilter] = useState<DebtFilter>("all");
  const [warrantyFilter, setWarrantyFilter] = useState<WarrantyFilter>("all");
  const [recentOrderFilter, setRecentOrderFilter] = useState<RecentOrderFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [page, setPage] = useState(1);
  const [expandedUserIds, setExpandedUserIds] = useState<Set<string>>(new Set());

  const metrics = useMemo(() => {
    const customers = users.filter((user) => user.role !== "ADMIN");
    const totalPoints = customers.reduce((sum, user) => sum + user.loyaltyPoints, 0);
    const engagedCustomers = customers.filter((user) => getEngagementScore(user) > 0).length;
    const vipCustomers = customers.filter((user) => user.loyaltyPoints >= 200).length;
    const debtCustomers = customers.filter((user) => user.totalDebt > 0).length;
    const warrantyCustomers = customers.filter((user) => user.hasWarranty).length;

    return {
      customers: customers.length,
      admins: users.length - customers.length,
      debtCustomers,
      totalPoints,
      engagedCustomers,
      vipCustomers,
      warrantyCustomers,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return users
      .filter((user) => {
        const tier = getTier(user.loyaltyPoints);
        const matchesRole = roleFilter === "all" || user.role === roleFilter;
        const matchesTier = tierFilter === "all" || tier.key === tierFilter;
        const matchesOrigin = originFilter === "all" || user.customerOrigin === originFilter;
        const matchesDebt = debtFilter === "all"
          || (debtFilter === "hasDebt" && user.totalDebt > 0)
          || (debtFilter === "noDebt" && user.totalDebt === 0);
        const matchesWarranty = warrantyFilter === "all"
          || (warrantyFilter === "hasWarranty" && user.hasWarranty)
          || (warrantyFilter === "noWarranty" && !user.hasWarranty);
        const matchesRecentOrder = recentOrderFilter === "all"
          || (recentOrderFilter === "recent" && user.hasRecentOrder)
          || (recentOrderFilter === "noRecent" && !user.hasRecentOrder);
        const matchesSearch = query.length === 0
          || user.name.toLowerCase().includes(query)
          || user.phone.toLowerCase().includes(query)
          || user.referralCode.toLowerCase().includes(query);

        return matchesRole
          && matchesTier
          && matchesOrigin
          && matchesDebt
          && matchesWarranty
          && matchesRecentOrder
          && matchesSearch;
      })
      .sort((first, second) => {
        if (sortMode === "points") return second.loyaltyPoints - first.loyaltyPoints;
        if (sortMode === "engagement") return getEngagementScore(second) - getEngagementScore(first);
        if (sortMode === "name") return first.name.localeCompare(second.name, "vi");
        return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
      });
  }, [debtFilter, originFilter, recentOrderFilter, roleFilter, searchQuery, sortMode, tierFilter, users, warrantyFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / USER_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleUsers = filteredUsers.slice((currentPage - 1) * USER_PAGE_SIZE, currentPage * USER_PAGE_SIZE);

  const resetFilters = () => {
    setSearchQuery("");
    setRoleFilter("all");
    setTierFilter("all");
    setOriginFilter("all");
    setDebtFilter("all");
    setWarrantyFilter("all");
    setRecentOrderFilter("all");
    setSortMode("newest");
    setPage(1);
    setExpandedUserIds(new Set());
  };

  useEffect(() => {
    setPage(1);
    setExpandedUserIds(new Set());
  }, [debtFilter, originFilter, recentOrderFilter, roleFilter, searchQuery, sortMode, tierFilter, warrantyFilter]);

  const toggleUserDetails = (userId: string) => {
    setExpandedUserIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const addPoints = async (userId: string) => {
    const points = parseInt(pointsAdd, 10);
    if (Number.isNaN(points) || points === 0) {
      showToast("Nhập số điểm cần cộng hoặc trừ.", "error");
      return;
    }

    setSavingPointsId(userId);

    try {
      const response = await fetch("/api/admin/loyalty", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, points, reason: "Admin thưởng điểm" }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        showToast(data.message || "Lỗi cập nhật điểm.", "error");
        return;
      }

      setUsers((prev) => prev.map((user) => (
        user.id === userId ? { ...user, loyaltyPoints: data.user.loyaltyPoints } : user
      )));
      setEditingPoints(null);
      setPointsAdd("");
      showToast(`Đã ${points > 0 ? "cộng" : "trừ"} ${Math.abs(points)} điểm.`, "success");
    } catch {
      showToast("Không thể cập nhật điểm lúc này.", "error");
    } finally {
      setSavingPointsId(null);
    }
  };

  const resetPoints = (userId: string, name: string) => {
    showConfirm(`Reset điểm thưởng của ${name} về 0?`, async () => {
      setResettingPointsId(userId);

      try {
        const response = await fetch("/api/admin/loyalty", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, points: 0, reason: "Admin reset điểm", setExact: true }),
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          showToast(data.message || "Chưa reset được điểm.", "error");
          return;
        }

        setUsers((prev) => prev.map((user) => (
          user.id === userId ? { ...user, loyaltyPoints: 0 } : user
        )));
        showToast("Đã reset điểm về 0.", "success");
      } catch {
        showToast("Không thể reset điểm lúc này.", "error");
      } finally {
        setResettingPointsId(null);
      }
    });
  };

  const resetPassword = async (userId: string, name: string) => {
    const code = generateTempPassword();

    showConfirm(`Tạo mật khẩu tạm cho "${name}"?\nMật khẩu tạm sẽ hiện 1 lần, gửi cho khách qua Zalo.`, async () => {
      setResettingPasswordId(userId);

      try {
        const response = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, newPassword: code }),
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          showToast(data.message || "Lỗi.", "error");
          return;
        }

        setResetPwId(userId);
        setTempCode(code);
        showToast("Đã tạo mật khẩu tạm! Gửi cho khách.", "success");
      } catch {
        showToast("Không thể tạo mật khẩu tạm lúc này.", "error");
      } finally {
        setResettingPasswordId(null);
      }
    });
  };

  const deleteUser = (userId: string, name: string) => {
    showConfirm(`Xoá tài khoản "${name}"?\nTất cả dữ liệu (yêu cầu, đánh giá, bảo hành) sẽ bị xoá vĩnh viễn.`, async () => {
      setDeletingUserId(userId);

      try {
        const response = await fetch("/api/admin/users", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          showToast(data.message || "Lỗi xoá.", "error");
          return;
        }

        setUsers((prev) => prev.filter((user) => user.id !== userId));
        showToast("Đã xoá tài khoản.", "success");
      } catch {
        showToast("Không thể xoá tài khoản lúc này.", "error");
      } finally {
        setDeletingUserId(null);
      }
    });
  };

  if (users.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-sm">
        <p className="text-3xl mb-2">👥</p>
        <p className="font-body text-slate-500">Chưa có tài khoản khách hàng nào trong hệ thống.</p>
      </div>
    );
  }

  return (
    <div data-testid="dashboard-users-crm" className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-body text-xs font-bold uppercase tracking-wider text-red-600">Hồ sơ khách hàng</p>
          <h2 className="font-heading font-extrabold text-xl text-slate-900">Khách Hàng & Điểm Thưởng</h2>
          <p className="font-body text-sm text-slate-500">
            {metrics.customers} khách hàng · {metrics.admins} quản trị viên · {metrics.totalPoints} điểm đang lưu hành
          </p>
        </div>
        <button
          onClick={resetFilters}
          className="self-start rounded-xl bg-slate-100 px-4 py-2 text-sm font-body font-bold text-slate-600 transition-colors hover:bg-slate-200 lg:self-auto"
        >
          Xoá bộ lọc
        </button>
      </div>

      <div data-testid="dashboard-users-metrics" className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="font-body text-xs uppercase tracking-wider text-slate-400">Khách hàng</p>
          <p className="mt-1 font-heading text-3xl font-extrabold text-slate-900">{metrics.customers}</p>
        </div>
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
          <p className="font-body text-xs uppercase tracking-wider text-yellow-700">VIP từ hạng vàng</p>
          <p className="mt-1 font-heading text-3xl font-extrabold text-yellow-700">{metrics.vipCustomers}</p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <p className="font-body text-xs uppercase tracking-wider text-blue-700">Có bảo hành</p>
          <p className="mt-1 font-heading text-3xl font-extrabold text-blue-700">{metrics.warrantyCustomers}</p>
        </div>
        <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
          <p className="font-body text-xs uppercase tracking-wider text-red-700">Có nợ</p>
          <p className="mt-1 font-heading text-3xl font-extrabold text-red-700">{metrics.debtCustomers}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="font-body text-xs uppercase tracking-wider text-slate-400">Điểm thưởng</p>
          <p className="mt-1 font-heading text-3xl font-extrabold text-slate-900">{metrics.totalPoints}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
          <input
            data-testid="dashboard-users-search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Tìm theo tên, SĐT, mã giới thiệu"
            className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-sm font-body outline-none transition-colors focus:border-red-400 md:col-span-2 xl:col-span-2"
          />
          <select
            data-testid="dashboard-users-role-filter"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
            title="Lọc vai trò"
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none transition-colors focus:border-red-400"
          >
            <option value="all">Tất cả vai trò</option>
            <option value="CUSTOMER">Khách hàng</option>
            <option value="ADMIN">Quản trị viên</option>
          </select>
          <select
            data-testid="dashboard-users-tier-filter"
            value={tierFilter}
            onChange={(event) => setTierFilter(event.target.value as TierFilter)}
            title="Lọc hạng điểm thưởng"
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none transition-colors focus:border-red-400"
          >
            <option value="all">Tất cả hạng</option>
            <option value="diamond">Kim cương</option>
            <option value="gold">Vàng</option>
            <option value="silver">Bạc</option>
            <option value="bronze">Đồng</option>
          </select>
          <select
            data-testid="dashboard-users-origin-filter"
            value={originFilter}
            onChange={(event) => setOriginFilter(event.target.value as CustomerOriginFilter)}
            title="Lọc nguồn khách"
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none transition-colors focus:border-red-400"
          >
            <option value="all">Tất cả nguồn khách</option>
            <option value="WEB_REGISTERED">Đăng ký web</option>
            <option value="LINKED_OLD_CUSTOMER">Khách cũ đã nối tài khoản</option>
          </select>
          <select
            data-testid="dashboard-users-debt-filter"
            value={debtFilter}
            onChange={(event) => setDebtFilter(event.target.value as DebtFilter)}
            title="Lọc công nợ"
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none transition-colors focus:border-red-400"
          >
            <option value="all">Tất cả công nợ</option>
            <option value="hasDebt">Có nợ</option>
            <option value="noDebt">Không nợ</option>
          </select>
          <select
            data-testid="dashboard-users-warranty-filter"
            value={warrantyFilter}
            onChange={(event) => setWarrantyFilter(event.target.value as WarrantyFilter)}
            title="Lọc bảo hành"
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none transition-colors focus:border-red-400"
          >
            <option value="all">Tất cả bảo hành</option>
            <option value="hasWarranty">Có bảo hành</option>
            <option value="noWarranty">Chưa có bảo hành</option>
          </select>
          <select
            data-testid="dashboard-users-recent-order-filter"
            value={recentOrderFilter}
            onChange={(event) => setRecentOrderFilter(event.target.value as RecentOrderFilter)}
            title="Lọc đơn gần đây"
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none transition-colors focus:border-red-400"
          >
            <option value="all">Tất cả lịch sử đơn</option>
            <option value="recent">Có đơn gần đây</option>
            <option value="noRecent">Chưa có đơn gần đây</option>
          </select>
          <select
            data-testid="dashboard-users-sort"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            title="Sắp xếp khách hàng"
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none transition-colors focus:border-red-400"
          >
            <option value="newest">Mới đăng ký</option>
            <option value="points">Điểm cao nhất</option>
            <option value="engagement">Tương tác nhiều</option>
            <option value="name">Tên A-Z</option>
          </select>
        </div>
        <p data-testid="dashboard-users-result-count" className="mt-3 font-body text-xs text-slate-400">
          Hiển thị {filteredUsers.length} / {users.length} tài khoản
        </p>
      </div>

      <div className="space-y-3 lg:hidden">
        {filteredUsers.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
            <p className="font-body text-sm text-slate-400">Không có tài khoản nào khớp bộ lọc.</p>
          </div>
        ) : (
          visibleUsers.map((user) => {
            const tier = getTier(user.loyaltyPoints);
            const engagementScore = getEngagementScore(user);
            const isBusy = savingPointsId === user.id
              || resettingPointsId === user.id
              || resettingPasswordId === user.id
              || deletingUserId === user.id;
            const isExpanded = expandedUserIds.has(user.id);

            return (
              <div
                key={user.id}
                data-testid="dashboard-user-card"
                className={`rounded-2xl border border-slate-100 bg-white p-3 shadow-sm ${isBusy ? "opacity-70" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">
                    {user.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-body text-sm font-bold text-slate-900">{user.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${user.role === "ADMIN" ? "bg-red-50 text-red-500" : "bg-slate-100 text-slate-500"}`}>
                        {user.role === "ADMIN" ? "Admin" : "Khách"}
                      </span>
                    </div>
                    <p className="font-body text-xs text-slate-500">{user.phone}</p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-slate-50 p-2.5">
                    <p className="font-body text-[10px] font-bold uppercase tracking-wider text-slate-400">Điểm</p>
                    <p className="font-body text-sm font-bold text-slate-900">{user.loyaltyPoints}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2.5">
                    <p className="font-body text-[10px] font-bold uppercase tracking-wider text-slate-400">Đơn</p>
                    <p className="font-body text-sm font-bold text-slate-900">{user.serviceOrderCount}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2.5">
                    <p className="font-body text-[10px] font-bold uppercase tracking-wider text-slate-400">Nợ</p>
                    <p className={`font-body text-sm font-bold ${user.totalDebt > 0 ? "text-red-600" : "text-green-700"}`}>
                      {formatMoney(user.totalDebt)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => toggleUserDetails(user.id)}
                  className="mt-3 flex w-full items-center justify-center rounded-xl bg-slate-100 px-3 py-2.5 font-body text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200"
                >
                  {isExpanded ? "Thu gọn" : "Chi tiết"}
                </button>

                {isExpanded ? (
                  <>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-slate-50 p-2.5">
                    <p className="font-body text-[10px] font-bold uppercase tracking-wider text-slate-400">Hạng</p>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${tier.color}`}>
                      {tier.label}
                    </span>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2.5">
                    <p className="font-body text-[10px] font-bold uppercase tracking-wider text-slate-400">Tương tác</p>
                    <p className="font-body text-sm font-bold text-slate-800">{engagementScore}</p>
                    <p className="font-body text-[10px] text-slate-400">
                      {user._count.contactRequests} YC · {user._count.reviews} review
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2.5">
                    <p className="font-body text-[10px] font-bold uppercase tracking-wider text-slate-400">Tệp khách</p>
                    <p className="font-body text-xs font-semibold text-slate-700">{getOriginLabel(user.customerOrigin)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2.5">
                    <p className="font-body text-[10px] font-bold uppercase tracking-wider text-slate-400">Công nợ</p>
                    <p className={`font-body text-xs font-bold ${user.totalDebt > 0 ? "text-red-600" : "text-green-700"}`}>
                      {formatMoney(user.totalDebt)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2.5">
                    <p className="font-body text-[10px] font-bold uppercase tracking-wider text-slate-400">Bảo hành</p>
                    <p className="font-body text-xs font-semibold text-slate-700">
                      {user.hasWarranty ? `${user.warrantyCount || 1} phiếu` : "Chưa có"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2.5">
                    <p className="font-body text-[10px] font-bold uppercase tracking-wider text-slate-400">Đơn gần đây</p>
                    <p className="font-body text-xs font-semibold text-slate-700">
                      {user.recentOrderDate ? formatDate(user.recentOrderDate) : "Chưa có"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-100 p-3">
                  <p className="mb-2 font-body text-[10px] font-bold uppercase tracking-wider text-slate-400">Điểm thưởng</p>
                  {editingPoints === user.id ? (
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={pointsAdd}
                        onChange={(event) => setPointsAdd(sanitizeSignedIntegerText(event.target.value))}
                        className="min-h-10 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
                        placeholder="+50 hoặc -10"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => addPoints(user.id)}
                        disabled={savingPointsId === user.id}
                        className="rounded-lg bg-green-100 px-3 py-2 text-xs font-bold text-green-700 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        {savingPointsId === user.id ? "..." : "Lưu"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingPoints(null)}
                        disabled={savingPointsId === user.id}
                        className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500 disabled:text-slate-300"
                      >
                        Huỷ
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPoints(user.id);
                        setPointsAdd("");
                      }}
                      className="w-full rounded-lg bg-slate-900 px-3 py-2 text-left font-body text-sm font-bold text-white"
                    >
                      {user.loyaltyPoints} điểm ±
                    </button>
                  )}
                </div>

                {user.role !== "ADMIN" ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => resetPassword(user.id, user.name)}
                      disabled={resettingPasswordId === user.id}
                      className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-600 disabled:bg-slate-100 disabled:text-slate-300"
                    >
                      {resettingPasswordId === user.id ? "..." : "Tạo mật khẩu tạm"}
                    </button>
                    <button
                      type="button"
                      onClick={() => resetPoints(user.id, user.name)}
                      disabled={resettingPointsId === user.id}
                      className="rounded-lg bg-yellow-50 px-3 py-2 text-xs font-bold text-yellow-700 disabled:bg-slate-100 disabled:text-slate-300"
                    >
                      {resettingPointsId === user.id ? "..." : "Reset điểm"}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteUser(user.id, user.name)}
                      disabled={deletingUserId === user.id}
                      className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-500 disabled:bg-slate-100 disabled:text-slate-300"
                    >
                      {deletingUserId === user.id ? "..." : "Xoá tài khoản"}
                    </button>
                  </div>
                ) : null}

                {resetPwId === user.id && tempCode ? (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                    <code className="font-mono text-sm font-bold text-green-700">{tempCode}</code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(tempCode);
                        showToast("Đã sao chép!", "success");
                      }}
                      className="ml-auto text-xs font-bold text-green-700"
                    >
                      Sao chép
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResetPwId(null);
                        setTempCode("");
                      }}
                      className="text-xs font-bold text-slate-400"
                    >
                      Ẩn
                    </button>
                  </div>
                ) : null}
                  </>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm lg:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-left font-body text-xs font-bold uppercase text-slate-500">Tên</th>
                <th className="px-4 py-3 text-left font-body text-xs font-bold uppercase text-slate-500">SĐT</th>
                <th className="px-4 py-3 text-left font-body text-xs font-bold uppercase text-slate-500">Hạng</th>
                <th className="px-4 py-3 text-left font-body text-xs font-bold uppercase text-slate-500">Điểm</th>
                <th className="px-4 py-3 text-left font-body text-xs font-bold uppercase text-slate-500" title="Tổng yêu cầu và đánh giá của khách">
                  Tương tác
                  <span className="block text-[10px] font-semibold normal-case text-slate-400">YC + review</span>
                </th>
                <th className="px-4 py-3 text-left font-body text-xs font-bold uppercase text-slate-500">Tệp khách</th>
                <th className="px-4 py-3 text-left font-body text-xs font-bold uppercase text-slate-500">Công nợ</th>
                <th className="px-4 py-3 text-left font-body text-xs font-bold uppercase text-slate-500">Bảo hành</th>
                <th className="px-4 py-3 text-left font-body text-xs font-bold uppercase text-slate-500">Đơn gần đây</th>
                <th className="px-4 py-3 text-left font-body text-xs font-bold uppercase text-slate-500">Mã GT</th>
                <th className="px-4 py-3 text-left font-body text-xs font-bold uppercase text-slate-500">Ngày ĐK</th>
                <th className="px-4 py-3 text-left font-body text-xs font-bold uppercase text-slate-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center font-body text-sm text-slate-400">
                    Không có tài khoản nào khớp bộ lọc.
                  </td>
                </tr>
              ) : (
                visibleUsers.map((user) => {
                  const tier = getTier(user.loyaltyPoints);
                  const engagementScore = getEngagementScore(user);
                  const isBusy = savingPointsId === user.id
                    || resettingPointsId === user.id
                    || resettingPasswordId === user.id
                    || deletingUserId === user.id;

                  return (
                    <tr
                      key={user.id}
                      data-testid="dashboard-user-row"
                      className={`transition-colors ${isBusy ? "bg-slate-50/70" : "hover:bg-slate-50/50"}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <span className="block font-body font-semibold text-slate-800">{user.name}</span>
                            <span className={`text-[10px] font-bold ${user.role === "ADMIN" ? "text-red-500" : "text-slate-400"}`}>
                              {user.role === "ADMIN" ? "Admin" : "Khách"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-body text-xs text-slate-600">{user.phone}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tier.color}`}>{tier.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        {editingPoints === user.id ? (
                          <div className="flex gap-1">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={pointsAdd}
                              onChange={(event) => setPointsAdd(sanitizeSignedIntegerText(event.target.value))}
                              className="min-h-9 w-24 rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none"
                              placeholder="+50"
                              autoFocus
                            />
                            <button
                              onClick={() => addPoints(user.id)}
                              disabled={savingPointsId === user.id}
                              className="rounded-lg bg-green-100 px-2 py-1 text-[10px] font-bold text-green-700 disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              {savingPointsId === user.id ? "..." : "✓"}
                            </button>
                            <button
                              onClick={() => setEditingPoints(null)}
                              disabled={savingPointsId === user.id}
                              className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 disabled:text-slate-300"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingPoints(user.id);
                              setPointsAdd("");
                            }}
                            className="font-body text-xs font-bold text-slate-800 transition-colors hover:text-red-600"
                          >
                            {user.loyaltyPoints} <span className="text-[10px] text-slate-400">±</span>
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 font-body text-xs text-slate-600">
                        {engagementScore} <span className="text-slate-300">({user._count.contactRequests} YC · {user._count.reviews} review)</span>
                      </td>
                      <td className="px-4 py-3 font-body text-xs font-semibold text-slate-600">
                        {getOriginLabel(user.customerOrigin)}
                      </td>
                      <td className={`px-4 py-3 font-body text-xs font-bold ${user.totalDebt > 0 ? "text-red-600" : "text-green-700"}`}>
                        {formatMoney(user.totalDebt)}
                      </td>
                      <td className="px-4 py-3 font-body text-xs text-slate-600">
                        {user.hasWarranty ? `${user.warrantyCount || 1} phiếu` : "Chưa có"}
                      </td>
                      <td className="px-4 py-3 font-body text-xs text-slate-600">
                        {user.recentOrderDate ? formatDate(user.recentOrderDate) : "Chưa có"}
                      </td>
                      <td className="px-4 py-3">
                        <code className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                          {user.referralCode || "—"}
                        </code>
                      </td>
                      <td className="px-4 py-3 font-body text-[10px] text-slate-400">{formatDate(user.createdAt)}</td>
                      <td className="px-4 py-3">
                        {user.role !== "ADMIN" && (
                          <div className="space-y-1">
                            <div className="flex gap-1">
                              <button
                                onClick={() => resetPassword(user.id, user.name)}
                                disabled={resettingPasswordId === user.id}
                                title="Tạo mật khẩu tạm"
                                className="rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-500 hover:bg-blue-100 disabled:bg-slate-100 disabled:text-slate-300"
                              >
                                {resettingPasswordId === user.id ? "..." : "Tạo mật khẩu"}
                              </button>
                              <button
                                onClick={() => resetPoints(user.id, user.name)}
                                disabled={resettingPointsId === user.id}
                                title="Reset điểm"
                                className="rounded-lg bg-yellow-50 px-2 py-1 text-[10px] font-bold text-yellow-600 hover:bg-yellow-100 disabled:bg-slate-100 disabled:text-slate-300"
                              >
                                {resettingPointsId === user.id ? "..." : "🔄"}
                              </button>
                              <button
                                onClick={() => deleteUser(user.id, user.name)}
                                disabled={deletingUserId === user.id}
                                title="Xoá tài khoản"
                                className="rounded-lg bg-red-50 px-2 py-1 text-[10px] font-bold text-red-500 hover:bg-red-100 disabled:bg-slate-100 disabled:text-slate-300"
                              >
                                {deletingUserId === user.id ? "..." : "🗑️"}
                              </button>
                            </div>
                            {resetPwId === user.id && tempCode && (
                              <div className="flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2 py-1">
                                <code className="font-mono text-xs font-bold text-green-700">{tempCode}</code>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(tempCode);
                                    showToast("Đã sao chép!", "success");
                                  }}
                                  className="ml-auto text-[9px] font-bold text-green-600 hover:text-green-800"
                                >
                                  📋
                                </button>
                                <button
                                  onClick={() => {
                                    setResetPwId(null);
                                    setTempCode("");
                                  }}
                                  className="text-[9px] font-bold text-slate-400 hover:text-slate-600"
                                >
                                  ✕
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {filteredUsers.length > USER_PAGE_SIZE ? (
        <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:flex-row">
          <p className="font-body text-sm font-semibold text-slate-500">
            Trang {currentPage} / {pageCount}
          </p>
          <div className="flex w-full gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={currentPage === 1}
              className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-body font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-300 sm:flex-none"
            >
              Trước
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              disabled={currentPage === pageCount}
              className="min-h-11 flex-1 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-body font-bold text-white transition-colors hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 sm:flex-none"
            >
              Tiếp
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
