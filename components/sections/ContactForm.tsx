"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";

const formSchema = z.object({
  name: z.string().min(2, { message: "Vui lòng nhập họ tên" }),
  phone: z.string().regex(/^(0|\+84)[3|5|7|8|9][0-9]{8}$/, {
    message: "Số điện thoại không hợp lệ (Ví dụ: 0987123456)",
  }),
  serviceId: z.string().min(1, { message: "Vui lòng chọn dịch vụ quan tâm" }),
  message: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function ContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          phone: data.phone,
          service: data.serviceId,
          message: data.message || "",
        }),
      });

      if (res.ok) {
        setIsSuccess(true);
        reset();
        setTimeout(() => setIsSuccess(false), 8000);
      }
    } catch (err) {
      console.error("Contact form error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="quote" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 mb-8 relative z-20">
      <div className="bg-gradient-to-br from-red-600 to-orange-500 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-10">
        {/* Abstract Deco */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-yellow-400 opacity-20 rounded-full blur-2xl transform -translate-x-1/4 translate-y-1/2"></div>

        <div className="relative z-10 md:w-1/2 text-white text-center md:text-left">
          <h2 className="font-heading font-extrabold text-3xl md:text-4xl mb-4 leading-tight">
            Cần Tư Vấn Thiết Bị & Báo Giá Nhanh?
          </h2>
          <p className="font-body text-red-100 text-lg mb-0">
            Vui lòng để lại thông tin, anh Hồng cùng đội ngũ kỹ thuật sẽ sớm liên hệ
            phân tích giải pháp tối ưu và báo giá chi tiết, minh bạch nhất cho
            bạn.
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
                Cảm ơn bạn. Đội ngũ kỹ thuật Minh Hồng sẽ liên hệ lại qua số điện thoại bạn vừa cung cấp trong ít phút nữa.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 w-full">
                <p className="font-body text-sm text-yellow-800 mb-2">💡 <b>Tạo tài khoản</b> để theo dõi trạng thái yêu cầu & đánh giá dịch vụ!</p>
                <a href="/dang-ky" className="inline-block px-4 py-2 bg-yellow-500 text-slate-900 rounded-lg font-body font-bold text-sm hover:bg-yellow-600 transition-colors">
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
            <form onSubmit={handleSubmit(onSubmit)} className="bg-white p-6 rounded-3xl shadow-xl flex flex-col gap-4">
              {/* Name */}
              <div>
                <input
                  {...register("name")}
                  type="text"
                  placeholder="Họ tên của bạn..."
                  className={`w-full bg-slate-50 border ${errors.name ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-primary'} text-slate-800 font-body px-4 py-4 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-shadow`}
                />
                {errors.name && <p className="text-red-500 text-sm font-body mt-1 ml-1">{errors.name.message}</p>}
              </div>

              {/* Phone */}
              <div>
                <div className="relative">
                  <input
                    {...register("phone")}
                    type="tel"
                    placeholder="Số điện thoại của bạn..."
                    className={`w-full bg-slate-50 border ${errors.phone ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-primary'} text-slate-800 font-body px-4 py-4 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-shadow`}
                  />
                  <div className={`absolute inset-y-0 right-3 flex items-center pointer-events-none ${errors.phone ? 'text-red-500' : 'text-slate-400'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
                    </svg>
                  </div>
                </div>
                {errors.phone && <p className="text-red-500 text-sm font-body mt-1 ml-1">{errors.phone.message}</p>}
              </div>
              
              {/* Service */}
              <div>
                <select
                  {...register("serviceId")}
                  className={`w-full bg-slate-50 border ${errors.serviceId ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-primary'} text-slate-700 font-body px-4 py-4 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent appearance-none`}
                >
                  <option value="">-- Chọn dịch vụ cần tư vấn --</option>
                  <option value="DONG_PIN">🔋 Đóng Pin (xe điện, máy công cụ, loa kéo)</option>
                  <option value="DEN_NLMT">☀️ Đèn Năng Lượng Mặt Trời</option>
                  <option value="PIN_LUU_TRU">⚡ Pin Lưu Trữ / Kích Đề / Dự Phòng</option>
                  <option value="CAMERA">📹 Lắp Đặt Camera An Ninh</option>
                  <option value="CUSTOM">🔧 Đóng Bình Theo Yêu Cầu Riêng</option>
                  <option value="KHAC">📞 Tư Vấn Khác</option>
                </select>
                {errors.serviceId && <p className="text-red-500 text-sm font-body mt-1 ml-1">{errors.serviceId.message}</p>}
              </div>

              {/* Message (optional) */}
              <textarea
                {...register("message")}
                placeholder="Ghi chú thêm (tuỳ chọn)..."
                rows={2}
                className="w-full bg-slate-50 border border-slate-200 focus:ring-primary text-slate-800 font-body px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-shadow resize-none"
              />

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-slate-900 hover:bg-primary text-white font-heading font-bold text-lg py-4 rounded-xl transition-colors mt-2 shadow-md hover:shadow-glow-primary hover:-translate-y-1 transform disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-md flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
