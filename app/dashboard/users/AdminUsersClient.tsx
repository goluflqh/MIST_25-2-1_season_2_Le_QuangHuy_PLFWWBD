"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useNotify } from "@/components/NotifyProvider";
import PaginationControls from "@/components/PaginationControls";
import { formatVietnamDate } from "@/lib/vietnam-time";

interface HistoryCounts {
  customerProfiles: number;
  contactRequests: number;
  serviceOrders: number;
  warranties: number;
  total: number;
}

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
  unlinkedHistory: HistoryCounts;
  _count: { contactRequests: number; reviews: number };
}

interface HistoryLinkNotice {
  tone: "success" | "warning" | "error";
  message: string;
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
  if (points >= 500) return { key: "diamond" as const, label: "Kim cương", color: "bg-yellow-100 text-yellow-700" };
  if (points >= 200) return { key: "gold" as const, label: "Vàng", color: "bg-slate-200 text-slate-700" };
  if (points >= 50) return { key: "silver" as const, label: "Bạc", color: "bg-orange-100 text-orange-700" };
  return { key: "bronze" as const, label: "Đồng", color: "bg-slate-100 text-slate-500" };
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

function formatHistoryBreakdown(counts: HistoryCounts) {
  return [
    [counts.customerProfiles, "hồ sơ khách hàng"],
    [counts.contactRequests, "yêu cầu tư vấn"],
    [counts.serviceOrders, "đơn dịch vụ"],
    [counts.warranties, "phiếu bảo hành"],
  ]
    .filter(([count]) => Number(count) > 0)
    .map(([count, label]) => `${count} ${label}`)
    .join(" · ");
}

function linkHistoryActionLabel(total: number) {
  return `Nối ${total} mục lịch sử cũ vào tài khoản`;
}

function sanitizeSignedIntegerText(value: string) {
  const sign = value.trimStart().startsWith("-") ? "-" : "";
  return sign + value.replace(/\D/g, "");
}

export default function AdminUsersClient({ initialUsers }: { initialUsers: UserData[] }) {
  const router = useRouter();
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
  const [linkingHistoryUserId, setLinkingHistoryUserId] = useState<string | null>(null);
  const [historyLinkNotices, setHistoryLinkNotices] = useState<Record<string, HistoryLinkNotice>>({});
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
    setUsers(initialUsers);
  }, [initialUsers]);

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
    showConfirm(`Đặt toàn bộ điểm thưởng của "${name}" về 0?`, async () => {
      setResettingPointsId(userId);

      try {
        const response = await fetch("/api/admin/loyalty", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, points: 0, reason: "Admin reset điểm", setExact: true }),
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          showToast(data.message || "Chưa đặt được điểm về 0.", "error");
          return;
        }

        setUsers((prev) => prev.map((user) => (
          user.id === userId ? { ...user, loyaltyPoints: 0 } : user
        )));
        showToast("Đã đặt điểm thưởng về 0.", "success");
      } catch {
        showToast("Không thể đặt điểm về 0 lúc này.", "error");
      } finally {
        setResettingPointsId(null);
      }
    }, {
      title: "Đặt điểm thưởng về 0",
      confirmLabel: "Đặt về 0",
      tone: "warning",
    });
  };

  const resetPassword = (userId: string, name: string) => {
    showConfirm(`Cấp mật khẩu tạm mới cho "${name}"?\n\nKhách sẽ bị đăng xuất trên các thiết bị đang dùng. Mật khẩu tạm chỉ hiển thị một lần để bạn sao chép và gửi riêng cho khách.`, async () => {
      setResettingPasswordId(userId);

      try {
        const response = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          showToast(data.message || "Lỗi.", "error");
          return;
        }

        if (typeof data.temporaryPassword !== "string" || !data.temporaryPassword) {
          showToast("Mật khẩu đã được đổi nhưng không thể hiển thị mã tạm. Vui lòng cấp lại một lần nữa.", "error");
          return;
        }

        setResetPwId(userId);
        setTempCode(data.temporaryPassword);
        showToast("Đã cấp mật khẩu tạm. Hãy sao chép và gửi riêng cho khách.", "success");
      } catch {
        showToast("Không thể cấp lại mật khẩu lúc này.", "error");
      } finally {
        setResettingPasswordId(null);
      }
    }, {
      title: "Cấp lại mật khẩu",
      confirmLabel: "Cấp mật khẩu tạm",
      tone: "warning",
    });
  };

  const deleteUser = (userId: string, name: string) => {
    showConfirm(`Xoá vĩnh viễn tài khoản "${name}"?\n\nTài khoản, yêu cầu tư vấn, đánh giá và phiếu bảo hành liên quan sẽ bị xoá và không thể khôi phục. Hồ sơ khách hàng và đơn dịch vụ vẫn được giữ lại trong hệ thống.`, async () => {
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
    }, {
      title: "Xoá tài khoản khách hàng",
      confirmLabel: "Xoá vĩnh viễn",
      tone: "destructive",
    });
  };

  const linkCustomerHistory = (user: UserData) => {
    const breakdown = formatHistoryBreakdown(user.unlinkedHistory);
    showConfirm(
      `Nối lịch sử cũ tìm thấy theo SĐT ${user.phone} vào tài khoản "${user.name}"?\n\n${breakdown}.\n\nChỉ tiếp tục sau khi đã xác nhận số điện thoại với khách. Những mục đã thuộc tài khoản khác sẽ được giữ nguyên.`,
      async () => {
        setLinkingHistoryUserId(user.id);
        setHistoryLinkNotices((current) => {
          const next = { ...current };
          delete next[user.id];
          return next;
        });

        try {
          const response = await fetch("/api/admin/users/link-history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user.id }),
          });
          const data = await response.json();
          const conflictCount = typeof data.conflicts?.total === "number" ? data.conflicts.total : 0;
          const remainingUnlinked = data.remainingUnlinked as HistoryCounts | undefined;

          if (!response.ok || !data.success) {
            const message = data.message || "Chưa ghép được lịch sử khách hàng.";
            setHistoryLinkNotices((current) => ({
              ...current,
              [user.id]: { tone: "error", message },
            }));
            showToast(message, "error");
            return;
          }

          const message = conflictCount > 0
            ? `${data.message} ${conflictCount} mục đã thuộc tài khoản khác nên được giữ nguyên.`
            : data.message;
          setHistoryLinkNotices((current) => ({
            ...current,
            [user.id]: { tone: conflictCount > 0 ? "warning" : "success", message },
          }));
          setUsers((current) => current.map((item) => (
            item.id === user.id && remainingUnlinked
              ? { ...item, unlinkedHistory: remainingUnlinked }
              : item
          )));
          showToast(message, conflictCount > 0 ? "warning" : "success");
          router.refresh();
        } catch {
          const message = "Không thể ghép lịch sử khách hàng lúc này.";
          setHistoryLinkNotices((current) => ({
            ...current,
            [user.id]: { tone: "error", message },
          }));
          showToast(message, "error");
        } finally {
          setLinkingHistoryUserId(null);
        }
      },
      {
        title: "Nối lịch sử cũ vào tài khoản",
        confirmLabel: "Nối vào tài khoản",
        tone: "warning",
      },
    );
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
              || deletingUserId === user.id
              || linkingHistoryUserId === user.id;
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
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {user.unlinkedHistory.total > 0 ? (
                      <button
                        type="button"
                        data-testid="dashboard-link-history-mobile"
                        onClick={() => linkCustomerHistory(user)}
                        disabled={linkingHistoryUserId === user.id}
                        className="col-span-2 min-h-11 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-100 disabled:border-slate-100 disabled:bg-slate-100 disabled:text-slate-300"
                      >
                        {linkingHistoryUserId === user.id
                          ? "Đang nối lịch sử..."
                          : linkHistoryActionLabel(user.unlinkedHistory.total)}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => resetPassword(user.id, user.name)}
                      disabled={resettingPasswordId === user.id}
                      className="min-h-11 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100 disabled:border-slate-100 disabled:bg-slate-100 disabled:text-slate-300"
                    >
                      {resettingPasswordId === user.id ? "Đang cấp..." : "Cấp lại mật khẩu"}
                    </button>
                    <button
                      type="button"
                      onClick={() => resetPoints(user.id, user.name)}
                      disabled={resettingPointsId === user.id}
                      className="min-h-11 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-50 disabled:border-slate-100 disabled:bg-slate-100 disabled:text-slate-300"
                    >
                      {resettingPointsId === user.id ? "Đang đặt..." : "Đặt điểm về 0"}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteUser(user.id, user.name)}
                      disabled={deletingUserId === user.id}
                      className="col-span-2 min-h-11 rounded-lg border border-red-100 bg-white px-3 py-2 text-xs font-bold text-red-700 transition-colors hover:bg-red-50 disabled:border-slate-100 disabled:bg-slate-100 disabled:text-slate-300"
                    >
                      {deletingUserId === user.id ? "Đang xoá..." : "Xoá tài khoản"}
                    </button>
                  </div>
                ) : null}

                {historyLinkNotices[user.id] ? (
                  <p
                    role={historyLinkNotices[user.id].tone === "error" ? "alert" : "status"}
                    className={`mt-3 rounded-lg border px-3 py-2 font-body text-xs ${
                      historyLinkNotices[user.id].tone === "error"
                        ? "border-red-200 bg-red-50 text-red-800"
                        : historyLinkNotices[user.id].tone === "warning"
                          ? "border-amber-200 bg-amber-50 text-amber-800"
                          : "border-emerald-200 bg-emerald-50 text-emerald-800"
                    }`}
                  >
                    {historyLinkNotices[user.id].message}
                  </p>
                ) : null}

                {resetPwId === user.id && tempCode ? (
                  <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
                    <p className="mb-1 font-body text-[10px] font-bold uppercase tracking-wide text-green-800">
                      Mật khẩu tạm · chỉ hiện lần này
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-sm font-bold text-green-800">{tempCode}</code>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(tempCode);
                          showToast("Đã sao chép!", "success");
                        }}
                        className="ml-auto rounded-md bg-green-700 px-2.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-green-800"
                      >
                        Sao chép
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setResetPwId(null);
                          setTempCode("");
                        }}
                        className="rounded-md px-2 py-1.5 text-xs font-bold text-slate-500 transition-colors hover:bg-green-100 hover:text-slate-700"
                      >
                        Đóng
                      </button>
                    </div>
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
          <table className="min-w-[920px] w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="min-w-72 px-4 py-3 text-left font-body text-xs font-bold uppercase text-slate-500">
                  Khách hàng
                  <span className="block text-[10px] font-semibold normal-case text-slate-400">Liên hệ · hồ sơ</span>
                </th>
                <th className="min-w-40 px-4 py-3 text-left font-body text-xs font-bold uppercase text-slate-500">Điểm & hạng</th>
                <th className="min-w-52 px-4 py-3 text-left font-body text-xs font-bold uppercase text-slate-500">Lịch sử</th>
                <th className="min-w-32 px-4 py-3 text-left font-body text-xs font-bold uppercase text-slate-500">Công nợ</th>
                <th className="sticky right-0 z-10 min-w-52 bg-slate-50 px-4 py-3 text-left font-body text-xs font-bold uppercase text-slate-500 shadow-[-12px_0_18px_-18px_rgba(15,23,42,0.45)]">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center font-body text-sm text-slate-400">
                    Không có tài khoản nào khớp bộ lọc.
                  </td>
                </tr>
              ) : (
                visibleUsers.map((user, rowIndex) => {
                  const tier = getTier(user.loyaltyPoints);
                  const engagementScore = getEngagementScore(user);
                  const isBusy = savingPointsId === user.id
                    || resettingPointsId === user.id
                    || resettingPasswordId === user.id
                    || deletingUserId === user.id
                    || linkingHistoryUserId === user.id;
                  const rowBackground = isBusy ? "bg-slate-100/70" : rowIndex % 2 === 1 ? "bg-slate-50/70" : "bg-white";

                  return (
                    <tr
                      key={user.id}
                      data-testid="dashboard-user-row"
                      className={`group transition-colors hover:bg-slate-100/70 ${rowBackground}`}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">
                            {user.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate font-body font-bold text-slate-900">{user.name}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${user.role === "ADMIN" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"}`}>
                                {user.role === "ADMIN" ? "Quản trị" : "Khách"}
                              </span>
                            </div>
                            <p className="mt-0.5 font-body text-xs text-slate-600">{user.phone}</p>
                            <p className="mt-1 font-body text-[10px] text-slate-500">
                              {getOriginLabel(user.customerOrigin)} · ĐK {formatDate(user.createdAt)}
                              {user.referralCode ? ` · Mã GT ${user.referralCode}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {editingPoints === user.id ? (
                          <div className="flex min-w-40 items-center gap-1.5">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={pointsAdd}
                              onChange={(event) => setPointsAdd(sanitizeSignedIntegerText(event.target.value))}
                              className="min-h-9 w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                              placeholder="+50"
                              autoFocus
                            />
                            <button
                              onClick={() => addPoints(user.id)}
                              disabled={savingPointsId === user.id}
                              className="min-h-9 rounded-lg bg-green-700 px-2.5 py-1 text-[11px] font-bold text-white transition-colors hover:bg-green-800 disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              {savingPointsId === user.id ? "Đang lưu..." : "Lưu"}
                            </button>
                            <button
                              onClick={() => setEditingPoints(null)}
                              disabled={savingPointsId === user.id}
                              className="min-h-9 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-200 disabled:text-slate-300"
                            >
                              Huỷ
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingPoints(user.id);
                              setPointsAdd("");
                            }}
                            className="rounded-lg px-2 py-1.5 text-left font-body transition-colors hover:bg-slate-100 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100"
                          >
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${tier.color}`}>{tier.label}</span>
                            <span className="mt-1 block text-sm font-bold text-slate-900">{user.loyaltyPoints} điểm</span>
                            <span className="text-[10px] font-semibold text-slate-500">Bấm để điều chỉnh</span>
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-body text-xs font-bold text-slate-800">
                          {user.serviceOrderCount} đơn{user.recentOrderDate ? ` · ${formatDate(user.recentOrderDate)}` : " · Chưa có đơn"}
                        </p>
                        <p className="mt-1 font-body text-[11px] text-slate-600">
                          {user.hasWarranty ? `${user.warrantyCount || 1} bảo hành` : "Chưa có bảo hành"} · {engagementScore} tương tác
                        </p>
                        <p className="mt-0.5 font-body text-[10px] text-slate-400">
                          {user._count.contactRequests} yêu cầu · {user._count.reviews} đánh giá
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className={`font-body text-sm font-bold ${user.totalDebt > 0 ? "text-red-700" : "text-green-700"}`}>
                          {formatMoney(user.totalDebt)}
                        </p>
                        <p className="mt-0.5 font-body text-[10px] text-slate-500">
                          {user.totalDebt > 0 ? "Cần theo dõi" : "Đã thanh toán"}
                        </p>
                      </td>
                      <td className={`sticky right-0 z-[1] px-4 py-3.5 shadow-[-12px_0_18px_-18px_rgba(15,23,42,0.45)] transition-colors group-hover:bg-slate-100/70 ${rowBackground}`}>
                        {user.role !== "ADMIN" ? (
                          <div className="min-w-48 space-y-2" data-testid="dashboard-user-actions-desktop">
                            <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-slate-200 bg-white/90 p-2 shadow-sm">
                              {user.unlinkedHistory.total > 0 ? (
                                <button
                                  type="button"
                                  data-testid="dashboard-link-history-desktop"
                                  onClick={() => linkCustomerHistory(user)}
                                  disabled={linkingHistoryUserId === user.id}
                                  className="col-span-3 min-h-9 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-800 transition-colors hover:bg-emerald-100 disabled:border-slate-100 disabled:bg-slate-100 disabled:text-slate-300"
                                >
                                  {linkingHistoryUserId === user.id
                                    ? "Đang nối lịch sử..."
                                    : linkHistoryActionLabel(user.unlinkedHistory.total)}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                aria-label="Cấp lại mật khẩu"
                                title="Cấp lại mật khẩu"
                                onClick={() => resetPassword(user.id, user.name)}
                                disabled={resettingPasswordId === user.id}
                                className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg border border-blue-100 bg-blue-50 px-2 py-1.5 text-[10px] font-bold text-blue-700 transition-colors hover:bg-blue-100 disabled:border-slate-100 disabled:bg-slate-100 disabled:text-slate-300"
                              >
                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9m-4 4 3 3m-6 0 3 3" /></svg>
                                {resettingPasswordId === user.id ? "Đang cấp" : "Mật khẩu"}
                              </button>
                              <button
                                type="button"
                                aria-label="Đặt điểm về 0"
                                title="Đặt điểm về 0"
                                onClick={() => resetPoints(user.id, user.name)}
                                disabled={resettingPointsId === user.id}
                                className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg border border-amber-200 bg-amber-50/60 px-2 py-1.5 text-[10px] font-bold text-amber-800 transition-colors hover:bg-amber-100 disabled:border-slate-100 disabled:bg-slate-100 disabled:text-slate-300"
                              >
                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 3v18M7 8h7.5a3.5 3.5 0 0 1 0 7H6" /></svg>
                                {resettingPointsId === user.id ? "Đang đặt" : "Điểm 0"}
                              </button>
                              <button
                                type="button"
                                aria-label="Xoá tài khoản"
                                title="Xoá tài khoản"
                                onClick={() => deleteUser(user.id, user.name)}
                                disabled={deletingUserId === user.id}
                                className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg border border-red-100 bg-red-50/60 px-2 py-1.5 text-[10px] font-bold text-red-700 transition-colors hover:bg-red-100 disabled:border-slate-100 disabled:bg-slate-100 disabled:text-slate-300"
                              >
                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14M10 10v6m4-6v6" /></svg>
                                {deletingUserId === user.id ? "Đang xoá" : "Xoá"}
                              </button>
                            </div>
                            {historyLinkNotices[user.id] ? (
                              <p
                                role={historyLinkNotices[user.id].tone === "error" ? "alert" : "status"}
                                className={`rounded-lg border px-2.5 py-2 font-body text-[11px] ${
                                  historyLinkNotices[user.id].tone === "error"
                                    ? "border-red-200 bg-red-50 text-red-800"
                                    : historyLinkNotices[user.id].tone === "warning"
                                      ? "border-amber-200 bg-amber-50 text-amber-800"
                                      : "border-emerald-200 bg-emerald-50 text-emerald-800"
                                }`}
                              >
                                {historyLinkNotices[user.id].message}
                              </p>
                            ) : null}
                            {resetPwId === user.id && tempCode && (
                              <div className="rounded-lg border border-green-200 bg-green-50 px-2.5 py-2">
                                <p className="mb-1 font-body text-[9px] font-bold uppercase tracking-wide text-green-800">
                                  Mật khẩu tạm · chỉ hiện lần này
                                </p>
                                <div className="flex items-center gap-1.5">
                                  <code className="font-mono text-xs font-bold text-green-800">{tempCode}</code>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(tempCode);
                                      showToast("Đã sao chép!", "success");
                                    }}
                                    className="ml-auto rounded-md bg-green-700 px-2 py-1 text-[10px] font-bold text-white transition-colors hover:bg-green-800"
                                  >
                                    Sao chép
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setResetPwId(null);
                                      setTempCode("");
                                    }}
                                    className="rounded-md px-1.5 py-1 text-[10px] font-bold text-slate-500 transition-colors hover:bg-green-100 hover:text-slate-700"
                                  >
                                    Đóng
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="font-body text-xs font-semibold text-slate-500">Tài khoản quản trị</p>
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
      <PaginationControls
        itemLabel="khách"
        onPageChange={setPage}
        page={currentPage}
        pageCount={pageCount}
        pageSize={USER_PAGE_SIZE}
        totalItems={filteredUsers.length}
      />
    </div>
  );
}
