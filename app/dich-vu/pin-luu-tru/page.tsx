import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pin Lưu Trữ & Kích Đề | Minh Hồng",
  description: "Đóng pin lưu trữ năng lượng, pin kích đề ô tô, pin dự phòng dung lượng lớn. Đóng theo yêu cầu riêng.",
};

const products = [
  {
    icon: "🚗",
    title: "Pin Kích Đề Ô Tô",
    desc: "Đóng pin kích đề cho ô tô, xe tải. Dung lượng lớn, dòng xả cao, khởi động tức thì.",
    specs: ["Điện áp: 12V-24V", "Dòng xả đỉnh: 300A-800A", "Cell: Lithium chính hãng"],
  },
  {
    icon: "⚡",
    title: "Pin Lưu Trữ Năng Lượng",
    desc: "Hệ thống pin lưu trữ cho điện mặt trời, UPS gia đình, lưu điện dự phòng khi mất điện.",
    specs: ["Dung lượng: 50Ah-200Ah+", "BMS thông minh", "Tuổi thọ 2000+ chu kỳ"],
  },
  {
    icon: "🔌",
    title: "Pin Dự Phòng Dung Lượng Lớn",
    desc: "Powerbank cỡ lớn cho thiết bị công nghiệp, máy quay, thiết bị y tế, camping outdoor.",
    specs: ["Dung lượng: 20.000-100.000mAh", "Output: USB-C, DC", "Sạc nhanh QC/PD"],
  },
  {
    icon: "🔧",
    title: "Đóng Bình Theo Yêu Cầu",
    desc: "Nhận đóng bất kỳ loại pin nào theo thông số kỹ thuật khách yêu cầu. Custom kích thước, dung lượng, đầu cắm.",
    specs: ["Thiết kế PCB/BMS riêng", "Đóng gói công nghiệp", "Bảo hành 12 tháng"],
  },
];

export default function StorageBatteryPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 animate-fade-in-up">
      {/* Hero */}
      <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 mb-12 border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-green-300 opacity-15 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>

        <div className="relative z-10 max-w-3xl">
          <span className="inline-block py-1 px-3 rounded-full bg-green-50 text-green-700 font-body font-semibold text-sm mb-4 border border-green-200">
            ⚡ Năng Lượng Dự Trữ
          </span>
          <h1 className="font-heading font-extrabold text-4xl md:text-5xl text-slate-900 mb-6 leading-tight">
            Pin <span className="text-green-600">Lưu Trữ</span>, Kích Đề & Dự Phòng
          </h1>
          <p className="font-body text-slate-600 text-lg mb-8 leading-relaxed">
            Minh Hồng chuyên đóng ráp pin lưu trữ năng lượng, pin kích đề ô tô, pin dự phòng công suất lớn. Nhận thiết kế và đóng bình pin theo mọi yêu cầu kỹ thuật của khách hàng.
          </p>
          <Link
            href="/?service=PIN_LUU_TRU&source=service-pin-luu-tru#quote"
            className="inline-block bg-green-600 hover:bg-green-700 text-white font-heading font-bold py-3 px-8 rounded-xl transition-colors shadow-md hover:shadow-lg"
          >
            Nhận Báo Giá Ngay
          </Link>
        </div>
      </div>

      {/* Products */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        {products.map((p) => (
          <div key={p.title} className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 hover:shadow-lg hover:border-green-200 transition-all">
            <div className="text-4xl mb-4">{p.icon}</div>
            <h3 className="font-heading font-bold text-xl text-slate-900 mb-3">{p.title}</h3>
            <p className="font-body text-slate-600 mb-4">{p.desc}</p>
            <ul className="space-y-2">
              {p.specs.map((s, i) => (
                <li key={i} className="flex items-center gap-2 font-body text-sm text-slate-500">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full shrink-0"></span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-8 text-center">
        <h2 className="font-heading font-extrabold text-2xl text-white mb-3">Cần đóng pin theo yêu cầu riêng?</h2>
        <p className="font-body text-slate-300 mb-6">Gửi thông số kỹ thuật hoặc gọi hotline để được tư vấn miễn phí</p>
        <div className="flex flex-wrap justify-center gap-4">
          <a href="tel:0987443258" className="inline-flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-heading font-bold py-3 px-6 rounded-xl transition-colors">
            📞 Gọi 0987.443.258
          </a>
          <Link href="/?service=PIN_LUU_TRU&source=service-pin-luu-tru#quote" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-heading font-bold py-3 px-6 rounded-xl transition-colors">
            📋 Gửi Yêu Cầu Báo Giá
          </Link>
        </div>
      </div>
    </div>
  );
}
