"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { siteConfig } from "@/lib/site";

function formatRetryAfter(totalSeconds: number) {
  const seconds = Math.max(totalSeconds, 0);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds} giây`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export default function LoginPage() {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retryAfterSec, setRetryAfterSec] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }

    const targetPath = user.role === "ADMIN" ? "/dashboard" : "/tai-khoan";
    router.replace(targetPath);
  }, [router, user]);

  useEffect(() => {
    if (retryAfterSec <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setRetryAfterSec((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [retryAfterSec]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!phone.trim() || !password.trim()) {
      setError("Vui lòng nhập đầy đủ thông tin.");
      return;
    }

    if (retryAfterSec > 0) {
      setError(`Bạn có thể thử lại sau ${formatRetryAfter(retryAfterSec)}.`);
      setShowForgot(true);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || data.error || "Đăng nhập thất bại. Kiểm tra lại thông tin.");
        setNotice(data.warning || "");
        setRetryAfterSec(typeof data.retryAfterSec === "number" ? data.retryAfterSec : 0);

        if (
          (typeof data.retryAfterSec === "number" && data.retryAfterSec > 0) ||
          data.remainingAttempts <= 1
        ) {
          setShowForgot(true);
        }

        return;
      }

      setRetryAfterSec(0);
      setNotice("");
      setUser(data.user ?? null);

      const targetPath = data.user?.role === "ADMIN" ? "/dashboard" : "/tai-khoan";
      router.replace(targetPath);
    } catch {
      setError("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  const isSubmitDisabled = isLoading || retryAfterSec > 0;

  return (
    <div
      data-testid="login-page"
      className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-20 animate-fade-in-up"
    >
      <div className="bg-white rounded-3xl shadow-xl p-8 relative overflow-hidden border border-slate-100">
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-100 opacity-50 rounded-full blur-2xl transform translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>

        <div className="text-center mb-10 relative z-10">
          <h1 className="font-heading font-extrabold text-3xl text-slate-900 mb-2">Đăng Nhập</h1>
          <p className="font-body text-slate-500">Quản lý dịch vụ & yêu cầu báo giá</p>
        </div>

        {error && (
          <div
            data-testid="login-error"
            className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-body text-center"
          >
            {error}
          </div>
        )}

        {(notice || retryAfterSec > 0) && (
          <div
            data-testid="login-notice"
            className="mb-6 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-body text-center"
          >
            {retryAfterSec > 0
              ? `Bạn có thể thử lại sau ${formatRetryAfter(retryAfterSec)}. Trong lúc chờ, bạn có thể dùng mục "Quên mật khẩu" bên dưới để được hỗ trợ nhanh hơn.`
              : notice}
          </div>
        )}

        <form data-testid="login-form" onSubmit={handleSubmit} className="space-y-6 relative z-10">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 font-body">
              Số Điện Thoại
            </label>
            <input
              type="tel"
              data-testid="login-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none font-body"
              placeholder="09xxxxxxxx"
              disabled={isSubmitDisabled}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 font-body flex justify-between">
              Mật Khẩu
              <button
                type="button"
                onClick={() => setShowForgot(!showForgot)}
                className="text-red-600 hover:text-red-700 font-medium"
              >
                Quên mật khẩu?
              </button>
            </label>
            <input
              type="password"
              data-testid="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none font-body"
              placeholder="••••••••"
              disabled={isSubmitDisabled}
            />
          </div>

          <button
            type="submit"
            data-testid="login-submit"
            disabled={isSubmitDisabled}
            className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-xl font-heading font-bold shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 disabled:transform-none"
          >
            {isLoading
              ? "Đang đăng nhập..."
              : retryAfterSec > 0
                ? `Thử lại sau ${formatRetryAfter(retryAfterSec)}`
                : "Đăng Nhập"}
          </button>
        </form>

        {showForgot && (
          <div
            data-testid="login-forgot-help"
            className="mt-6 p-4 rounded-xl bg-yellow-50 border border-yellow-200 relative z-10"
          >
            <h3 className="font-heading font-bold text-sm text-slate-800 mb-2">🔑 Quên Mật Khẩu?</h3>
            <p className="font-body text-xs text-slate-600 mb-3">
              Liên hệ trực tiếp cửa hàng để được hỗ trợ đặt lại mật khẩu:
            </p>
            <div className="space-y-2">
              <a
                href={siteConfig.hotlineHref}
                className="flex items-center gap-2 text-sm font-body font-bold text-red-600 hover:text-red-700"
              >
                📞 Gọi: {siteConfig.hotlineDisplay}
              </a>
              <a
                href={siteConfig.zaloUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm font-body font-bold text-blue-600 hover:text-blue-700"
              >
                💬 Nhắn Zalo: {siteConfig.hotlineDisplay}
              </a>
            </div>
            <p className="font-body text-[10px] text-slate-400 mt-2">
              Admin sẽ xác minh danh tính và đặt lại mật khẩu cho bạn.
            </p>
          </div>
        )}

        <p className="mt-8 text-center text-sm text-slate-600 font-body relative z-10">
          Chưa có tài khoản?{" "}
          <Link href="/dang-ky" className="text-red-600 font-bold hover:underline">
            Đăng Ký Khách Hàng
          </Link>
        </p>
      </div>
    </div>
  );
}
