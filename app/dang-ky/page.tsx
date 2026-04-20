"use client";

import { Suspense, startTransition, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

function validatePhone(phone: string): string | null {
  const cleaned = phone.replace(/\s|-/g, "");
  if (!/^\d+$/.test(cleaned)) return "SĐT chỉ được chứa chữ số.";
  if (cleaned.length !== 10) return "SĐT phải có đúng 10 chữ số.";
  if (!cleaned.startsWith("0")) return "SĐT phải bắt đầu bằng số 0.";
  if (!/^(03|05|07|08|09)/.test(cleaned)) return "Đầu số không hợp lệ (03, 05, 07, 08, 09).";
  return null;
}

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuth();
  const refCode = searchParams.get("ref");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [referrerName, setReferrerName] = useState("");

  useEffect(() => {
    if (refCode) {
      fetch(`/api/referral?code=${refCode}`)
        .then((r) => r.json())
        .then((d) => { if (d.success) setReferrerName(d.referrerName); })
        .catch(() => {});
    }
  }, [refCode]);

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    if (value.length >= 3) {
      const err = validatePhone(value);
      setPhoneError(value.length === 10 && !err ? "" : err || "");
    } else {
      setPhoneError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) { setError("Vui lòng nhập họ tên."); return; }
    if (name.trim().length < 2) { setError("Họ tên phải có ít nhất 2 ký tự."); return; }

    const phoneErr = validatePhone(phone.trim());
    if (phoneErr) { setError(phoneErr); return; }

    if (!password.trim()) { setError("Vui lòng nhập mật khẩu."); return; }
    if (password.length < 6) { setError("Mật khẩu phải có ít nhất 6 ký tự."); return; }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), password, referralCode: refCode || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error || data.message || "Đăng ký thất bại."); return; }
      setUser(data.user ?? null);
      startTransition(() => {
        router.replace("/tai-khoan");
      });
    } catch {
      setError("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-20 animate-fade-in-up">
      <div className="bg-white rounded-3xl shadow-xl p-8 relative overflow-hidden border border-slate-100">
        <div className="absolute top-0 left-0 w-32 h-32 bg-yellow-100 opacity-50 rounded-full blur-2xl transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>

        <div className="text-center mb-10 relative z-10">
          <h1 className="font-heading font-extrabold text-3xl text-slate-900 mb-2">Đăng Ký</h1>
          <p className="font-body text-slate-500">Tạo tài khoản theo dõi bảo hành & nhận ưu đãi</p>
        </div>

        {referrerName && (
          <div className="mb-6 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-body text-center">
            🎁 Được giới thiệu bởi <strong>{referrerName}</strong> — Cả 2 nhận +20 điểm thưởng khi đăng ký!
          </div>
        )}

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-body text-center">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 font-body">Họ và Tên</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none font-body"
              placeholder="Vd: Nguyễn Văn A..." disabled={isLoading} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 font-body">Số Điện Thoại</label>
            <input type="tel" value={phone} onChange={(e) => handlePhoneChange(e.target.value)}
              className={`w-full px-4 py-3 rounded-xl border transition-all outline-none font-body ${phoneError ? "border-red-300 focus:ring-red-500" : "border-slate-200 focus:ring-red-500"} focus:ring-2 focus:border-red-500`}
              placeholder="09xxxxxxxx" disabled={isLoading} maxLength={10} />
            {phoneError && <p className="text-xs text-red-500 font-body mt-1">{phoneError}</p>}
            {phone.length === 10 && !phoneError && <p className="text-xs text-green-600 font-body mt-1">✓ SĐT hợp lệ</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 font-body">Mật Khẩu</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none font-body"
              placeholder="Ít nhất 6 ký tự..." disabled={isLoading} />
            {password.length > 0 && password.length < 6 && <p className="text-xs text-red-500 font-body mt-1">Cần thêm {6 - password.length} ký tự nữa</p>}
            {password.length >= 6 && <p className="text-xs text-green-600 font-body mt-1">✓ Mật khẩu đủ dài</p>}
          </div>

          <button type="submit" disabled={isLoading}
            className="w-full py-3.5 px-4 bg-linear-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 disabled:from-slate-400 disabled:to-slate-400 text-white rounded-xl font-heading font-bold shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 disabled:transform-none mt-2">
            {isLoading ? "Đang tạo tài khoản..." : "Tạo Tài Khoản"}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-600 font-body relative z-10">
          Đã có tài khoản?{" "}
          <Link href="/dang-nhap" className="text-red-600 font-bold hover:underline">Đăng Nhập</Link>
        </p>
      </div>
    </div>
  );
}

function RegisterPageFallback() {
  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-20 animate-fade-in-up">
      <div className="bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
        <div className="space-y-4 animate-pulse">
          <div className="h-8 w-40 bg-slate-200 rounded-xl mx-auto"></div>
          <div className="h-4 w-56 bg-slate-100 rounded-xl mx-auto"></div>
          <div className="h-12 w-full bg-slate-100 rounded-xl"></div>
          <div className="h-12 w-full bg-slate-100 rounded-xl"></div>
          <div className="h-12 w-full bg-slate-100 rounded-xl"></div>
          <div className="h-12 w-full bg-slate-200 rounded-xl"></div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterPageFallback />}>
      <RegisterPageContent />
    </Suspense>
  );
}
