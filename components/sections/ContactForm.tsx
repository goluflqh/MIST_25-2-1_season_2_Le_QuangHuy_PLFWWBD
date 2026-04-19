"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePathname, useSearchParams } from "next/navigation";
import * as z from "zod";

const serviceOptions = [
  { value: "DONG_PIN", label: "🔋 Đóng Pin (xe điện, máy công cụ, loa kéo)" },
  { value: "DEN_NLMT", label: "☀️ Đèn Năng Lượng Mặt Trời" },
  { value: "PIN_LUU_TRU", label: "⚡ Pin Lưu Trữ / Kích Đề / Dự Phòng" },
  { value: "CAMERA", label: "📹 Lắp Đặt Camera An Ninh" },
  { value: "CUSTOM", label: "🔧 Đóng Bình Theo Yêu Cầu Riêng" },
  { value: "KHAC", label: "📞 Tư Vấn Khác" },
] as const;

const sourceLabels: Record<string, string> = {
  homepage: "Trang chủ",
  "pricing-page": "Trang báo giá",
  "service-dong-pin": "Trang dịch vụ đóng pin",
  "service-den-nlmt": "Trang đèn NLMT",
  "service-pin-luu-tru": "Trang pin lưu trữ",
  "service-camera": "Trang camera",
};

const validServiceIds = new Set(serviceOptions.map((option) => option.value));

