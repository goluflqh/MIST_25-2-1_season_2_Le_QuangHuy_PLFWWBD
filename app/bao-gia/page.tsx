"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface PricingItem {
  id: string;
  category: string;
  name: string;
  price: string;
  unit: string;
  description: string | null;
  note: string | null;
}

// Fallback static data when DB is empty
const fallbackData = [
  { category: "PIN", items: [
    { name: "Pin máy khoan / bắn vít", price: "350.000 - 800.000đ", note: "Tuỳ dung lượng & hãng" },
    { name: "Pin máy cắt / máy mài", price: "500.000 - 1.200.000đ", note: "Tuỳ số cell" },
    { name: "Pin xe đạp điện", price: "2.000.000 - 5.000.000đ", note: "Tuỳ Ah & loại xe" },
    { name: "Pin xe máy điện", price: "3.500.000 - 8.000.000đ", note: "Tuỳ dung lượng" },
    { name: "Pin loa kéo", price: "200.000 - 500.000đ", note: "Tuỳ hãng loa" },
  ]},
  { category: "NLMT", items: [
    { name: "Thay pin đèn NLMT", price: "150.000 - 400.000đ", note: "Tuỳ dung lượng" },
    { name: "Đèn pha NLMT 100W-300W", price: "500.000 - 1.500.000đ", note: "Bao lắp đặt" },
  ]},
  { category: "LUU_TRU", items: [
    { name: "Pin kích đề ô tô 12V", price: "800.000 - 2.000.000đ", note: "Tuỳ dòng xả" },
    { name: "Pin dự phòng dung lượng lớn", price: "500.000 - 3.000.000đ", note: "Tuỳ mAh" },
    { name: "Đóng bình pin theo yêu cầu", price: "Liên hệ", note: "Báo giá theo thông số" },
  ]},
  { category: "CAMERA", items: [
    { name: "Trọn bộ 2 camera", price: "2.500.000 - 4.000.000đ", note: "Bao lắp đặt" },
    { name: "Trọn bộ 4 camera", price: "4.000.000 - 7.000.000đ", note: "Bao lắp đặt" },
    { name: "Camera PTZ xoay 360°", price: "1.500.000 - 3.000.000đ/cam", note: "Tuỳ hãng" },
    { name: "Khảo sát tận nơi", price: "MIỄN PHÍ", note: "Đà Nẵng & lân cận" },
  ]},
];

const categoryConfig: Record<string, { label: string; bg: string; border: string; badge: string }> = {
  PIN: { label: "🔋 Đóng Pin Lithium", bg: "bg-red-50", border: "border-red-200", badge: "bg-red-100 text-red-700" },
  NLMT: { label: "☀️ Đèn Năng Lượng Mặt Trời", bg: "bg-yellow-50", border: "border-yellow-200", badge: "bg-yellow-100 text-yellow-700" },
  LUU_TRU: { label: "⚡ Pin Lưu Trữ & Kích Đề", bg: "bg-green-50", border: "border-green-200", badge: "bg-green-100 text-green-700" },
  CAMERA: { label: "📹 Camera An Ninh", bg: "bg-blue-50", border: "border-blue-200", badge: "bg-blue-100 text-blue-700" },
};

export default function PricingPage() {
  const [dbItems, setDbItems] = useState<PricingItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/admin/pricing")
      .then((r) => r.json())
      .then((data) => { if (data.success && data.items.length > 0) setDbItems(data.items); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Build display data: use DB if available, fallback to static
  const categories = Object.keys(categoryConfig);
  const displayData = categories.map((cat) => {
    const fromDb = dbItems.filter((i) => i.category === cat);
    const fallback = fallbackData.find((f) => f.category === cat);
    return {
      category: cat,
      config: categoryConfig[cat],
      items: fromDb.length > 0
        ? fromDb.map((i) => ({ name: i.name, price: `${i.price}${i.unit ? ` ${i.unit}` : ""}`, note: i.note || i.description || "" }))
        : (fallback?.items || []),
      fromDb: fromDb.length > 0,
    };
  });

  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 ${loaded ? "animate-fade-in-up" : "animate-pulse"}`}>
      {/* Header */}
      <div className="text-center mb-16 max-w-3xl mx-auto">
        <span className="inline-block py-1 px-3 rounded-full bg-red-50 text-red-600 font-body font-semibold text-sm mb-4 border border-red-100">
          💰 Bảng Giá Tham Khảo
        </span>
        <h1 className="font-heading font-extrabold text-4xl md:text-5xl text-slate-900 mb-6">
          Giá Dịch Vụ <span className="text-red-600">Minh Hồng</span>
        </h1>
        <p className="font-body text-slate-600 text-lg">
          Giá tham khảo dưới đây có thể thay đổi tuỳ vào thiết bị và yêu cầu riêng. Liên hệ hotline <strong className="text-slate-900">0987.443.258</strong> để nhận báo giá chính xác nhất!
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        {displayData.map((cat) => {
          if (cat.items.length === 0) return null;
          return (
            <div key={cat.category} className={`${cat.config.bg} rounded-2xl border ${cat.config.border} overflow-hidden`}>
              <div className="p-6 pb-4">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-body font-bold ${cat.config.badge} mb-3`}>
                  {cat.config.label}
                </span>
                {cat.fromDb && <span className="text-[9px] text-slate-400 ml-2">✓ Cập nhật</span>}
              </div>
              <div className="bg-white rounded-t-2xl">
                <table className="w-full">
                  <tbody>
                    {cat.items.map((item, i) => (
                      <tr key={i} className={`border-b border-slate-100 last:border-b-0 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                        <td className="px-6 py-4">
                          <p className="font-body font-semibold text-slate-800 text-sm">{item.name}</p>
                          {item.note && <p className="font-body text-xs text-slate-400 mt-0.5">{item.note}</p>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`font-heading font-bold text-sm ${item.price === "MIỄN PHÍ" ? "text-green-600" : item.price === "Liên hệ" ? "text-red-600" : "text-slate-900"}`}>
                            {item.price}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* Note */}
      <div className="bg-slate-100 rounded-2xl p-6 mb-8 text-center">
        <p className="font-body text-sm text-slate-600">
          ⚠️ <strong>Lưu ý:</strong> Bảng giá trên chỉ mang tính tham khảo. Giá thực tế phụ thuộc vào loại cell, dung lượng, kích thước và yêu cầu cụ thể.
        </p>
      </div>

      {/* CTA */}
      <div className="bg-linear-to-r from-slate-900 to-slate-800 rounded-2xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="font-heading font-extrabold text-2xl text-white mb-2">Cần báo giá chính xác?</h2>
          <p className="font-body text-slate-300">Gửi yêu cầu hoặc gọi ngay để được tư vấn miễn phí</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <a href="tel:0987443258" className="inline-flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-heading font-bold py-3 px-6 rounded-xl transition-colors shadow-md">
            📞 Gọi 0987.443.258
          </a>
          <Link href="/#quote" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-heading font-bold py-3 px-6 rounded-xl transition-colors">
            📋 Gửi Yêu Cầu
          </Link>
        </div>
      </div>
    </div>
  );
}
