import Link from "next/link";
import JsonLd from "@/components/seo/JsonLd";
import { getDefaultPricingByCategory } from "@/lib/default-pricing";
import { hasPriceUnit, normalizePriceRange, toValidPricingDate } from "@/lib/pricing-display";
import { getPublicActivePricingItems } from "@/lib/public-data";
import { siteConfig } from "@/lib/site";
import { buildBreadcrumbJsonLd, buildPricingFaqJsonLd } from "@/lib/structured-data";

interface PricingItem {
  id?: string;
  category: string;
  name: string;
  price: string;
  unit: string;
  description: string | null;
  note: string | null;
  updatedAt?: Date | string;
}

interface DisplayPricingItem {
  name: string;
  note: string;
  price: string;
}

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
  const normalizedPrice = normalizePriceRange(item.price);
  const shouldAppendUnit =
    item.unit && !isFreePrice(normalizedPrice) && !isContactPrice(normalizedPrice) && !hasPriceUnit(normalizedPrice);

  return {
    name: item.name,
    note: item.note || item.description || "",
    price: `${normalizedPrice}${shouldAppendUnit ? ` ${item.unit}` : ""}`,
  };
}

function isFreePrice(price: string) {
  return price.toLowerCase().includes("miễn phí");
}

function isContactPrice(price: string) {
  return price.trim().toLowerCase() === "liên hệ";
}

function formatPricingUpdate(value: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
  }).format(value);
}

export default async function PricingPage() {
  const dbItems = await getPublicActivePricingItems();
  const publicDbItems = dbItems.filter((item) => !item.name.toLowerCase().includes("pricing crm"));
  const latestPricingUpdate = publicDbItems.reduce<Date | null>((latest, item) => {
    const updatedAt = toValidPricingDate(item.updatedAt);
    if (updatedAt && (!latest || updatedAt > latest)) return updatedAt;

    return latest;
  }, null);

  const displayData = pricingCategories.map((category) => {
    const fromDb = publicDbItems.filter((item) => (
      item.category === category && !item.name.toLowerCase().includes("pricing crm")
    ));
    const fallback = getDefaultPricingByCategory(category);
    const requiredFallbackItems = category === "PIN"
      ? fallback.filter((item) => item.name.toLowerCase().includes("kiểm tra tình trạng pin"))
      : [];
    const mergedDbItems = fromDb.length > 0
      ? [
          ...requiredFallbackItems.filter((fallbackItem) => (
            !fromDb.some((item) => item.name.toLowerCase() === fallbackItem.name.toLowerCase())
          )),
          ...fromDb,
        ]
      : [];

    return {
      category,
      config: categoryConfig[category],
      items: mergedDbItems.length > 0 ? mergedDbItems.map(formatPricingItem) : fallback.map(formatPricingItem),
      fromDb: fromDb.length > 0,
    };
  });

  return (
    <>
      <JsonLd
        data={[
          buildBreadcrumbJsonLd([
            { name: "Trang chủ", path: "/" },
            { name: "Bảng giá", path: "/bao-gia" },
          ]),
          buildPricingFaqJsonLd(),
        ]}
      />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <div className="mx-auto mb-10 max-w-3xl text-center sm:mb-14">
          <span className="inline-block rounded-full border border-red-100 bg-red-50 px-3 py-1 text-sm font-semibold text-red-600">
            Bảng giá tham khảo
          </span>
          <h1 className="mb-4 mt-4 font-heading text-3xl font-extrabold text-slate-900 sm:text-4xl md:text-5xl">
            Giá Dịch Vụ <span className="text-red-600">Minh Hồng</span>
          </h1>
          <p className="font-body text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Giá hiển thị giúp bạn ước lượng ngân sách trước. Mức chốt cuối phụ thuộc tình trạng thiết bị,
            cấu hình thực tế và phương án sau khi kiểm tra.
          </p>
          <p className="mt-3 font-body text-sm leading-6 text-slate-600">
            <strong>Phạm vi:</strong> không xác nhận tồn kho, lịch lắp hoặc giá chốt. {latestPricingUpdate
              ? `Cập nhật gần nhất: ${formatPricingUpdate(latestPricingUpdate)}.`
              : "Các mục mặc định chưa có mốc cập nhật riêng."}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-2 text-left sm:grid-cols-3 sm:gap-3">
            <div className="rounded-2xl border border-red-100 bg-red-50/70 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Khảo sát trước</p>
              <p className="mt-1.5 font-body text-sm leading-5 text-slate-700">
                Kiểm tra pin, tải hoặc vị trí lắp rồi mới chốt giá.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700">Giá được cập nhật</p>
              <p className="mt-1.5 font-body text-sm leading-5 text-slate-700">
                Mức tham khảo thay đổi theo hạng mục đang phục vụ.
              </p>
            </div>
            <div className="col-span-2 rounded-2xl border border-slate-200 bg-white/90 p-4 sm:col-span-1">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Cần hỏi nhanh</p>
              <a className="mt-1.5 block font-heading text-lg font-bold text-slate-900 hover:text-primary" href={siteConfig.hotlineHref}>
                {siteConfig.hotlineDisplay}
              </a>
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
                    Đang bật
                  </span>
                ) : null}
              </div>
              <div className="rounded-t-[1.75rem] bg-white/95">
                <table className="w-full">
                  <caption className="sr-only">Bảng giá tham khảo {category.config.label}</caption>
                  <thead className="sr-only">
                    <tr>
                      <th scope="col">Hạng mục</th>
                      <th scope="col">Giá tham khảo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {category.items.map((item, i) => (
                      <tr
                        key={i}
                        className={`border-b border-slate-100 last:border-b-0 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}
                      >
                        <th scope="row" className="px-6 py-4 text-left">
                          <p className="font-body text-sm font-semibold text-slate-800">{item.name}</p>
                          {item.note ? (
                            <p className="mt-0.5 font-body text-xs text-slate-400">{item.note}</p>
                          ) : null}
                        </th>
                        <td className="px-6 py-4 text-right">
                          <span
                            className={`font-heading text-sm font-bold ${isFreePrice(item.price) ? "text-emerald-600" : isContactPrice(item.price) ? "text-red-600" : "text-slate-900"}`}
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
          <strong>Lưu ý về giá:</strong> Bảng giá chỉ mang tính tham khảo. Giá thực tế phụ thuộc vào
          loại cell, dung lượng, kích thước, hãng thiết bị, hiện trạng kiểm tra và yêu cầu thi công
          cụ thể.
        </p>
      </div>

      <div className="flex flex-col items-center justify-between gap-6 rounded-[2rem] bg-linear-to-r from-slate-900 to-slate-800 p-8 md:flex-row md:p-12">
        <div>
          <h2 className="mb-2 font-heading text-2xl font-extrabold text-white">
            Cần báo giá chính xác hơn?
          </h2>
          <p className="font-body text-slate-300">
            Gọi trực tiếp hoặc để lại yêu cầu để Minh Hồng kiểm tra thông tin và báo lại theo trường
            hợp cụ thể của bạn.
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
    </>
  );
}