const formSchema = z.object({
  name: z.string().min(2, { message: "Vui lòng nhập họ tên" }),
  phone: z.string().regex(/^(0|\+84)[3|5|7|8|9][0-9]{8}$/, {
    message: "Số điện thoại không hợp lệ (Ví dụ: 0987123456)",
  }),
  serviceId: z.string().min(1, { message: "Vui lòng chọn dịch vụ quan tâm" }),
  message: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

function readTrackingValue(searchParams: { get(name: string): string | null }, key: string) {
  return searchParams.get(key) || "";
}

export default function ContactForm() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const serviceFromQuery = searchParams.get("service") || "";
  const selectedSource = searchParams.get("source") || "homepage";
  const selectedSourceLabel = sourceLabels[selectedSource] || "Nguồn khác";

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      phone: "",
      serviceId: "",
      message: "",
    },
  });

  const selectedServiceId = watch("serviceId");
  const selectedServiceLabel =
    serviceOptions.find((option) => option.value === selectedServiceId)?.label || "";

  useEffect(() => {
    if (validServiceIds.has(serviceFromQuery as (typeof serviceOptions)[number]["value"])) {
      setValue("serviceId", serviceFromQuery, { shouldValidate: true });
    }
  }, [serviceFromQuery, setValue]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const sourcePath =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          phone: data.phone,
          service: data.serviceId,
          message: data.message || "",
          source: selectedSource,
          sourcePath,
          referrer: typeof document !== "undefined" ? document.referrer : "",
          utmSource: readTrackingValue(searchParams, "utm_source"),
          utmMedium: readTrackingValue(searchParams, "utm_medium"),
          utmCampaign: readTrackingValue(searchParams, "utm_campaign"),
          utmTerm: readTrackingValue(searchParams, "utm_term"),
          utmContent: readTrackingValue(searchParams, "utm_content"),
        }),
      });

      const result = await res.json().catch(() => null);

      if (!res.ok) {
        setSubmitError(
          result?.message || "Hệ thống đang bận. Vui lòng thử lại sau ít phút."
        );
        return;
      }

      setIsSuccess(true);
      reset({
        name: "",
        phone: "",
        serviceId: validServiceIds.has(serviceFromQuery as (typeof serviceOptions)[number]["value"])
          ? serviceFromQuery
          : "",
        message: "",
      });
      setTimeout(() => setIsSuccess(false), 8000);
    } catch (err) {
      console.error("Contact form error:", err);
      setSubmitError("Không thể gửi yêu cầu lúc này. Vui lòng kiểm tra kết nối và thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="quote" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 mb-8 relative z-20">
      <div className="bg-gradient-to-br from-red-600 to-orange-500 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-yellow-400 opacity-20 rounded-full blur-2xl transform -translate-x-1/4 translate-y-1/2"></div>

        <div className="relative z-10 md:w-1/2 text-white text-center md:text-left">
          <h2 className="font-heading font-extrabold text-3xl md:text-4xl mb-4 leading-tight">
            Cần Tư Vấn Thiết Bị & Báo Giá Nhanh?
          </h2>
          <p className="font-body text-red-100 text-lg mb-0">
            Vui lòng để lại thông tin, anh Hồng cùng đội ngũ kỹ thuật sẽ sớm liên hệ
            phân tích giải pháp tối ưu và báo giá chi tiết, minh bạch nhất cho bạn.
          </p>
        </div>

        <div className="relative z-10 md:w-1/2 w-full max-w-md mx-auto">
          {isSuccess ? (
            <div className="bg-white p-8 rounded-3xl shadow-xl flex flex-col items-center text-center gap-4 animate-fade-in">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <h3 className="font-heading font-bold text-2xl text-slate-800">Gửi Thành Công!</h3>
              <p className="font-body text-slate-600">
                Cảm ơn bạn. Đội ngũ kỹ thuật Minh Hồng sẽ liên hệ lại qua số điện thoại bạn vừa
                cung cấp trong ít phút nữa.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 w-full">
                <p className="font-body text-sm text-yellow-800 mb-2">
                  💡 <b>Tạo tài khoản</b> để theo dõi trạng thái yêu cầu & đánh giá dịch vụ!
                </p>
                <a
                  href="/dang-ky"
                  className="inline-block px-4 py-2 bg-yellow-500 text-slate-900 rounded-lg font-body font-bold text-sm hover:bg-yellow-600 transition-colors"
                >
                  Đăng Ký Miễn Phí →
                </a>
              </div>
              <button
                onClick={() => setIsSuccess(false)}
                className="mt-2 px-6 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-bold transition-colors"
              >
                Gửi yêu cầu khác
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="bg-white p-6 rounded-3xl shadow-xl flex flex-col gap-4" noValidate>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="font-body text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Nguồn lead
                </p>
                <p className="font-body text-sm font-bold text-slate-700">{selectedSourceLabel}</p>
                {selectedServiceLabel ? (
                  <p className="font-body text-xs text-slate-500 mt-1">
                    Đang ưu tiên tư vấn cho: {selectedServiceLabel}
                  </p>
                ) : null}
              </div>

              <div>
                <label htmlFor="contact-name" className="sr-only">
                  Họ và tên
                </label>
                <input
                  id="contact-name"
                  {...register("name")}
                  type="text"
                  placeholder="Họ tên của bạn..."
                  aria-label="Họ và tên"
                  aria-invalid={Boolean(errors.name)}
                  className={`w-full bg-slate-50 border ${errors.name ? "border-red-500 focus:ring-red-500" : "border-slate-200 focus:ring-primary"} text-slate-800 font-body px-4 py-4 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-shadow`}
                />
                {errors.name ? (
                  <p className="text-red-500 text-sm font-body mt-1 ml-1">{errors.name.message}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="contact-phone" className="sr-only">
                  Số điện thoại
                </label>
                <div className="relative">
                  <input
                    id="contact-phone"
                    {...register("phone")}
                    type="tel"
                    placeholder="Số điện thoại của bạn..."
                    aria-label="Số điện thoại"
                    aria-invalid={Boolean(errors.phone)}
                    className={`w-full bg-slate-50 border ${errors.phone ? "border-red-500 focus:ring-red-500" : "border-slate-200 focus:ring-primary"} text-slate-800 font-body px-4 py-4 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-shadow`}
                  />
                  <div
                    className={`absolute inset-y-0 right-3 flex items-center pointer-events-none ${errors.phone ? "text-red-500" : "text-slate-400"}`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      ></path>
                    </svg>
                  </div>
                </div>
                {errors.phone ? (
                  <p className="text-red-500 text-sm font-body mt-1 ml-1">{errors.phone.message}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="contact-service" className="sr-only">
                  Dịch vụ quan tâm
                </label>
                <select
                  id="contact-service"
                  {...register("serviceId")}
                  aria-label="Dịch vụ quan tâm"
                  aria-invalid={Boolean(errors.serviceId)}
                  className={`w-full bg-slate-50 border ${errors.serviceId ? "border-red-500 focus:ring-red-500" : "border-slate-200 focus:ring-primary"} text-slate-700 font-body px-4 py-4 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent appearance-none`}
                >
                  <option value="">-- Chọn dịch vụ cần tư vấn --</option>
                  {serviceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {errors.serviceId ? (
                  <p className="text-red-500 text-sm font-body mt-1 ml-1">{errors.serviceId.message}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="contact-message" className="sr-only">
                  Ghi chú thêm
                </label>
                <textarea
                  id="contact-message"
                  {...register("message")}
                  placeholder="Ghi chú thêm (tuỳ chọn)..."
                  rows={2}
                  aria-label="Ghi chú thêm"
                  className="w-full bg-slate-50 border border-slate-200 focus:ring-primary text-slate-800 font-body px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-shadow resize-none"
                />
              </div>

              {submitError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                  {submitError}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-slate-900 hover:bg-primary text-white font-heading font-bold text-lg py-4 rounded-xl transition-colors mt-2 shadow-md hover:shadow-glow-primary hover:-translate-y-1 transform disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-md flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Đang Gửi...
                  </>
                ) : (
                  "Gửi Yêu Cầu Tư Vấn"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
