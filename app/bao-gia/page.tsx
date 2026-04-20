import Link from "next/link";
import { getPublicActivePricingItems } from "@/lib/public-data";
import { siteConfig } from "@/lib/site";

interface PricingItem {
  id: string;
  category: string;
  name: string;
  price: string;
  unit: string;
  description: string | null;
  note: string | null;
}

interface DisplayPricingItem {
  name: string;
  note: string;
  price: string;
}

const fallbackData = [
  {
    category: "PIN",
    items: [
      { name: "Pin máy khoan / bắn vít", price: "350.000 - 800.000đ", note: "Tuỳ dung lượng & hãng" },
      { name: "Pin máy cắt / máy mài", price: "500.000 - 1.200.000đ", note: "Tuỳ số cell" },
      { name: "Pin xe đạp điện", price: "2.000.000 - 5.000.000đ", note: "Tuỳ Ah & loại xe" },
      { name: "Pin xe máy điện", price: "3.500.000 - 8.000.000đ", note: "Tuỳ dung lượng" },
      { name: "Pin loa kéo", price: "200.000 - 500.000đ", note: "Tuỳ hãng loa" },
    ],
  },
  {
    category: "NLMT",
    items: [
      { name: "Thay pin đèn NLMT", price: "150.000 - 400.000đ", note: "Tuỳ dung lượng" },
      { name: "Đèn pha NLMT 100W-300W", price: "500.000 - 1.500.000đ", note: "Bao lắp đặt" },
    ],
  },
  {
    category: "LUU_TRU",
    items: [
      { name: "Pin kích đề ô tô 12V", price: "800.000 - 2.000.000đ", note: "Tuỳ dòng xả" },
      { name: "Pin dự phòng dung lượng lớn", price: "500.000 - 3.000.000đ", note: "Tuỳ mAh" },
      { name: "Đóng bình pin theo yêu cầu", price: "Liên hệ", note: "Báo giá theo thông số" },
    ],
  },
  {
    category: "CAMERA",
    items: [
      { name: "Trọn bộ 2 camera", price: "2.500.000 - 4.000.000đ", note: "Bao lắp đặt" },
      { name: "Trọn bộ 4 camera", price: "4.000.000 - 7.000.000đ", note: "Bao lắp đặt" },
      { name: "Camera PTZ xoay 360°", price: "1.500.000 - 3.000.000đ/cam", note: "Tuỳ hãng" },
      { name: "Khảo sát tận nơi", price: "MIỄN PHÍ", note: "Đà Nẵng & lân cận" },
    ],
  },
] as const;

const categoryConfig: Record<string, { label: string; bg: string; border: string; badge: string }> = {
  PIN: {
    label: "Đóng Pin Lithium",
    bg: "bg-red-50/70",
    border: "border-red-100",
    badge: "bg-red-100 text-red-700",
  },
  NLMT: {
    label: "Đèn Năng Lượng Mặt Trời",
    bg: "bg-amber-50/70",
    border: "border-amber-100",
    badge: "bg-amber-100 text-amber-700",
  },
  LUU_TRU: {
    label: "Pin Lưu Trữ & Kích Đề",
    bg: "bg-orange-50/70",
    border: "border-orange-100",
    badge: "bg-orange-100 text-orange-700",
  },
  CAMERA: {
    label: "Camera An Ninh",
    bg: "bg-slate-50",
    border: "border-slate-200",
    badge: "bg-slate-100 text-slate-700",
  },
};

const pricingCategories = ["PIN", "NLMT", "LUU_TRU", "CAMERA"] as const;

function formatPricingItem(item: PricingItem): DisplayPricingItem {
  return {
    name: item.name,
    note: item.note || item.description || "",
    price: `${item.price}${item.unit ? ` ${item.unit}` : ""}`,
  };
}

