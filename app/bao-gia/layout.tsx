import { buildMarketingMetadata } from "@/lib/site";

export const metadata = buildMarketingMetadata({
  title: "Bảng Giá Dịch Vụ",
  description:
    "Bảng giá đóng pin Lithium, lắp camera, đèn năng lượng mặt trời, pin lưu trữ tại Minh Hồng. Giá cập nhật mới nhất.",
  path: "/bao-gia",
});

export default function BaoGiaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
