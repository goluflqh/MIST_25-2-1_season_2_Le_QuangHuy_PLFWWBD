import Link from "next/link";
import { buildMarketingMetadata, siteConfig } from "@/lib/site";

export const metadata = buildMarketingMetadata({
  title: "Lắp Đặt Camera An Ninh",
  description:
    "Tư vấn giải pháp an ninh, thi công lắp đặt camera giám sát chất lượng cao. Khảo sát miễn phí tận nơi.",
  path: "/dich-vu/camera",
});

const features = [
  { icon: "🏠", title: "Camera Gia Đình", desc: "Giám sát nhà ở, sân vườn, cổng ngõ. Xem qua điện thoại 24/7." },
  { icon: "🏪", title: "Camera Cửa Hàng", desc: "Hệ thống đa góc nhìn, chống trộm AI thông minh, cảnh báo tức thì." },
  { icon: "🏭", title: "Camera Xưởng / Kho", desc: "Giải pháp công nghiệp cho xưởng sản xuất, kho bãi, bãi xe." },
  { icon: "🌙", title: "Quay Đêm Màu", desc: "Camera có đèn LED tích hợp, quay đêm full color, không dùng hồng ngoại." },
];

const benefits = [
  "Khảo sát tận nơi và tư vấn góc nhìn tối ưu — HOÀN TOÀN MIỄN PHÍ",
  "Thi công gọn gàng, đi dây chống nhiễu, đảm bảo thẩm mỹ",
  "Cài đặt ứng dụng xem camera qua điện thoại miễn phí",
  "Bảo hành kỹ thuật tận nơi 12-24 tháng tuỳ hãng",
  "Hỗ trợ lưu trữ đám mây hoặc đầu ghi NVR bảo mật",
  "Cảnh báo chống trộm AI thông minh, nhận diện khuôn mặt",
];

export default function CameraServicePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 animate-fade-in-up">
      {/* Hero */}
      <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 mb-12 border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-300 opacity-15 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-slate-400 opacity-10 rounded-full blur-2xl transform -translate-x-1/4 translate-y-1/2"></div>

        <div className="relative z-10 max-w-3xl">
          <span className="inline-block py-1 px-3 rounded-full bg-blue-50 text-blue-700 font-body font-semibold text-sm mb-4 border border-blue-200">
            📹 Giải Pháp An Ninh
          </span>
          <h1 className="font-heading font-extrabold text-4xl md:text-5xl text-slate-900 mb-6 leading-tight">
            Giám Sát 24/7 Với <span className="text-blue-600">Camera Công Nghệ Mới</span>
          </h1>
          <p className="font-body text-slate-600 text-lg mb-8 leading-relaxed">
            Giải pháp tối ưu cho gia đình, cửa hàng và xưởng sản xuất. Minh Hồng trực tiếp khảo sát, thiết kế sơ đồ đi dây chống nhiễu, đảm bảo thẩm mỹ và không có điểm mù.
          </p>
          <Link
            href="/?service=CAMERA&source=service-camera#quote"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-heading font-bold py-3 px-8 rounded-xl transition-colors shadow-md hover:shadow-lg"
          >
            Xem Bảng Giá Camera
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {features.map((f) => (
          <div key={f.title} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md hover:border-blue-200 transition-all">
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="font-heading font-bold text-slate-900 mb-2">{f.title}</h3>
            <p className="font-body text-sm text-slate-500">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Benefits */}
      <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-3xl p-8 md:p-12 border border-blue-100">
        <h2 className="font-heading font-extrabold text-2xl text-slate-900 mb-6">Ưu Điểm Dịch Vụ Camera Minh Hồng</h2>
        <ul className="space-y-4">
          {benefits.map((b, i) => (
            <li key={i} className="flex items-start gap-3 font-body text-slate-700">
              <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              {b}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap gap-4">
          <a href={siteConfig.hotlineHref} className="inline-flex items-center gap-2 bg-slate-900 text-white font-body font-bold py-3 px-6 rounded-xl hover:bg-slate-800 transition-colors">
            📞 Gọi {siteConfig.hotlineDisplay}
          </a>
          <Link href="/?service=CAMERA&source=service-camera#quote" className="inline-flex items-center gap-2 bg-white text-slate-900 border-2 border-slate-200 font-body font-bold py-3 px-6 rounded-xl hover:border-slate-300 transition-colors">
            📋 Yêu Cầu Khảo Sát
          </Link>
        </div>
      </div>
    </div>
  );
}
