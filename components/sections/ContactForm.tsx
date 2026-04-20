"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import * as z from "zod";
import { useAuth } from "@/components/AuthProvider";
import { getLeadSourceLabel } from "@/lib/lead-sources";
import { siteConfig } from "@/lib/site";

const serviceOptions = [
  { value: "DONG_PIN", label: "Đóng pin cho xe điện, máy công cụ, loa kéo" },
  { value: "DEN_NLMT", label: "Thay pin hoặc xử lý đèn năng lượng mặt trời" },
  { value: "PIN_LUU_TRU", label: "Pin lưu trữ, kích đề, nguồn dự phòng" },
  { value: "CAMERA", label: "Lắp đặt camera an ninh" },
  { value: "CUSTOM", label: "Đóng bình theo yêu cầu riêng" },
  { value: "KHAC", label: "Tư vấn trường hợp khác" },
] as const;

const serviceSuccessContent: Record<
  (typeof serviceOptions)[number]["value"],
  {
    eta: string;
    followUp: string;
    title: string;
  }
> = {
  DONG_PIN: {
    eta: "khoảng 10-15 phút",
    followUp: "thông số pin, dòng xả và phương án cell hoặc mạch phù hợp nhất",
    title: "Yêu cầu đóng pin đã vào hàng ưu tiên",
  },
  DEN_NLMT: {
    eta: "khoảng 10-15 phút",
    followUp: "thời lượng sáng, nhu cầu thay pin và phương án dùng ổn vào mùa mưa",
    title: "Yêu cầu đèn năng lượng mặt trời đã được ghi nhận",
  },
  PIN_LUU_TRU: {
    eta: "khoảng 10-20 phút",
    followUp: "điện áp, dung lượng và phương án đóng bộ pin theo nhu cầu thực tế",
    title: "Yêu cầu pin lưu trữ đã được tiếp nhận",
  },
  CAMERA: {
    eta: "khoảng 10-20 phút",
    followUp: "bố trí mắt camera, góc nhìn và lịch khảo sát nếu anh/chị cần lắp tận nơi",
    title: "Yêu cầu camera đã sẵn sàng để tư vấn",
  },
  CUSTOM: {
    eta: "khoảng 15-20 phút",
    followUp: "cấu hình riêng, kích thước bộ pin và chi tiết kỹ thuật cần làm theo yêu cầu",
    title: "Yêu cầu đóng bộ riêng đã được ghi nhận",
  },
  KHAC: {
    eta: "khoảng 10-15 phút",
    followUp: "nhu cầu cụ thể và phương án phù hợp nhất cho trường hợp của anh/chị",
    title: "Yêu cầu tư vấn đã được gửi thành công",
  },
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
type ServiceId = (typeof serviceOptions)[number]["value"];

function readTrackingValue(searchParams: { get(name: string): string | null }, key: string) {
  return searchParams.get(key) || "";
}

function getInitialServiceValue(serviceFromQuery: string) {
  return validServiceIds.has(serviceFromQuery as ServiceId) ? serviceFromQuery : "";
}

export default function ContactForm() {
  const { user } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedServiceId, setSubmittedServiceId] = useState<ServiceId | "">("");

  const serviceFromQuery = searchParams.get("service") || "";
  const messageFromQuery = searchParams.get("message") || "";
  const selectedSource = searchParams.get("source") || "homepage";
  const selectedSourceLabel = getLeadSourceLabel(selectedSource);
  const hasChatbotPrefill = selectedSource.startsWith("chatbot") && Boolean(messageFromQuery);

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
    const initialService = getInitialServiceValue(serviceFromQuery);
    if (initialService) {
      setValue("serviceId", initialService, { shouldValidate: true });
    }
  }, [serviceFromQuery, setValue]);

  useEffect(() => {
    if (messageFromQuery) {
      setValue("message", messageFromQuery);
    }
  }, [messageFromQuery, setValue]);

  const resetForNextRequest = () => {
    reset({
      name: "",
      phone: "",
      serviceId: getInitialServiceValue(serviceFromQuery),
      message: messageFromQuery,
    });
    setSubmitError(null);
    setSubmittedServiceId("");
  };

  const handleCloseSuccess = () => {
    setIsSuccess(false);
    setSubmitError(null);
  };

  const handleStartNewRequest = () => {
    resetForNextRequest();
    setIsSuccess(false);
  };

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
        setSubmitError(result?.message || "Hệ thống đang bận. Vui lòng thử lại sau ít phút.");
        return;
      }

      setSubmittedServiceId(
        validServiceIds.has(data.serviceId as ServiceId) ? (data.serviceId as ServiceId) : "KHAC"
      );
      setIsSuccess(true);
    } catch (err) {
      console.error("Contact form error:", err);
      setSubmitError("Không thể gửi yêu cầu lúc này. Vui lòng kiểm tra kết nối và thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const successServiceId =
    submittedServiceId && validServiceIds.has(submittedServiceId) ? submittedServiceId : "KHAC";
  const successContent = serviceSuccessContent[successServiceId];
  const successServiceLabel =
    serviceOptions.find((option) => option.value === successServiceId)?.label || "Tư vấn khác";

  return (
    <section id="quote" className="relative z-20 mx-auto mb-8 max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-[2.5rem] bg-[linear-gradient(135deg,#991b1b,#dc2626_45%,#f97316)] p-8 shadow-[0_40px_120px_-52px_rgba(127,29,29,0.65)] md:p-12">
        <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-10 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 h-48 w-48 -translate-x-1/4 translate-y-1/2 rounded-full bg-yellow-300 opacity-20 blur-2xl"></div>

        <div className="relative z-10 grid gap-10 md:grid-cols-[1fr_0.95fr] md:items-start">
          <div className="text-center text-white md:text-left">
            <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-red-50 backdrop-blur">
              Tư vấn theo từng trường hợp
            </div>
            <h2 className="mt-4 font-heading text-3xl font-extrabold leading-tight md:text-4xl">
              Nhận phương án phù hợp và báo giá nhanh, không cần chốt vội.
            </h2>
            <p className="mt-4 font-body text-lg leading-8 text-red-50/90">
              Để lại thông tin, anh Hồng cùng đội ngũ kỹ thuật sẽ gọi lại để hỏi rõ nhu cầu, kiểm
              tra trường hợp thực tế và tư vấn phương án phù hợp nhất trước khi bàn tới giá cuối.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-100">
                  Hotline trực tiếp
                </p>
                <p className="mt-2 font-heading text-2xl font-bold text-white">
                  {siteConfig.hotlineDisplay}
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-100">
                  Khung giờ tiếp nhận
                </p>
                <p className="mt-2 font-body text-sm font-semibold leading-6 text-white">
                  {siteConfig.businessHoursLabel}
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-100">
                  Khu vực hỗ trợ
                </p>
                <p className="mt-2 font-body text-sm font-semibold leading-6 text-white">
                  {siteConfig.locationLabel}
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-100">
                  Cách làm việc
                </p>
                <p className="mt-2 font-body text-sm font-semibold leading-6 text-white">
                  Kiểm tra trước, tư vấn rõ, rồi mới đề xuất phương án phù hợp.
                </p>
              </div>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md md:w-full">
            {isSuccess ? (
              <div
                data-testid="contact-success"
                className="animate-fade-in rounded-[2rem] border border-white/70 bg-white/95 p-8 text-center shadow-xl backdrop-blur"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                    Yêu cầu đã được ghi nhận
                  </div>
                  <button
                    data-testid="contact-success-close"
                    onClick={handleCloseSuccess}
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-600"
                    aria-label="Đóng thông báo thành công"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="mb-2 flex justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
                    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="3"
                        d="M5 13l4 4L19 7"
                      ></path>
                    </svg>
                  </div>
                </div>

                <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-body font-bold uppercase tracking-wide text-slate-500">
                  {successServiceLabel}
                </div>

                <h3 className="mt-4 font-heading text-2xl font-bold text-slate-800">
                  {successContent.title}
                </h3>
                <p className="mt-3 font-body text-slate-600">
                  Cảm ơn anh/chị. Đội ngũ Minh Hồng sẽ gọi lại trong {successContent.eta} để trao
                  đổi rõ hơn về {successContent.followUp}.
                </p>

                <div className="mt-5 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left">
                  <p className="mb-2 font-body text-sm font-bold text-slate-700">
                    Bước tiếp theo anh/chị có thể chuẩn bị:
                  </p>
                  <ul className="space-y-2 font-body text-sm text-slate-600">
                    <li>1. Giữ máy giúp em để kỹ thuật gọi xác nhận nhanh.</li>
                    <li>2. Nếu có ảnh thiết bị hoặc mẫu cần làm, anh/chị có thể gửi thêm qua Zalo.</li>
                    <li>3. Em sẽ ưu tiên tư vấn đúng nhu cầu trước, rồi mới chốt giá chi tiết.</li>
                  </ul>
                </div>

                <div className="mt-5 grid w-full gap-3 sm:grid-cols-2">
                  <a
                    href={siteConfig.zaloUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-body font-bold text-white transition-colors hover:bg-blue-500"
                  >
                    Gửi ảnh qua Zalo
                  </a>
                  <a
                    href={siteConfig.hotlineHref}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-body font-bold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Gọi {siteConfig.hotlineDisplay}
                  </a>
                </div>

                {user ? (
                  <div className="mt-5 w-full rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="mb-2 font-body text-sm text-emerald-800">
                      Anh/chị đã có tài khoản rồi, có thể theo dõi lại yêu cầu ngay trong mục tài
                      khoản.
                    </p>
                    <Link
                      href="/tai-khoan"
                      className="inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-body font-bold text-white transition-colors hover:bg-emerald-500"
                    >
                      Xem tài khoản →
                    </Link>
                  </div>
                ) : (
                  <div className="mt-5 w-full rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                    <p className="mb-2 font-body text-sm text-yellow-800">
                      Tạo tài khoản miễn phí để theo dõi trạng thái yêu cầu, lịch sử dịch vụ và nhận
                      ưu đãi về sau.
                    </p>
                    <Link
                      href="/dang-ky"
                      className="inline-block rounded-lg bg-yellow-500 px-4 py-2 text-sm font-body font-bold text-slate-900 transition-colors hover:bg-yellow-600"
                    >
                      Đăng ký miễn phí →
                    </Link>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <button
                    data-testid="contact-success-back"
                    onClick={handleCloseSuccess}
                    type="button"
                    className="rounded-lg border border-slate-200 px-5 py-2 font-body text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Quay lại form
                  </button>
                  <button
                    data-testid="contact-success-new-request"
                    onClick={handleStartNewRequest}
                    type="button"
                    className="rounded-lg bg-slate-100 px-5 py-2 font-body text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200"
                  >
                    Gửi yêu cầu khác
                  </button>
                  <Link
                    href="/bao-gia"
                    className="rounded-lg border border-slate-200 px-5 py-2 font-body text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Xem bảng giá
                  </Link>
                </div>
              </div>
            ) : (
              <form
                data-testid="contact-form"
                onSubmit={handleSubmit(onSubmit)}
                className="flex flex-col gap-4 rounded-[2rem] border border-white/70 bg-white/95 p-6 shadow-xl backdrop-blur"
                noValidate
              >
                <div
                  data-testid="contact-source-card"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <p className="font-body text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Nguồn lead
                  </p>
                  <p data-testid="contact-source-label" className="font-body text-sm font-bold text-slate-700">
                    {selectedSourceLabel}
                  </p>
                  {selectedServiceLabel ? (
                    <p className="mt-1 font-body text-xs text-slate-500">
                      Đang ưu tiên tư vấn cho: {selectedServiceLabel}
                    </p>
                  ) : null}
                  {hasChatbotPrefill ? (
                    <p className="mt-2 font-body text-xs text-slate-500">
                      Mô tả từ chatbot đã được mang sẵn sang đây, anh/chị chỉ cần sửa lại nếu muốn.
                    </p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor="contact-name" className="sr-only">
                    Họ và tên
                  </label>
                  <input
                    data-testid="contact-name"
                    id="contact-name"
                    {...register("name")}
                    type="text"
                    placeholder="Họ tên của bạn..."
                    aria-label="Họ và tên"
                    aria-invalid={Boolean(errors.name)}
                    className={`w-full rounded-xl border px-4 py-4 font-body text-slate-800 transition-shadow focus:border-transparent focus:outline-none focus:ring-2 ${
                      errors.name
                        ? "border-red-500 focus:ring-red-500"
                        : "border-slate-200 bg-slate-50 focus:ring-primary"
                    }`}
                  />
                  {errors.name ? (
                    <p className="ml-1 mt-1 font-body text-sm text-red-500">{errors.name.message}</p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor="contact-phone" className="sr-only">
                    Số điện thoại
                  </label>
                  <div className="relative">
                    <input
                      data-testid="contact-phone"
                      id="contact-phone"
                      {...register("phone")}
                      type="tel"
                      placeholder="Số điện thoại của bạn..."
                      aria-label="Số điện thoại"
                      aria-invalid={Boolean(errors.phone)}
                      className={`w-full rounded-xl border px-4 py-4 font-body text-slate-800 transition-shadow focus:border-transparent focus:outline-none focus:ring-2 ${
                        errors.phone
                          ? "border-red-500 focus:ring-red-500"
                          : "border-slate-200 bg-slate-50 focus:ring-primary"
                      }`}
                    />
                    <div
                      className={`pointer-events-none absolute inset-y-0 right-3 flex items-center ${
                        errors.phone ? "text-red-500" : "text-slate-400"
                      }`}
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    <p className="ml-1 mt-1 font-body text-sm text-red-500">{errors.phone.message}</p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor="contact-service" className="sr-only">
                    Dịch vụ quan tâm
                  </label>
                  <select
                    data-testid="contact-service"
                    id="contact-service"
                    {...register("serviceId")}
                    aria-label="Dịch vụ quan tâm"
                    aria-invalid={Boolean(errors.serviceId)}
                    className={`w-full appearance-none rounded-xl border px-4 py-4 font-body text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 ${
                      errors.serviceId
                        ? "border-red-500 focus:ring-red-500"
                        : "border-slate-200 bg-slate-50 focus:ring-primary"
                    }`}
                  >
                    <option value="">-- Chọn dịch vụ cần tư vấn --</option>
                    {serviceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {errors.serviceId ? (
                    <p className="ml-1 mt-1 font-body text-sm text-red-500">
                      {errors.serviceId.message}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor="contact-message" className="sr-only">
                    Ghi chú thêm
                  </label>
                  <textarea
                    data-testid="contact-message"
                    id="contact-message"
                    {...register("message")}
                    placeholder="Ghi chú thêm (tuỳ chọn)..."
                    rows={2}
                    aria-label="Ghi chú thêm"
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-body text-slate-800 transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {submitError ? (
                  <div
                    data-testid="contact-error"
                    className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                    role="alert"
                  >
                    {submitError}
                  </div>
                ) : null}

                <button
                  data-testid="contact-submit"
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-4 font-heading text-lg font-bold text-white shadow-md transition-colors hover:bg-primary hover:shadow-glow-primary disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="-ml-1 mr-2 h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Đang gửi...
                    </>
                  ) : (
                    "Gửi yêu cầu tư vấn"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
