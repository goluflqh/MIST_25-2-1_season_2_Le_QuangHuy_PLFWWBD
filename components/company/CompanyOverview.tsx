import Link from "next/link";
import { siteConfig } from "@/lib/site";

const content = {
  vi: {
    label: "Giới thiệu Minh Hồng",
    title: "Dịch vụ kỹ thuật, có phần mềm hỗ trợ.",
    intro: "Minh Hồng là cơ sở kinh doanh dịch vụ pin tại Đà Nẵng. Các dịch vụ được giới thiệu trên website gồm đóng và sửa pin lithium, pin lưu trữ, đèn năng lượng mặt trời và lắp đặt camera an ninh.",
    history: "Các mốc hoạt động",
    family: "Cách Minh Hồng phát triển",
    familyText: "Minh Hồng phát triển bằng nguồn vốn tự có, kết hợp hoạt động dịch vụ kỹ thuật với việc xây dựng phần mềm hỗ trợ vận hành. Người sáng lập phụ trách hoạt động kinh doanh; việc phát triển và quản lý website được đảm nhiệm riêng để hỗ trợ tiếp nhận yêu cầu và chăm sóc khách hàng.",
    dates: [
      ["Khoảng tháng 10/2025", "Hoạt động kinh doanh liên quan đến pin bắt đầu."],
      ["Tháng 4/2026", "Bắt đầu phát triển và vận hành website minhhongdanang.page."],
    ],
    dateNote: "Tháng 10/2025 là mốc gần đúng của hoạt động liên quan đến pin, không phải ngày bắt đầu toàn bộ hoạt động kinh doanh gia đình hay ngày đăng ký pháp lý. Tháng 4/2026 là mốc ra mắt website.",
    product: "Nền tảng phần mềm hỗ trợ dịch vụ",
    productIntro: "Website kết nối thông tin dịch vụ với các công cụ hỗ trợ khách hàng và nhân viên. Các chức năng sau đã được triển khai trong mã nguồn:",
    capabilities: [
      ["Tiếp nhận yêu cầu", "Biểu mẫu tư vấn thu thập thông tin liên hệ, dịch vụ quan tâm và ghi chú để nhân viên theo dõi."],
      ["Báo giá và đơn dịch vụ", "Bảng giá tham khảo cho khách hàng; công cụ nội bộ ghi nhận giá báo, thanh toán và tiến trình đơn dịch vụ."],
      ["Hỗ trợ bảo hành", "Tra cứu bảo hành và quản lý thông tin bảo hành gắn với đơn dịch vụ."],
      ["Chatbot kết hợp quy tắc và AI", "Sử dụng nội dung dịch vụ, thông tin giá và câu trả lời theo quy tắc; có thể gọi dịch vụ AI theo cấu hình và hướng khách tới nhân viên khi cần."],
    ],
    availability: "Mô tả này phản ánh chức năng trong mã nguồn, không xác nhận mọi chức năng đều đang được bật hoặc đã được kiểm chứng trên hệ thống vận hành thực tế. Nhà cung cấp AI đang sử dụng trên hệ thống thực tế chưa được xác minh.",
    planned: "Định hướng phát triển trợ lý AI",
    plan: "Trong giai đoạn tiếp theo, Minh Hồng dự kiến tích hợp Claude để hỗ trợ làm rõ nhu cầu khách hàng, tra cứu thông tin dịch vụ và giá đã được duyệt, đồng thời tóm tắt yêu cầu cho nhân viên. Khuyến nghị kỹ thuật và báo giá cuối cùng vẫn do nhân viên kiểm tra. Tích hợp Claude hiện nằm trong kế hoạch phát triển, chưa được giới thiệu là tính năng đang vận hành.",
    contact: "Liên hệ Minh Hồng",
    location: "Địa điểm",
    phone: "Điện thoại",
    links: ["Xem dịch vụ", "Giá tham khảo", "Tra cứu bảo hành"],
    languageNote: "Các trang dịch vụ và công cụ khách hàng hiện dùng tiếng Việt.",
  },
  en: {
    label: "About Minh Hồng",
    title: "Technical services, supported by software.",
    intro: "Minh Hồng is a battery service business in Da Nang, Vietnam. Services presented on the website include lithium battery assembly and repair, energy storage batteries, solar lighting and security camera installation.",
    history: "Operating timeline",
    family: "How Minh Hồng is growing",
    familyText: "Minh Hồng is self-funded, combining technical services with the development of software to support operations. The founder manages business operations, while website development and administration are handled separately to support customer enquiries and follow-up.",
    dates: [
      ["Approximately October 2025", "Battery-related business operations began."],
      ["April 2026", "Development and operation of minhhongdanang.page began."],
    ],
    dateNote: "October 2025 is the approximate start of battery-related operations, not the start of all family business activities or a legal registration date. April 2026 marks the website launch.",
    product: "Software supporting the service workflow",
    productIntro: "The website connects service information with tools for customers and staff. The following capabilities are implemented in the codebase:",
    capabilities: [
      ["Enquiries", "A consultation form collects contact details, service interests and notes for staff follow-up."],
      ["Quotations and service orders", "Reference pricing for customers; internal tools to record quoted prices, payments and service order progress."],
      ["Warranty support", "Warranty lookup and management of warranty information linked to service orders."],
      ["Hybrid rule-based and AI chatbot", "Uses service content, pricing information and rule-based replies; can call a configured AI service and direct customers to staff when needed."],
    ],
    availability: "This describes capabilities in the codebase, not confirmation that every feature is enabled or verified in production. The AI provider currently used in production has not been verified.",
    planned: "AI assistant roadmap",
    plan: "As a next step, Minh Hồng plans to integrate Claude to help clarify customer requirements, retrieve approved service and pricing information, and summarize enquiries for staff. Staff would continue to review technical recommendations and final quotations. Claude integration remains on the development roadmap and is not presented as a live feature.",
    contact: "Contact Minh Hồng",
    location: "Location",
    phone: "Phone",
    links: ["Explore services", "Reference pricing", "Warranty lookup"],
    languageNote: "Service pages and customer tools currently use Vietnamese.",
  },
} as const;

