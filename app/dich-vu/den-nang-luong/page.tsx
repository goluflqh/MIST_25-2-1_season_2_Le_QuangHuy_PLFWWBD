import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Đèn Năng Lượng Mặt Trời | Minh Hồng",
  description: "Đóng pin, lắp ráp đèn năng lượng mặt trời tại nhà. Pin lưu trữ NLMT chất lượng cao, bền bỉ.",
};

const features = [
  { icon: "☀️", title: "Pin Đèn NLMT", desc: "Đóng mới & thay cell pin đèn năng lượng mặt trời mọi loại" },
  { icon: "🔋", title: "Pin Lưu Trữ", desc: "Pin lưu trữ năng lượng mặt trời cho hệ thống điện gia đình" },
  { icon: "🏠", title: "Lắp Tại Nhà", desc: "Thi công lắp đặt đèn NLMT sân vườn, đường đi, cổng nhà" },
  { icon: "💡", title: "Đèn Pha LED", desc: "Đèn pha năng lượng mặt trời công suất lớn cho sân bãi, kho" },
];

const benefits = [
  "Tiết kiệm điện 100% — hoạt động hoàn toàn bằng năng lượng mặt trời",
  "Tự động bật/tắt theo ánh sáng, không cần đi dây điện",
  "Pin Lithium chính hãng, tuổi thọ 3-5 năm",
  "Chống nước IP65-IP67, chịu mưa gió khắc nghiệt",
  "Bảo hành pin 6-12 tháng, bảo dưỡng trọn đời",
];

export default function SolarLightPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 animate-fade-in-up">
      {/* Hero */}
      <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 mb-12 border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-300 opacity-15 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-400 opacity-10 rounded-full blur-2xl transform -translate-x-1/4 translate-y-1/2"></div>

        <div className="relative z-10 max-w-3xl">
          <span className="inline-block py-1 px-3 rounded-full bg-yellow-50 text-yellow-700 font-body font-semibold text-sm mb-4 border border-yellow-200">
            ☀️ Năng Lượng Xanh
          </span>
          <h1 className="font-heading font-extrabold text-4xl md:text-5xl text-slate-900 mb-6 leading-tight">
            Đèn <span className="text-yellow-600">Năng Lượng Mặt Trời</span> & Pin Lưu Trữ
          </h1>
          <p className="font-body text-slate-600 text-lg mb-8 leading-relaxed">
            Minh Hồng chuyên đóng pin, thay cell và lắp đặt đèn năng lượng mặt trời cho gia đình, sân vườn, cổng ngõ, kho bãi. Sử dụng cell Lithium chính hãng, đảm bảo độ sáng và tuổi thọ vượt trội.
          </p>
          <Link
            href="/?service=DEN_NLMT&source=service-den-nlmt#quote"
            className="inline-block bg-yellow-500 hover:bg-yellow-600 text-white font-heading font-bold py-3 px-8 rounded-xl transition-colors shadow-md hover:shadow-lg"
          >
            Nhận Báo Giá Ngay
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {features.map((f) => (
          <div key={f.title} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md hover:border-yellow-200 transition-all">
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="font-heading font-bold text-slate-900 mb-2">{f.title}</h3>
            <p className="font-body text-sm text-slate-500">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Benefits */}
      <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-3xl p-8 md:p-12 border border-yellow-100">
        <h2 className="font-heading font-extrabold text-2xl text-slate-900 mb-6">Tại Sao Chọn Đèn NLMT?</h2>
        <ul className="space-y-4">
          {benefits.map((b, i) => (
            <li key={i} className="flex items-start gap-3 font-body text-slate-700">
              <svg className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              {b}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap gap-4">
          <a href="tel:0987443258" className="inline-flex items-center gap-2 bg-slate-900 text-white font-body font-bold py-3 px-6 rounded-xl hover:bg-slate-800 transition-colors">
            📞 Gọi 0987.443.258
          </a>
          <Link href="/?service=DEN_NLMT&source=service-den-nlmt#quote" className="inline-flex items-center gap-2 bg-white text-slate-900 border-2 border-slate-200 font-body font-bold py-3 px-6 rounded-xl hover:border-slate-300 transition-colors">
            📋 Yêu Cầu Báo Giá
          </Link>
        </div>
      </div>
    </div>
  );
}
