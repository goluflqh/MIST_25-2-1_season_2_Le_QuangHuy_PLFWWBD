"use client";

import { useState, createContext, useContext, useCallback } from "react";

interface ToastData {
  id: number;
  message: string;
  type: "success" | "error";
}

const ToastContext = createContext<{
  showToast: (message: string, type: "success" | "error") => void;
  showConfirm: (message: string, onConfirm: () => void, confirmLabel?: string) => void;
}>({ showToast: () => {}, showConfirm: () => {} });

export function useNotify() {
  return useContext(ToastContext);
}

export function NotifyProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void; label: string } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const showConfirm = useCallback((message: string, onConfirm: () => void, confirmLabel?: string) => {
    setConfirm({ message, onConfirm, label: confirmLabel || "Xác nhận" });
  }, []);

  const isDestructive = confirm?.label === "Xoá";

  return (
    <ToastContext.Provider value={{ showToast, showConfirm }}>
      {children}

      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[999] space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-xl shadow-lg text-sm font-body font-bold animate-fade-in-up ${
              t.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
            }`}
          >
            {t.type === "success" ? "✅" : "❌"} {t.message}
          </div>
        ))}
      </div>

      {/* Confirm dialog */}
      {confirm && (
        <div className="fixed inset-0 z-[998] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-sm mx-4 shadow-2xl animate-fade-in-up">
            <p className="font-body text-sm text-slate-800 mb-5 whitespace-pre-line">{confirm.message}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirm(null)}
                className="px-5 py-2 rounded-xl font-body font-bold text-sm bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Huỷ
              </button>
              <button
                onClick={() => { confirm.onConfirm(); setConfirm(null); }}
                className={`px-5 py-2 rounded-xl font-body font-bold text-sm text-white transition-colors ${isDestructive ? "bg-red-600 hover:bg-red-700" : "bg-slate-900 hover:bg-slate-800"}`}
              >
                {confirm.label}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}
