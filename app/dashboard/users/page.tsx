"use client";

import { useState, useEffect } from "react";
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

const getTier = (pts: number) => {
  if (pts >= 500) return { label: "💎 Kim Cương", color: "bg-yellow-100 text-yellow-700" };
  if (pts >= 200) return { label: "🥇 Vàng", color: "bg-slate-200 text-slate-700" };
  if (pts >= 50) return { label: "🥈 Bạc", color: "bg-orange-100 text-orange-700" };
  return { label: "🥉 Đồng", color: "bg-slate-100 text-slate-500" };
};

function generateTempPassword() {
  const chars = "abcdefghkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function AdminUsersPage() {
  const { showToast, showConfirm } = useNotify();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPoints, setEditingPoints] = useState<string | null>(null);
  const [pointsAdd, setPointsAdd] = useState("");

  const fetchUsers = () => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => { if (data.success) setUsers(data.users); })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const addPoints = async (userId: string) => {
    const pts = parseInt(pointsAdd);
    if (!pts || isNaN(pts)) return;
    const res = await fetch("/api/admin/loyalty", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, points: pts, reason: "Admin thưởng điểm" }),
    });
    if (res.ok) {
      const data = await res.json();
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, loyaltyPoints: data.user.loyaltyPoints } : u));
      setEditingPoints(null);
      setPointsAdd("");
      showToast(`Đã ${pts > 0 ? "cộng" : "trừ"} ${Math.abs(pts)} điểm.`, "success");
    } else {
      showToast("Lỗi cập nhật điểm.", "error");
    }
  };

  const resetPoints = (userId: string, name: string) => {
    showConfirm(`Reset điểm thưởng của ${name} về 0?`, async () => {
      const res = await fetch("/api/admin/loyalty", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, points: 0, reason: "Admin reset điểm", setExact: true }),
      });
      if (res.ok) {
        setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, loyaltyPoints: 0 } : u));
        showToast("Đã reset điểm về 0.", "success");
      }
    });
  };

  const [resetPwId, setResetPwId] = useState<string | null>(null);
  const [tempCode, setTempCode] = useState("");

  const resetPassword = async (userId: string, name: string) => {
    const code = generateTempPassword();
    showConfirm(`Tạo mật khẩu tạm cho "${name}"?\nMật khẩu tạm sẽ hiện 1 lần, gửi cho khách qua Zalo.`, async () => {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, newPassword: code }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResetPwId(userId);
        setTempCode(code);
        showToast("Đã tạo mật khẩu tạm! Gửi cho khách.", "success");
      } else {
        showToast(data.message || "Lỗi.", "error");
      }
    });
  };

  const deleteUser = (userId: string, name: string) => {
    showConfirm(`Xoá tài khoản "${name}"?\nTất cả dữ liệu (yêu cầu, đánh giá, bảo hành) sẽ bị xoá vĩnh viễn.`, async () => {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        showToast("Đã xoá tài khoản.", "success");
      } else {
        showToast(data.message || "Lỗi xoá.", "error");
      }
    });
  };

  if (isLoading) return <div className="py-12 text-center"><div className="animate-pulse h-6 bg-slate-200 rounded-xl w-40 mx-auto"></div></div>;

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
              {users.map((u) => {
                const tier = getTier(u.loyaltyPoints);
                return (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">{u.name.charAt(0)}</div>
                        <div>
                          <span className="font-body font-semibold text-slate-800 block">{u.name}</span>
                          <span className={`text-[10px] font-bold ${u.role === "ADMIN" ? "text-red-500" : "text-slate-400"}`}>{u.role === "ADMIN" ? "Admin" : "Khách"}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-body text-slate-600 text-xs">{u.phone}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${tier.color}`}>{tier.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      {editingPoints === u.id ? (
                        <div className="flex gap-1">
                          <input type="number" value={pointsAdd} onChange={(e) => setPointsAdd(e.target.value)}
                            className="w-16 px-2 py-1 text-xs border border-slate-200 rounded-lg outline-none" placeholder="+50" autoFocus />
                          <button onClick={() => addPoints(u.id)} className="px-2 py-1 text-[10px] font-bold bg-green-100 text-green-700 rounded-lg">✓</button>
                          <button onClick={() => setEditingPoints(null)} className="px-2 py-1 text-[10px] font-bold bg-slate-100 text-slate-500 rounded-lg">✕</button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingPoints(u.id); setPointsAdd(""); }} className="font-body font-bold text-slate-800 hover:text-red-600 transition-colors text-xs">
                          {u.loyaltyPoints} <span className="text-[10px] text-slate-400">±</span>
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 font-body text-slate-600 text-xs">{u._count.contactRequests}</td>
                    <td className="px-4 py-3 font-body text-slate-400 text-[10px]">{new Date(u.createdAt).toLocaleDateString("vi-VN")}</td>
                    <td className="px-4 py-3">
                      {u.role !== "ADMIN" && (
                        <div className="space-y-1">
                          <div className="flex gap-1">
                            <button onClick={() => resetPassword(u.id, u.name)} title="Tạo MK tạm" className="px-2 py-1 text-[10px] font-bold bg-blue-50 text-blue-500 rounded-lg hover:bg-blue-100">🔑</button>
                            <button onClick={() => resetPoints(u.id, u.name)} title="Reset điểm" className="px-2 py-1 text-[10px] font-bold bg-yellow-50 text-yellow-600 rounded-lg hover:bg-yellow-100">🔄</button>
                            <button onClick={() => deleteUser(u.id, u.name)} title="Xoá tài khoản" className="px-2 py-1 text-[10px] font-bold bg-red-50 text-red-500 rounded-lg hover:bg-red-100">🗑️</button>
                          </div>
                          {resetPwId === u.id && tempCode && (
                            <div className="flex items-center gap-1 bg-green-50 border border-green-200 rounded-lg px-2 py-1">
                              <code className="text-xs font-mono font-bold text-green-700">{tempCode}</code>
                              <button onClick={() => { navigator.clipboard.writeText(tempCode); showToast("Đã sao chép!", "success"); }}
                                className="text-[9px] font-bold text-green-600 hover:text-green-800 ml-auto">📋</button>
                              <button onClick={() => { setResetPwId(null); setTempCode(""); }}
                                className="text-[9px] font-bold text-slate-400 hover:text-slate-600">✕</button>
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