export default function CompanyOverview({ language }: { language: "vi" | "en" }) {
  const copy = content[language];
  const linkClass = "rounded-sm font-semibold text-red-700 underline underline-offset-4 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-700";

  return (
    <article lang={language} className="mx-auto max-w-4xl px-4 py-10 font-body text-slate-700 sm:px-6 sm:py-16">
      <nav aria-label={language === "vi" ? "Ngôn ngữ" : "Language"} className="mb-10 flex flex-wrap items-center gap-3 text-sm">
        <Link href="/gioi-thieu" hrefLang="vi" lang="vi" aria-current={language === "vi" ? "page" : undefined} className={`${linkClass} inline-flex min-h-11 items-center`}>Tiếng Việt</Link>
        <span aria-hidden="true">|</span>
        <Link href="/en/about" hrefLang="en" lang="en" aria-current={language === "en" ? "page" : undefined} className={`${linkClass} inline-flex min-h-11 items-center`}>English</Link>
      </nav>
      <header>
        <p className="font-semibold text-red-700">{copy.label}</p>
        <h1 className="mt-4 max-w-3xl font-heading text-4xl font-extrabold leading-tight text-slate-950 sm:text-5xl">{copy.title}</h1>
        <p className="mt-6 text-lg leading-8">{copy.intro}</p>
      </header>
      <section className="mt-12 border-t border-slate-200 pt-8">
        <h2 className="font-heading text-2xl font-bold text-slate-950">{copy.family}</h2>
        <p className="mt-4 leading-7">{copy.familyText}</p>
      </section>
      <section className="mt-12 border-t border-slate-200 pt-8">
        <h2 className="font-heading text-2xl font-bold text-slate-950">{copy.history}</h2>
        <dl className="mt-6 grid gap-6 sm:grid-cols-2">
          {copy.dates.map(([date, description]) => (
            <div key={date} className="border-l-2 border-red-600 pl-4">
              <dt className="font-bold text-slate-950">{date}</dt>
              <dd className="mt-2 leading-7">{description}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-sm leading-6 text-slate-600">{copy.dateNote}</p>
      </section>
      <section className="mt-12 border-t border-slate-200 pt-8">
        <h2 className="font-heading text-2xl font-bold text-slate-950">{copy.product}</h2>
        <p className="mt-4 leading-7">{copy.productIntro}</p>
        <dl className="mt-6 grid gap-6 sm:grid-cols-2">
          {copy.capabilities.map(([title, description]) => (
            <div key={title}>
              <dt className="font-bold text-slate-950">{title}</dt>
              <dd className="mt-2 leading-7">{description}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6">{copy.availability}</p>
      </section>
      <section className="mt-12 border-t border-slate-200 pt-8">
        <h2 className="font-heading text-2xl font-bold text-slate-950">{copy.planned}</h2>
        <p className="mt-4 leading-7">{copy.plan}</p>
      </section>
      <section className="mt-12 border-t border-slate-200 pt-8">
        <h2 className="font-heading text-2xl font-bold text-slate-950">{copy.contact}</h2>
        <address className="mt-4 space-y-3 not-italic leading-7">
          <p>Email: <a href="mailto:hello@minhhongdanang.page" className={`${linkClass} break-words`}>hello@minhhongdanang.page</a></p>
          <p>{copy.phone}: <a href={siteConfig.hotlineHref} className={linkClass}>{siteConfig.hotlineDisplay}</a></p>
          <p>{copy.location}: <a href={siteConfig.mapUrl} lang="vi" className={linkClass}>{siteConfig.locationLabel}</a></p>
        </address>
        <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
          {["/dich-vu", "/bao-gia", "/tra-cuu-bao-hanh"].map((href, index) => (
            <li key={href}><Link href={href} hrefLang="vi" className={linkClass}>{copy.links[index]}</Link></li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-slate-600">{copy.languageNote}</p>
      </section>
    </article>
  );
}
