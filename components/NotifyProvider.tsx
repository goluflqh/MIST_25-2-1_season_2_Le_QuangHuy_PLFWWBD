"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

interface ToastData {
  id: number;
  message: string;
  type: "success" | "warning" | "error";
}

interface ConfirmOptions {
  confirmLabel?: string;
  title?: string;
  tone?: "default" | "warning" | "destructive";
}

interface ConfirmData {
  message: string;
  onConfirm: () => void;
  label: string;
  title: string;
  tone: NonNullable<ConfirmOptions["tone"]>;
}

const ToastContext = createContext<{
  showToast: (message: string, type: ToastData["type"]) => void;
  showConfirm: (
    message: string,
    onConfirm: () => void,
    confirmLabelOrOptions?: string | ConfirmOptions,
  ) => void;
}>({ showToast: () => {}, showConfirm: () => {} });

function isDeleteActionText(value: string) {
  const withoutDiacritics = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return /\bxoa\b/i.test(withoutDiacritics);
}

export function useNotify() {
  return useContext(ToastContext);
}

export function NotifyProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [confirm, setConfirm] = useState<ConfirmData | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const showToast = useCallback((message: string, type: ToastData["type"]) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 6000);
  }, []);

  const showConfirm = useCallback((
    message: string,
    onConfirm: () => void,
    confirmLabelOrOptions?: string | ConfirmOptions,
  ) => {
    const isDeleteAction = isDeleteActionText(message);
    const options = typeof confirmLabelOrOptions === "string"
      ? { confirmLabel: confirmLabelOrOptions }
      : confirmLabelOrOptions;
    const tone = options?.tone || (isDeleteAction ? "destructive" : "default");
    setConfirm({
      message,
      onConfirm,
      label: options?.confirmLabel || (isDeleteAction ? "Xoá" : "Xác nhận"),
      title: options?.title || (isDeleteAction ? "Xác nhận xoá" : "Xác nhận thao tác"),
      tone,
    });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirm(null);
  }, []);

  useEffect(() => {
    if (!confirm) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeConfirm();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [closeConfirm, confirm]);

  const isDestructive = confirm?.tone === "destructive";
  const isWarning = confirm?.tone === "warning";

  return (
    <ToastContext.Provider value={{ showToast, showConfirm }}>
      {children}

      {/* Toast container */}
      <div
        className="fixed inset-x-4 top-4 z-[999] space-y-2 pointer-events-none sm:inset-x-auto sm:right-4 sm:w-[min(24rem,calc(100vw-2rem))]"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === "error" ? "alert" : "status"}
            className={`pointer-events-auto px-4 py-3 rounded-xl shadow-lg text-sm font-body font-bold animate-fade-in-up sm:max-w-sm ${
              t.type === "success"
                ? "bg-green-600 text-white"
                : t.type === "warning"
                  ? "border border-amber-200 bg-amber-50 text-amber-950"
                  : "bg-red-600 text-white"
            }`}
          >
            {t.type === "success" ? "✓" : t.type === "warning" ? "Lưu ý:" : "Lỗi:"} {t.message}
          </div>
        ))}
      </div>

      {/* Confirm dialog */}
      {confirm && (
        <div
          className="fixed inset-0 z-[998] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeConfirm();
          }}
        >
          <div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl animate-fade-in-up sm:p-6"
          >
            <h2 id={titleId} className="mb-2 font-heading text-lg font-extrabold text-slate-950">
              {confirm.title}
            </h2>
            <p id={descriptionId} className="mb-5 whitespace-pre-line font-body text-sm leading-6 text-slate-700">{confirm.message}</p>
            <div className="flex gap-3 justify-end">
              <button
                ref={cancelButtonRef}
                type="button"
                onClick={closeConfirm}
                className="min-h-11 rounded-xl bg-slate-100 px-5 py-2 font-body text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
              >
                Huỷ
              </button>
              <button
                type="button"
                onClick={() => { confirm.onConfirm(); closeConfirm(); }}
                className={`min-h-11 rounded-xl px-5 py-2 font-body text-sm font-bold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                  isDestructive
                    ? "bg-red-600 hover:bg-red-700 focus-visible:ring-red-600"
                    : isWarning
                      ? "bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-600"
                      : "bg-slate-900 hover:bg-slate-800 focus-visible:ring-slate-700"
                }`}
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