export default async function PricingPage() {
  const dbItems = await getPublicActivePricingItems();

  const displayData = pricingCategories.map((category) => {
    const fromDb = dbItems.filter((item) => item.category === category);
    const fallback = fallbackData.find((item) => item.category === category);

    return {
      category,
      config: categoryConfig[category],
      items: fromDb.length > 0 ? fromDb.map(formatPricingItem) : fallback?.items || [],
      fromDb: fromDb.length > 0,
    };
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto mb-16 max-w-3xl text-center">
        <span className="inline-block rounded-full border border-red-100 bg-red-50 px-3 py-1 text-sm font-semibold text-red-600">
          Bảng giá tham khảo
        </span>
        <h1 className="mb-6 mt-4 font-heading text-4xl font-extrabold text-slate-900 md:text-5xl">
          Giá Dịch Vụ <span className="text-red-600">Minh Hồng</span>
        </h1>
        <p className="font-body text-lg leading-8 text-slate-600">
          Bảng giá dưới đây giúp khách ước lượng ngân sách trước. Mức chốt cuối vẫn dựa trên tình
          trạng thiết bị, cấu hình thật và phương án Minh Hồng kiểm tra trực tiếp.
        </p>

        <div className="mt-8 grid gap-3 md:grid-cols-3">
          <div className="rounded-[1.5rem] border border-red-100 bg-red-50/70 p-5 text-left">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Khảo sát trước</p>
            <p className="mt-2 font-body text-sm leading-6 text-slate-700">
              Với các ca cần kiểm tra pin, tải hoặc vị trí lắp camera, Minh Hồng ưu tiên xem trước
              rồi mới chốt giá.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-amber-100 bg-amber-50/70 p-5 text-left">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
              Không báo mập mờ
            </p>
            <p className="mt-2 font-body text-sm leading-6 text-slate-700">
              Trao đổi rõ về cell, mạch, phụ kiện và công việc cần làm để khách chủ động quyết định.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-5 text-left">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Hotline trực tiếp</p>
            <p className="mt-2 font-heading text-xl font-bold text-slate-900">{siteConfig.hotlineDisplay}</p>
            <p className="mt-1 font-body text-sm leading-6 text-slate-600">
              Cần chốt nhanh hơn, cứ gọi để được tư vấn trường hợp cụ thể.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-16 grid grid-cols-1 gap-8 md:grid-cols-2">
        {displayData.map((category) => {
          if (category.items.length === 0) return null;

          return (
            <div
              key={category.category}
              className={`overflow-hidden rounded-[2rem] border ${category.config.border} ${category.config.bg} shadow-[0_22px_80px_-56px_rgba(15,23,42,0.45)] backdrop-blur`}
            >
              <div className="p-6 pb-4">
                <span
                  className={`mb-3 inline-block rounded-full px-3 py-1 text-sm font-body font-bold ${category.config.badge}`}
                >
                  {category.config.label}
                </span>
                {category.fromDb ? (
                  <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Cập nhật
                  </span>
                ) : null}
              </div>
              <div className="rounded-t-[1.75rem] bg-white/95">
                <table className="w-full">
                  <tbody>
                    {category.items.map((item, i) => (
                      <tr
                        key={i}
                        className={`border-b border-slate-100 last:border-b-0 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}
                      >
                        <td className="px-6 py-4">
                          <p className="font-body text-sm font-semibold text-slate-800">{item.name}</p>
                          {item.note ? (
                            <p className="mt-0.5 font-body text-xs text-slate-400">{item.note}</p>
                          ) : null}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span
                            className={`font-heading text-sm font-bold ${item.price === "MIỄN PHÍ" ? "text-emerald-600" : item.price === "Liên hệ" ? "text-red-600" : "text-slate-900"}`}
                          >
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

      <div className="mb-8 rounded-[1.75rem] border border-slate-200 bg-slate-100 p-6 text-center">
        <p className="font-body text-sm leading-7 text-slate-600">
          <strong>Lưu ý:</strong> Bảng giá trên chỉ mang tính tham khảo. Giá thực tế phụ thuộc vào
          loại cell, dung lượng, kích thước, hãng thiết bị và yêu cầu thi công cụ thể.
        </p>
      </div>

      <div className="flex flex-col items-center justify-between gap-6 rounded-[2rem] bg-linear-to-r from-slate-900 to-slate-800 p-8 md:flex-row md:p-12">
        <div>
          <h2 className="mb-2 font-heading text-2xl font-extrabold text-white">
            Cần báo giá chính xác hơn?
          </h2>
          <p className="font-body text-slate-300">
            Gọi trực tiếp hoặc để lại yêu cầu để Minh Hồng tư vấn đúng theo trường hợp của bạn.
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <a
            href={siteConfig.hotlineHref}
            className="inline-flex items-center gap-2 rounded-2xl bg-yellow-500 px-6 py-3 font-heading font-bold text-slate-900 shadow-md transition-colors hover:bg-yellow-400"
          >
            Gọi {siteConfig.hotlineDisplay}
          </a>
          <Link
            href="/?source=pricing-page#quote"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-6 py-3 font-heading font-bold text-white transition-colors hover:bg-white/20"
          >
            Gửi yêu cầu
          </Link>
        </div>
      </div>
    </div>
  );
}
