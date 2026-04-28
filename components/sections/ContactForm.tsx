"use client";

import { useEffect, useRef, useState } from "react";
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

interface ContactCouponOption {
  id: string;
  redemptionId: string | null;
  redemptionStatus: "AVAILABLE" | "OWNED" | "PENDING";
  code: string;
  description: string;
  discount: string;
  pointsCost: number;
  remainingUses: number;
  expiresAtLabel: string | null;
}

function getCouponSelectionValue(coupon: ContactCouponOption) {
  return coupon.redemptionId ? `redemption:${coupon.redemptionId}` : `coupon:${coupon.id}`;
}

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
  const [couponOptions, setCouponOptions] = useState<ContactCouponOption[]>([]);
  const [selectedCouponValue, setSelectedCouponValue] = useState("");
  const lastProfileAutofillRef = useRef<{ name: string; phone: string } | null>(null);

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
    getValues,
    setValue,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      phone: "",
      serviceId: getInitialServiceValue(serviceFromQuery),
      message: messageFromQuery,
    },
  });

  const selectedServiceId = watch("serviceId");
  const selectedServiceLabel =
    serviceOptions.find((option) => option.value === selectedServiceId)?.label || "";
  const selectedCoupon = couponOptions.find((coupon) => getCouponSelectionValue(coupon) === selectedCouponValue) || null;

  useEffect(() => {
    if (!user) {
      setCouponOptions([]);
      setSelectedCouponValue("");
      return;
    }

    let cancelled = false;
    fetch("/api/coupons/owned")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled && data.success && Array.isArray(data.coupons)) {
          setCouponOptions(data.coupons);
        }
      })
      .catch(() => {
        if (!cancelled) setCouponOptions([]);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

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

  useEffect(() => {
    if (!user?.phone) return;

    const previousAutofill = lastProfileAutofillRef.current;
    const currentName = getValues("name").trim();
    const currentPhone = getValues("phone").trim();
    const shouldFillName = !currentName || currentName === previousAutofill?.name;
    const shouldFillPhone = !currentPhone || currentPhone === previousAutofill?.phone;

    if (shouldFillName) {
      setValue("name", user.name, { shouldValidate: Boolean(currentName) });
    }
    if (shouldFillPhone) {
      setValue("phone", user.phone, { shouldValidate: Boolean(currentPhone) });
    }

    lastProfileAutofillRef.current = { name: user.name, phone: user.phone };
  }, [getValues, setValue, user?.name, user?.phone]);

  const getDefaultFormValues = () => ({
    name: user?.name || "",
    phone: user?.phone || "",
    serviceId: getInitialServiceValue(serviceFromQuery),
    message: messageFromQuery,
  });

  const resetForNextRequest = () => {
    reset(getDefaultFormValues());
    setSubmitError(null);
    setSubmittedServiceId("");
    setSelectedCouponValue("");
  };

  const handleCloseSuccess = () => {
    setIsSuccess(false);
    setSubmitError(null);
  };

  const handleStartNewRequest = () => {
    resetForNextRequest();
    setIsSuccess(false);
  };

  const getSelectedCouponRedemptionId = async () => {
    if (!selectedCoupon) return null;
    if (selectedCoupon.redemptionStatus === "OWNED" && selectedCoupon.redemptionId) {
      return selectedCoupon.redemptionId;
    }

    if (selectedCoupon.redemptionStatus !== "AVAILABLE") return null;

    const response = await fetch("/api/coupons/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ couponId: selectedCoupon.id }),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.success || !data.coupon?.redemptionId) {
      throw new Error(data?.message || "Chưa đổi được mã ưu đãi này.");
    }

    setCouponOptions((prev) => prev.map((coupon) => (
      coupon.id === selectedCoupon.id
        ? { ...coupon, ...data.coupon, redemptionStatus: "OWNED" }
        : coupon
    )));

    return data.coupon.redemptionId as string;
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const sourcePath =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

      const couponRedemptionId = await getSelectedCouponRedemptionId();
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          phone: data.phone,
          service: data.serviceId,
          message: data.message || "",
          couponRedemptionId,
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
      if (selectedCouponValue) {
        setCouponOptions((prev) => prev.filter((coupon) => (
          getCouponSelectionValue(coupon) !== selectedCouponValue && coupon.id !== selectedCoupon?.id
        )));
        setSelectedCouponValue("");
      }
      setIsSuccess(true);
    } catch (err) {
      console.error("Contact form error:", err);
      setSubmitError(err instanceof Error ? err.message : "Không thể gửi yêu cầu lúc này. Vui lòng kiểm tra kết nối và thử lại.");
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
      <div className="relative overflow-hidden rounded-[2rem] border border-orange-100 bg-[linear-gradient(160deg,#fff7ed,#ffffff_48%,#fffaf5)] p-6 shadow-[0_30px_100px_-56px_rgba(15,23,42,0.35)] md:p-10">
        <div className="relative z-10 grid gap-8 md:grid-cols-[0.95fr_1fr] md:items-start">
          <div className="text-left">
            <div className="inline-flex rounded-full border border-red-100 bg-red-50 px-3 py-1 text-sm font-semibold text-primary">
              Tư vấn theo từng trường hợp
            </div>
            <h2 className="mt-4 text-pretty font-heading text-3xl font-extrabold leading-tight text-slate-900 md:text-4xl">
              Nhận phương án phù hợp và báo giá nhanh, không cần chốt vội.
            </h2>
            <p className="mt-4 font-body text-base leading-8 text-slate-600 md:text-lg">
              Để lại thông tin, Minh Hồng sẽ gọi lại để hỏi rõ nhu cầu, kiểm tra trường hợp
              thực tế và đề xuất phương án hợp lý trước khi bàn tới giá cuối.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.45rem] border border-white bg-white/92 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Hotline trực tiếp
                </p>
                <p className="mt-2 font-heading text-2xl font-bold text-slate-900">
                  {siteConfig.hotlineDisplay}
                </p>
              </div>
              <div className="rounded-[1.45rem] border border-white bg-white/92 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Khung giờ tiếp nhận
                </p>
                <p className="mt-2 font-body text-sm font-semibold leading-6 text-slate-800">
                  {siteConfig.businessHoursLabel}
                </p>
              </div>
              <div className="rounded-[1.45rem] border border-white bg-white/92 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Địa chỉ cửa hàng
                </p>
                <p className="mt-2 font-body text-sm font-semibold leading-6 text-slate-800">
                  {siteConfig.locationLabel}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-[1.6rem] border border-slate-200 bg-slate-900 p-5 text-white shadow-[0_24px_70px_-40px_rgba(15,23,42,0.48)]">
              <p className="text-sm font-semibold text-red-200">
                Cách Minh Hồng xử lý yêu cầu
              </p>
              <ul className="mt-3 space-y-2 font-body text-sm leading-6 text-slate-200">
                <li>1. Hỏi rõ thiết bị, tình trạng hoặc vị trí cần lắp.</li>
                <li>2. Nói trước phần cần làm, phần có thể chờ và mức chi phí dự kiến.</li>
                <li>3. Chỉ chốt phương án khi khách đã hiểu rõ.</li>
              </ul>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg md:w-full">
            {isSuccess ? (
              <div
                data-testid="contact-success"
                className="animate-fade-in rounded-[2rem] border border-white bg-white/96 p-8 text-center shadow-xl backdrop-blur"
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
                className="flex flex-col gap-4 rounded-[2rem] border border-white bg-white/96 p-6 shadow-[0_26px_80px_-46px_rgba(15,23,42,0.35)] backdrop-blur"
                noValidate
              >
                <div
                  data-testid="contact-source-card"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <p className="font-body text-xs font-semibold text-slate-500">
                    Nguồn liên hệ
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
                  <label htmlFor="contact-name" className="mb-2 block font-body text-sm font-semibold text-slate-700">
                    Họ và tên
                  </label>
                  <input
                    data-testid="contact-name"
                    id="contact-name"
                    {...register("name")}
                    type="text"
                    placeholder="Ví dụ: Nguyễn Văn A"
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
                  <label htmlFor="contact-phone" className="mb-2 block font-body text-sm font-semibold text-slate-700">
                    Số điện thoại
                  </label>
                  <div className="relative">
                    <input
                      data-testid="contact-phone"
                      id="contact-phone"
                      {...register("phone")}
                      type="tel"
                      placeholder="Ví dụ: 0987 443 258"
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
                  <label htmlFor="contact-service" className="mb-2 block font-body text-sm font-semibold text-slate-700">
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
                  <label htmlFor="contact-message" className="mb-2 block font-body text-sm font-semibold text-slate-700">
                    Ghi chú thêm
                  </label>
                  <textarea
                    data-testid="contact-message"
                    id="contact-message"
                    {...register("message")}
                    placeholder="Ví dụ: thiết bị đang gặp lỗi gì, cần lắp ở đâu, muốn dùng trong bao lâu..."
                    rows={3}
                    aria-label="Ghi chú thêm"
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-body text-slate-800 transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {user ? (
                  <label className="block">
                    <span className="mb-2 block font-body text-sm font-semibold text-slate-700">
                      Mã giảm giá muốn áp dụng
                    </span>
                    {couponOptions.length > 0 ? (
                      <select
                        value={selectedCouponValue}
                        onChange={(event) => setSelectedCouponValue(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 font-body text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                        title="Mã giảm giá muốn áp dụng"
                      >
                        <option value="">Không áp dụng mã</option>
                        {couponOptions.map((coupon) => (
                          <option key={getCouponSelectionValue(coupon)} value={getCouponSelectionValue(coupon)}>
                            {coupon.redemptionStatus === "AVAILABLE" ? "Đổi & áp dụng: " : ""}
                            {coupon.code} - giảm {coupon.discount}
                            {coupon.expiresAtLabel ? ` - hạn ${coupon.expiresAtLabel}` : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 font-body text-sm text-slate-500">
                        Hiện chưa có mã đủ điều kiện áp dụng cho tài khoản này.
                      </div>
                    )}
                    {selectedCoupon ? (
                      <p className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 font-body text-xs text-emerald-800">
                        {selectedCoupon.description}
                        {selectedCoupon.redemptionStatus === "AVAILABLE"
                          ? ` Mã này sẽ tự đổi bằng ${selectedCoupon.pointsCost} điểm rồi áp dụng vào yêu cầu.`
                          : ""}
                      </p>
                    ) : null}
                  </label>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="font-body text-sm font-semibold text-slate-700">Mã giảm giá</p>
                    <p className="mt-1 font-body text-sm text-slate-500">
                      Đăng nhập tài khoản để đổi điểm và áp dụng mã ưu đãi khi gửi yêu cầu.
                    </p>
                    <Link href="/dang-nhap" className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-body font-bold text-white">
                      Đăng nhập để dùng mã
                    </Link>
                  </div>
                )}

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
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-4 font-heading text-lg font-bold text-white shadow-md transition-colors hover:bg-primary disabled:opacity-70"
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
