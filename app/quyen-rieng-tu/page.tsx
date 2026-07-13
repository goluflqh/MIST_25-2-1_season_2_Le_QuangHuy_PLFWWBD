import { buildMarketingMetadata, siteConfig } from "@/lib/site";

export const metadata = buildMarketingMetadata({
  title: "Quyền Riêng Tư",
  description:
    "Cách Minh Hồng sử dụng thông tin bạn chủ động gửi khi yêu cầu tư vấn, báo giá hoặc hỗ trợ bảo hành.",
  path: "/quyen-rieng-tu",
});

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-body text-sm font-semibold text-slate-600">
        Quyền riêng tư
      </span>
      <h1 className="mt-5 font-heading text-3xl font-extrabold text-slate-950 sm:text-5xl">
        Thông tin bạn gửi được dùng thế nào?
      </h1>
      <p className="mt-5 font-body text-base leading-7 text-slate-600 sm:text-lg">
        Chính sách này áp dụng cho thông tin bạn chủ động gửi qua biểu mẫu tư vấn, Zalo, điện thoại
        hoặc khi tra cứu bảo hành tại Minh Hồng. Cập nhật lần cuối: 11/07/2026.
      </p>

      <div className="mt-10 space-y-7 font-body text-slate-700">
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-heading text-xl font-extrabold text-slate-900">Thông tin có thể được tiếp nhận</h2>
          <p className="mt-3 leading-7">
            Khi yêu cầu tư vấn, bạn có thể gửi họ tên, số điện thoại, dịch vụ quan tâm và ghi chú về
            thiết bị hoặc vị trí lắp. Khi tra cứu bảo hành, bạn có thể cung cấp mã bảo hành hoặc số
            điện thoại liên quan.
          </p>
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-heading text-xl font-extrabold text-slate-900">Mục đích sử dụng</h2>
          <p className="mt-3 leading-7">
            Minh Hồng dùng thông tin này để phản hồi yêu cầu, chuẩn bị tư vấn hoặc báo giá, liên hệ
            về đơn dịch vụ khi cần và hỗ trợ tra cứu bảo hành. Không cần gửi mật khẩu, thông tin thẻ
            thanh toán hoặc dữ liệu nhạy cảm qua biểu mẫu này.
          </p>
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-heading text-xl font-extrabold text-slate-900">Kiểm tra hoặc điều chỉnh thông tin</h2>
          <p className="mt-3 leading-7">
            Nếu thông tin liên hệ hoặc yêu cầu cần được sửa, bạn có thể gọi
            {" "}
            <a className="font-semibold text-primary hover:text-red-700" href={siteConfig.hotlineHref}>
              {siteConfig.hotlineDisplay}
            </a>
            {" "}
            hoặc nhắn
            {" "}
            <a
              className="font-semibold text-primary hover:text-red-700"
              href={siteConfig.zaloUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Zalo Minh Hồng
            </a>
            . Chúng tôi sẽ kiểm tra yêu cầu theo thông tin bạn cung cấp.
          </p>
        </section>
      </div>
    </main>
  );
}
