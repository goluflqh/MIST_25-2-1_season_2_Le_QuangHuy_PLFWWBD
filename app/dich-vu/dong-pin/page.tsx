import Link from "next/link";
import { ServicePreviewCatalog } from "@/components/service/ServicePreviewCatalog";
import { batteryPreviewItems } from "@/lib/service-previews";
import { buildMarketingMetadata, siteConfig } from "@/lib/site";

export const metadata = buildMarketingMetadata({
  title: "Đóng Pin Lithium Chuyên Nghiệp",
  description:
    "Dịch vụ đóng ráp, phục hồi pin Lithium cho xe điện, máy công cụ, loa kéo. Cell chính hãng, bảo hành dài hạn.",
  path: "/dich-vu/dong-pin",
});

const products = [
  { icon: "🛵", title: "Pin Xe Điện", desc: "Xe đạp điện, xe máy điện. Cell Samsung/LG chính hãng, dung lượng cao." },
  { icon: "🔨", title: "Pin Máy Công Cụ", desc: "Máy khoan, máy cắt, máy mài, bắn vít. Đóng mới & phục hồi." },
  { icon: "🔊", title: "Pin Loa Kéo", desc: "Nâng cấp dung lượng, kéo dài thời gian sử dụng cho mọi hãng loa." },
  { icon: "💻", title: "Pin Laptop", desc: "Thay cell pin laptop Dell, HP, Asus, Lenovo, Macbook. BH 6 tháng." },
];

const advantages = [
  "Sử dụng Cell pin chính hãng Samsung, LG, EVE — không dùng hàng tháo",
  "Mạch bảo vệ BMS thông minh, chống quá sạc, quá xả, quá nhiệt",
  "Test dòng xả bằng máy tính vi mạch chuyên dụng trước khi giao",
  "Bảo hành lỗi 1 đổi 1 tới 12 tháng, bảo dưỡng cân bằng cell trọn đời",
  "Nhận đóng bình pin theo mọi yêu cầu kỹ thuật của khách",
];

export default function BatteryServicePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 animate-fade-in-up">
      {/* Hero */}
      <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 mb-12 border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-300 opacity-15 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-yellow-400 opacity-10 rounded-full blur-2xl transform -translate-x-1/4 translate-y-1/2"></div>

        <div className="relative z-10 max-w-3xl">
          <span className="inline-block py-1 px-3 rounded-full bg-red-50 text-red-600 font-body font-semibold text-sm mb-4 border border-red-100">
            🔋 Dịch Vụ Trọng Tâm
          </span>
          <h1 className="font-heading font-extrabold text-4xl md:text-5xl text-slate-900 mb-6 leading-tight">
            Chuyên Gia <span className="text-red-600">Phục Hồi & Đóng Mới</span> Pin Lithium
          </h1>
          <p className="font-body text-slate-600 text-lg mb-8 leading-relaxed">
            Minh Hồng tự hào sở hữu đội ngũ kỹ thuật lành nghề, trang thiết bị đo đạc dòng xả chuyên dụng. Chúng tôi nhận phục hồi cell pin hỏng, nâng dung lượng, đóng khối mới cho mọi thiết bị.
          </p>
          <Link
            href="/?service=DONG_PIN&source=service-dong-pin#quote"
            className="inline-block bg-red-600 hover:bg-red-700 text-white font-heading font-bold py-3 px-8 rounded-xl transition-colors shadow-md hover:shadow-lg"
          >
            Xem Bảng Giá
          </Link>
        </div>
      </div>

      <ServicePreviewCatalog
        accent="red"
        eyebrow="Mẫu cấu hình để xem trước"
        title="Khách có thể xem nhanh các bộ pin được đặt nhiều"
        description="Đây là các mẫu tham khảo để anh chị hình dung kích thước, nhóm thiết bị và mức đầu tư. Minh Hồng sẽ cân chỉnh lại cell, mạch và vỏ theo đúng nhu cầu thực tế trước khi chốt."
        items={batteryPreviewItems}
      />

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {products.map((p) => (
          <div key={p.title} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md hover:border-red-200 transition-all">
            <div className="text-3xl mb-3">{p.icon}</div>
            <h3 className="font-heading font-bold text-slate-900 mb-2">{p.title}</h3>
            <p className="font-body text-sm text-slate-500">{p.desc}</p>
          </div>
        ))}
      </div>

      {/* Advantages */}
      <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-3xl p-8 md:p-12 border border-red-100">
        <h2 className="font-heading font-extrabold text-2xl text-slate-900 mb-6">Tại Sao Chọn Minh Hồng?</h2>
        <ul className="space-y-4">
          {advantages.map((a, i) => (
            <li key={i} className="flex items-start gap-3 font-body text-slate-700">
              <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              {a}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap gap-4">
          <a href={siteConfig.hotlineHref} className="inline-flex items-center gap-2 bg-slate-900 text-white font-body font-bold py-3 px-6 rounded-xl hover:bg-slate-800 transition-colors">
            📞 Gọi {siteConfig.hotlineDisplay}
          </a>
          <Link href="/?service=DONG_PIN&source=service-dong-pin#quote" className="inline-flex items-center gap-2 bg-white text-slate-900 border-2 border-slate-200 font-body font-bold py-3 px-6 rounded-xl hover:border-slate-300 transition-colors">
            📋 Yêu Cầu Báo Giá
          </Link>
        </div>
      </div>
    </div>
  );
}
