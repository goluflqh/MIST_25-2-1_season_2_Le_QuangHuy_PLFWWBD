"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";

type WarrantyStatus = "active" | "expired" | "unknown";

interface WarrantySummary {
  maskedSerial: string;
  productName: string;
  service: string;
  status: WarrantyStatus;
  expiryMonth: number | null;
  expiryYear: number | null;
}

interface LookupResult {
  warranties: WarrantySummary[];
  hasMore: boolean;
}

const expiryFormatter = new Intl.DateTimeFormat("vi-VN", {
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const statusStyles: Record<
  WarrantyStatus,
  { label: string; badge: string; dot: string }
> = {
  active: {
    label: "Còn bảo hành",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  expired: {
    label: "Đã hết hạn",
    badge: "border-red-200 bg-red-50 text-red-700",
    dot: "bg-red-500",
  },
  unknown: {
    label: "Chưa rõ hạn",
    badge: "border-slate-200 bg-slate-100 text-slate-700",
    dot: "bg-slate-400",
  },
};

function normalizePhoneForValidation(value: string) {
  let phone = value.replace(/[\s\-.()]/g, "");
  if (phone.startsWith("+84")) phone = `0${phone.slice(3)}`;
  if (phone.startsWith("84") && phone.length === 11) phone = `0${phone.slice(2)}`;
  return phone;
}

function formatExpiry(month: number | null, year: number | null) {
  if (month === null || year === null) return "Cần kiểm tra lại với Minh Hồng";
  return expiryFormatter.format(new Date(Date.UTC(year, month - 1, 1)));
}

function isWarrantySummary(value: unknown): value is WarrantySummary {
  if (!value || typeof value !== "object") return false;

  const warranty = value as Record<string, unknown>;
  return (
    typeof warranty.maskedSerial === "string" &&
    typeof warranty.productName === "string" &&
    typeof warranty.service === "string" &&
    (warranty.status === "active" ||
      warranty.status === "expired" ||
      warranty.status === "unknown") &&
    (typeof warranty.expiryMonth === "number" || warranty.expiryMonth === null) &&
    (typeof warranty.expiryYear === "number" || warranty.expiryYear === null)
  );
}

export default function WarrantyLookupClient() {
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasSubmitted && !isLoading) {
      feedbackRef.current?.focus();
    }
  }, [error, hasSubmitted, isLoading, result]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedPhone = normalizePhoneForValidation(phone);
    if (!/^0\d{9}$/.test(normalizedPhone)) {
      setResult(null);
      setError("Số điện thoại chưa đúng định dạng. Vui lòng nhập đủ 10 chữ số.");
      setHasSubmitted(true);
      return;
    }

    setIsLoading(true);
    setError("");
    setResult(null);
    setHasSubmitted(true);

    try {
      const response = await fetch("/api/warranty/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        throw new Error(
          typeof payload?.message === "string"
            ? payload.message
            : "Chưa tra cứu được lúc này. Vui lòng thử lại."
        );
      }

      if (
        !Array.isArray(payload.warranties) ||
        !payload.warranties.every(isWarrantySummary)
      ) {
        throw new Error("Dữ liệu trả về chưa hợp lệ. Vui lòng thử lại.");
      }

      setResult({
        warranties: payload.warranties,
        hasMore: payload.hasMore === true,
      });
    } catch (lookupError) {
      setError(
        lookupError instanceof Error
          ? lookupError.message
          : "Chưa tra cứu được lúc này. Vui lòng thử lại."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(circle_at_18%_16%,rgba(254,226,226,0.95),transparent_35%),radial-gradient(circle_at_82%_12%,rgba(254,243,199,0.8),transparent_32%)]"
      />

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pb-24 sm:pt-14 lg:px-8">
        <nav aria-label="Đường dẫn trang" className="mb-7 font-body text-sm text-slate-500">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link
                href="/"
                className="rounded-md transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              >
                Trang chủ
              </Link>
            </li>
            <li aria-hidden="true" className="text-slate-300">
              /
            </li>
            <li aria-current="page" className="font-semibold text-slate-700">
              Tra cứu bảo hành
            </li>
          </ol>
        </nav>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:gap-12">
          <div className="pt-2 lg:sticky lg:top-32">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-red-100 bg-white/80 px-3 py-1.5 font-body text-xs font-bold uppercase tracking-[0.16em] text-red-700 shadow-sm backdrop-blur">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-red-500" />
              Nhanh & thuận tiện
            </div>
            <h1 className="max-w-xl text-pretty font-heading text-4xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-5xl">
              Tra cứu bảo hành bằng số điện thoại
            </h1>
            <p className="mt-5 max-w-xl text-pretty font-body text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Nhập số điện thoại đã cung cấp cho Minh Hồng để xem nhanh các phiếu bảo hành.
              Không cần đăng nhập hoặc nhớ mã phiếu.
            </p>

            <ul className="mt-8 space-y-4 font-body text-sm leading-6 text-slate-600 sm:text-base">
              <li className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-black text-emerald-700"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none">
                    <path
                      d="m5 10 3 3 7-7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                Xem trạng thái và thời hạn bảo hành trong vài giây.
              </li>
              <li className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-black text-amber-700"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none">
                    <path
                      d="m5 10 3 3 7-7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                Mã sản phẩm được che bớt để bảo vệ thông tin của khách hàng.
              </li>
            </ul>

            <p className="mt-8 font-body text-sm leading-6 text-slate-500">
              Đã có tài khoản?{" "}
              <Link
                href="/tai-khoan"
                className="font-bold text-primary underline decoration-red-200 underline-offset-4 transition-colors hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              >
                Mở trang Tài khoản
              </Link>{" "}
              để xem các phiếu đã được liên kết.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/90 bg-white/90 p-5 shadow-[0_28px_80px_-46px_rgba(15,23,42,0.42)] backdrop-blur sm:p-8">
            <form onSubmit={handleSubmit} noValidate>
              <div className="flex items-start gap-4">
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 text-xl text-white shadow-lg shadow-red-200"
                >
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M7.2 3.5 9.5 8l-2.1 1.4a14.2 14.2 0 0 0 7.2 7.2l1.4-2.1 4.5 2.3-.7 3.2c-.2.7-.8 1.2-1.6 1.2C9.7 21.2 2.8 14.3 2.8 5.8c0-.8.5-1.4 1.2-1.6l3.2-.7Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <div>
                  <h2 className="font-heading text-2xl font-extrabold text-slate-950">
                    Thông tin tra cứu
                  </h2>
                  <p className="mt-1 font-body text-sm leading-6 text-slate-500">
                    Dùng đúng số điện thoại đã ghi trên phiếu sửa chữa hoặc mua hàng.
                  </p>
                </div>
              </div>

              <div className="mt-7">
                <label
                  htmlFor="warranty-phone"
                  className="mb-2 block font-body text-sm font-bold text-slate-800"
                >
                  Số điện thoại
                </label>
                <input
                  id="warranty-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  spellCheck={false}
                  maxLength={20}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  aria-invalid={Boolean(error)}
                  aria-describedby={
                    error
                      ? "warranty-phone-help warranty-lookup-feedback"
                      : "warranty-phone-help"
                  }
                  className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-body text-base text-slate-950 shadow-sm transition-[border-color,box-shadow] placeholder:text-slate-400 hover:border-slate-300 focus-visible:border-red-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-100"
                />
                <p id="warranty-phone-help" className="mt-2 font-body text-xs leading-5 text-slate-500">
                  Có thể nhập dạng 0901 234 567 hoặc +84 901 234 567.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-5 flex min-h-12 w-full touch-manipulation items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-orange-600 px-5 py-3 font-body text-base font-bold text-white shadow-lg shadow-red-200 transition-[transform,box-shadow,opacity] hover:-translate-y-0.5 hover:shadow-xl hover:shadow-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 active:translate-y-0 disabled:cursor-wait disabled:opacity-70 motion-reduce:transform-none motion-reduce:transition-none"
              >
                {isLoading ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none"
                    />
                    Đang tra cứu…
                  </>
                ) : (
                  "Tra cứu bảo hành"
                )}
              </button>
            </form>

            <div
              id="warranty-lookup-feedback"
              ref={feedbackRef}
              tabIndex={-1}
              aria-live="polite"
              aria-busy={isLoading}
              className="mt-6 scroll-mt-32 focus:outline-none"
            >
              {error ? (
                <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="font-body text-sm font-bold text-red-800">Chưa thể tra cứu</p>
                  <p className="mt-1 font-body text-sm leading-6 text-red-700">{error}</p>
                </div>
              ) : null}

              {result?.warranties.length === 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
                  <svg
                    aria-hidden="true"
                    className="mx-auto h-9 w-9 text-amber-700"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
                    <path
                      d="m16 16 4 4"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                  <h3 className="mt-2 font-heading text-lg font-extrabold text-amber-950">
                    Chưa tìm thấy phiếu bảo hành
                  </h3>
                  <p className="mt-2 font-body text-sm leading-6 text-amber-800">
                    Hãy kiểm tra lại số điện thoại. Nếu phiếu dùng số khác, vui lòng liên hệ Minh
                    Hồng để được hỗ trợ.
                  </p>
                </div>
              ) : null}

              {result && result.warranties.length > 0 ? (
                <div>
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-t border-slate-100 pt-6">
                    <div>
                      <p className="font-body text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
                        Đã tìm thấy
                      </p>
                      <h3 className="mt-1 font-heading text-xl font-extrabold text-slate-950">
                        {result.warranties.length} phiếu bảo hành
                      </h3>
                    </div>
                    <p className="font-body text-xs text-slate-500">Thông tin đã được che bớt</p>
                  </div>

                  <div className="space-y-3">
                    {result.warranties.map((warranty, index) => {
                      const status = statusStyles[warranty.status] ?? statusStyles.unknown;

                      return (
                        <article
                          key={`${warranty.maskedSerial}-${index}`}
                          className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="break-words font-heading text-base font-extrabold text-slate-950 sm:text-lg">
                                {warranty.productName || "Sản phẩm/dịch vụ"}
                              </p>
                              <p className="mt-1 font-body text-sm text-slate-500">
                                Mã: <span className="font-mono font-semibold text-slate-700">{warranty.maskedSerial}</span>
                              </p>
                            </div>
                            <span
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-body text-xs font-bold ${status.badge}`}
                            >
                              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${status.dot}`} />
                              {status.label}
                            </span>
                          </div>

                          <dl className="mt-4 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2">
                            <div>
                              <dt className="font-body text-xs font-semibold text-slate-500">Dịch vụ</dt>
                              <dd className="mt-1 break-words font-body text-sm font-bold text-slate-800">
                                {warranty.service}
                              </dd>
                            </div>
                            <div>
                              <dt className="font-body text-xs font-semibold text-slate-500">Hạn bảo hành</dt>
                              <dd className="mt-1 font-body text-sm font-bold text-slate-800">
                                {formatExpiry(warranty.expiryMonth, warranty.expiryYear)}
                              </dd>
                            </div>
                          </dl>
                        </article>
                      );
                    })}
                  </div>

                  {result.hasMore ? (
                    <p className="mt-4 rounded-xl bg-slate-100 px-4 py-3 font-body text-xs leading-5 text-slate-600">
                      Đang hiển thị 10 phiếu gần nhất. Vui lòng liên hệ Minh Hồng nếu cần kiểm tra
                      thêm.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
