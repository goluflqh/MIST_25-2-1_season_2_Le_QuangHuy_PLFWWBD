import TestimonialsReviewPager from "@/components/sections/TestimonialsReviewPager";
import { getPublicApprovedReviews } from "@/lib/public-data";

const serviceLabels: Record<string, string> = {
  DONG_PIN: "Đóng Pin",
  DEN_NLMT: "Đèn NLMT",
  PIN_LUU_TRU: "Pin Lưu Trữ",
  CAMERA: "Camera",
  CUSTOM: "Theo yêu cầu",
  KHAC: "Dịch vụ",
};

const avatarColors = [
  "from-red-500 to-red-700",
  "from-orange-400 to-amber-500",
  "from-slate-700 to-slate-900",
  "from-red-400 to-orange-500",
  "from-amber-500 to-red-600",
];

const defaultTestimonials = [
  {
    name: "Anh Tuấn",
    comment:
      "Nội trở chuẩn, chạy máy cưa mượt hơn hẳn đồ zin đã chai. Hồng chủ cửa hàng kiểm tra trước mặt khách minh bạch, rất yên tâm.",
    rating: 5,
    service: "DONG_PIN",
  },
  {
    name: "Chị Hoa",
    comment:
      "Mới lắp bộ 4 mắt giám sát ban đêm nét căng. Đội thợ đi dây siêu gọn gàng, không đục khoét tường bừa bãi. 10 điểm uy tín.",
    rating: 5,
    service: "CAMERA",
  },
  {
    name: "Chú Minh",
    comment:
      "Bình kích đề xe tải đóng ở đây xài hơn năm nay ngon ơ. Lúc hỏng mang qua thợ hỗ trợ liền không tính phí lặt vặt. Quá tốt!",
    rating: 5,
    service: "PIN_LUU_TRU",
  },
] as const;

function ReviewCard({
  testimonial,
  index,
}: {
  testimonial: { name: string; comment: string; rating: number; service: string };
  index: number;
}) {
  return (
    <div className="relative mt-8 rounded-[2rem] border border-slate-100 bg-white p-8 shadow-[0_20px_80px_-52px_rgba(15,23,42,0.45)] transition-transform duration-300 hover:-translate-y-1">
      <div className="absolute -top-8 left-8">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br ${avatarColors[index % avatarColors.length]} font-heading text-2xl font-black text-white shadow-md`}
        >
          {testimonial.name.charAt(0)}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {serviceLabels[testimonial.service] || testimonial.service}
        </span>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <svg
              key={star}
              className={`h-4 w-4 ${star <= testimonial.rating ? "text-amber-400" : "text-slate-200"}`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.922-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.176 0l-2.8 2.034c-.784.57-1.838-.196-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81H7.03a1 1 0 00.951-.69l1.068-3.292z" />
            </svg>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-[1.5rem] border border-slate-100 bg-slate-50/75 p-5">
        <p className="font-body text-sm italic leading-7 text-slate-700">
          &ldquo;{testimonial.comment}&rdquo;
        </p>
      </div>

      <div className="mt-5">
        <span className="font-heading text-lg font-bold text-textMain">{testimonial.name}</span>
        <p className="font-body text-sm text-slate-400">Khách đã trải nghiệm dịch vụ thực tế</p>
      </div>
    </div>
  );
}

export default async function Testimonials() {
  const realReviews = await getPublicApprovedReviews();
  const realReviewSummaries = realReviews.map((review) => ({
    id: review.id,
    comment: review.comment,
    name: review.user.name,
    rating: review.rating,
    service: review.service,
  }));

  return (
    <section id="testimonials" className="relative z-10 mx-auto mb-12 max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-16 text-center">
        <span className="inline-flex rounded-full border border-red-100 bg-red-50 px-3 py-1 text-sm font-semibold text-primary">
          Chứng thực từ khách
        </span>
        <h2 className="mb-4 mt-4 text-pretty font-heading text-3xl font-extrabold text-textMain sm:text-4xl">
          Niềm tin của khách trải nghiệm
        </h2>
        <div className="mx-auto h-1 w-16 bg-gradient-to-r from-yellow-400 to-orange-500"></div>
        <p className="mx-auto mt-6 max-w-3xl font-body text-lg leading-8 text-slate-600">
          Những phản hồi tốt nhất thường không chỉ khen giá, mà khen cách làm rõ ràng, làm gọn và
          hỗ trợ tiếp sau khi bàn giao.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {["Kiểm tra trước mặt khách", "Báo giá công khai", "Hỗ trợ sau bàn giao"].map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {defaultTestimonials.map((testimonial, index) => (
          <ReviewCard key={index} testimonial={testimonial} index={index} />
        ))}
      </div>

      <TestimonialsReviewPager reviews={realReviewSummaries} />

    </section>
  );
}
