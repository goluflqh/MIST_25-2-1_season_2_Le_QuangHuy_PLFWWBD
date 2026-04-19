"use client";

import { useState } from "react";
import { useNotify } from "@/components/NotifyProvider";

interface UserData {
  id: string;
  name: string;
  phone: string;
  role: string;
  loyaltyPoints: number;
  referralCode: string;
  createdAt: string;
  _count: { contactRequests: number; reviews: number };
}

const getTier = (points: number) => {
  if (points >= 500) return { label: "💎 Kim Cương", color: "bg-yellow-100 text-yellow-700" };
  if (points >= 200) return { label: "🥇 Vàng", color: "bg-slate-200 text-slate-700" };
  if (points >= 50) return { label: "🥈 Bạc", color: "bg-orange-100 text-orange-700" };
  return { label: "🥉 Đồng", color: "bg-slate-100 text-slate-500" };
};

function generateTempPassword() {
  const chars = "abcdefghkmnpqrstuvwxyz23456789";
  let code = "";
  for (let index = 0; index < 6; index += 1) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
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

  const addPoints = async (userId: string) => {
    const points = parseInt(pointsAdd, 10);
    if (!points || Number.isNaN(points)) return;

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
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h2 className="font-heading font-extrabold text-xl text-slate-900">Khách Hàng Đã Đăng Ký</h2>
        <p className="font-body text-sm text-slate-500">{users.length} tài khoản</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 font-body font-bold text-slate-500 text-xs uppercase">Tên</th>
                <th className="text-left px-4 py-3 font-body font-bold text-slate-500 text-xs uppercase">SĐT</th>
                <th className="text-left px-4 py-3 font-body font-bold text-slate-500 text-xs uppercase">Hạng</th>
                <th className="text-left px-4 py-3 font-body font-bold text-slate-500 text-xs uppercase">Điểm</th>
                <th className="text-left px-4 py-3 font-body font-bold text-slate-500 text-xs uppercase">YC</th>
                <th className="text-left px-4 py-3 font-body font-bold text-slate-500 text-xs uppercase">Ngày ĐK</th>
                <th className="text-left px-4 py-3 font-body font-bold text-slate-500 text-xs uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map((user) => {
                const tier = getTier(user.loyaltyPoints);
                const isBusy = savingPointsId === user.id
                  || resettingPointsId === user.id
                  || resettingPasswordId === user.id
                  || deletingUserId === user.id;

                return (
                  <tr key={user.id} className={`transition-colors ${isBusy ? "bg-slate-50/70" : "hover:bg-slate-50/50"}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">{user.name.charAt(0)}</div>
                        <div>
                          <span className="font-body font-semibold text-slate-800 block">{user.name}</span>
                          <span className={`text-[10px] font-bold ${user.role === "ADMIN" ? "text-red-500" : "text-slate-400"}`}>
                            {user.role === "ADMIN" ? "Admin" : "Khách"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-body text-slate-600 text-xs">{user.phone}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${tier.color}`}>{tier.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      {editingPoints === user.id ? (
                        <div className="flex gap-1">
                          <input
                            type="number"
                            value={pointsAdd}
                            onChange={(event) => setPointsAdd(event.target.value)}
                            className="w-16 px-2 py-1 text-xs border border-slate-200 rounded-lg outline-none"
                            placeholder="+50"
                            autoFocus
                          />
                          <button
                            onClick={() => addPoints(user.id)}
                            disabled={savingPointsId === user.id}
                            className="px-2 py-1 text-[10px] font-bold bg-green-100 text-green-700 rounded-lg disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            {savingPointsId === user.id ? "..." : "✓"}
                          </button>
                          <button
                            onClick={() => setEditingPoints(null)}
                            disabled={savingPointsId === user.id}
                            className="px-2 py-1 text-[10px] font-bold bg-slate-100 text-slate-500 rounded-lg disabled:text-slate-300"
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
                          className="font-body font-bold text-slate-800 hover:text-red-600 transition-colors text-xs"
                        >
                          {user.loyaltyPoints} <span className="text-[10px] text-slate-400">±</span>
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 font-body text-slate-600 text-xs">{user._count.contactRequests}</td>
                    <td className="px-4 py-3 font-body text-slate-400 text-[10px]">{new Date(user.createdAt).toLocaleDateString("vi-VN")}</td>
                    <td className="px-4 py-3">
                      {user.role !== "ADMIN" && (
                        <div className="space-y-1">
                          <div className="flex gap-1">
                            <button
                              onClick={() => resetPassword(user.id, user.name)}
                              disabled={resettingPasswordId === user.id}
                              title="Tạo MK tạm"
                              className="px-2 py-1 text-[10px] font-bold bg-blue-50 text-blue-500 rounded-lg hover:bg-blue-100 disabled:bg-slate-100 disabled:text-slate-300"
                            >
                              {resettingPasswordId === user.id ? "..." : "🔑"}
                            </button>
                            <button
                              onClick={() => resetPoints(user.id, user.name)}
                              disabled={resettingPointsId === user.id}
                              title="Reset điểm"
                              className="px-2 py-1 text-[10px] font-bold bg-yellow-50 text-yellow-600 rounded-lg hover:bg-yellow-100 disabled:bg-slate-100 disabled:text-slate-300"
                            >
                              {resettingPointsId === user.id ? "..." : "🔄"}
                            </button>
                            <button
                              onClick={() => deleteUser(user.id, user.name)}
                              disabled={deletingUserId === user.id}
                              title="Xoá tài khoản"
                              className="px-2 py-1 text-[10px] font-bold bg-red-50 text-red-500 rounded-lg hover:bg-red-100 disabled:bg-slate-100 disabled:text-slate-300"
                            >
                              {deletingUserId === user.id ? "..." : "🗑️"}
                            </button>
                          </div>
                          {resetPwId === user.id && tempCode && (
                            <div className="flex items-center gap-1 bg-green-50 border border-green-200 rounded-lg px-2 py-1">
                              <code className="text-xs font-mono font-bold text-green-700">{tempCode}</code>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(tempCode);
                                  showToast("Đã sao chép!", "success");
                                }}
                                className="text-[9px] font-bold text-green-600 hover:text-green-800 ml-auto"
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
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
