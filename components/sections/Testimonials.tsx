"use client";

import { useState, useEffect } from "react";

interface ReviewData {
  id: string;
  rating: number;
  comment: string;
  service: string;
  user: { name: string };
}

const serviceLabels: Record<string, string> = {
  DONG_PIN: "Đóng Pin", DEN_NLMT: "Đèn NLMT", PIN_LUU_TRU: "Pin Lưu Trữ",
  CAMERA: "Camera", CUSTOM: "Custom", KHAC: "Dịch vụ",
};

const avatarColors = [
  "from-red-500 to-orange-500",
  "from-blue-500 to-indigo-500",
  "from-teal-500 to-emerald-500",
  "from-pink-500 to-rose-500",
  "from-yellow-500 to-amber-500",
];

const defaultTestimonials = [
  { name: "Anh Tuấn", comment: "Nội trở chuẩn, chạy máy cưa mượt hơn hẳn đồ zin đã chai. Hồng chủ cửa hàng kiểm tra trước mặt khách minh bạch, rất yên tâm.", rating: 5, service: "DONG_PIN" },
  { name: "Chị Hoa", comment: "Mới lắp bộ 4 mắt giám sát ban đêm nét căng. Đội thợ đi dây siêu gọn gàng, không đục khoét tường bừa bãi. 10 điểm uy tín.", rating: 5, service: "CAMERA" },
  { name: "Chú Minh", comment: "Bình kích đề xe tải đóng ở đây xài hơn năm nay ngon ơ. Lúc hỏng mang qua thợ hỗ trợ liền không tính phí lặt vặt. Quá tốt!", rating: 5, service: "PIN_LUU_TRU" },
];

function ReviewCard({ t, i }: { t: { name: string; comment: string; rating: number; service: string }; i: number }) {
  return (
    <div className="glass-panel p-8 rounded-3xl relative mt-8 hover:-translate-y-2 transition-transform duration-300 bg-white">
      <div className="absolute -top-8 left-8">
        <div className={`w-16 h-16 rounded-full border-4 border-white shadow-md bg-gradient-to-br ${avatarColors[i % avatarColors.length]} flex items-center justify-center text-white font-heading font-black text-2xl`}>
          {t.name.charAt(0)}
        </div>
      </div>
      <div className="flex gap-0.5 mt-6 mb-3">
        {[1, 2, 3, 4, 5].map((s) => (
          <span key={s} className={`text-lg ${s <= t.rating ? "text-yellow-400" : "text-slate-200"}`}>★</span>
        ))}
      </div>
      <p className="font-body text-slate-700 leading-relaxed italic border-l-4 border-slate-200 pl-4 text-sm">
        &ldquo;{t.comment}&rdquo;
      </p>
      <div className="mt-4 flex items-center justify-between">
        <span className="font-heading font-bold text-textMain">{t.name}</span>
        <span className="font-body text-xs text-slate-400">{serviceLabels[t.service] || t.service}</span>
      </div>
    </div>
  );
}

export default function Testimonials() {
  const [realReviews, setRealReviews] = useState<ReviewData[]>([]);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    fetch("/api/reviews")
      .then((r) => r.json())
      .then((data) => { if (data.success) setRealReviews(data.reviews); })
      .catch(() => {});
  }, []);

  return (
    <section id="testimonials" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 mb-12 relative z-10">
      <div className="text-center mb-16">
        <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-textMain mb-4">
          Niềm Tin Của Khách Trải Nghiệm
        </h2>
        <div className="w-16 h-1 bg-gradient-to-r from-yellow-400 to-orange-500 mx-auto"></div>
      </div>

      {/* Default 3 testimonials — always visible */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {defaultTestimonials.map((t, i) => <ReviewCard key={i} t={t} i={i} />)}
      </div>

      {/* Real reviews from DB — toggle with button */}
      {realReviews.length > 0 && (
        <div className="mt-12">
          {!showMore ? (
            <div className="text-center">
              <button
                onClick={() => setShowMore(true)}
                className="px-6 py-3 bg-slate-900 text-white rounded-xl font-body font-bold text-sm hover:bg-slate-800 transition-colors shadow-lg"
              >
                Xem thêm {realReviews.length} đánh giá từ khách hàng →
              </button>
            </div>
          ) : (
            <>
              <div className="mb-8"></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {realReviews.map((r, i) => (
                  <ReviewCard key={r.id} t={{ name: r.user.name, comment: r.comment, rating: r.rating, service: r.service }} i={i + 3} />
                ))}
              </div>
              <div className="text-center mt-6">
                <button onClick={() => setShowMore(false)} className="font-body text-sm text-slate-400 hover:text-slate-600">Ẩn bớt ↑</button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
