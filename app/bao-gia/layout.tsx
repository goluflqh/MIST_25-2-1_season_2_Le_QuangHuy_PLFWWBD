import { buildMarketingMetadata } from "@/lib/site";

export const metadata = buildMarketingMetadata({
  title: "Bảng Giá Tham Khảo Dịch Vụ",
  description:
    "Bảng giá tham khảo đóng pin xe điện, sửa pin lithium, lắp camera an ninh, đèn năng lượng mặt trời và pin lưu trữ tại Điện máy pin Minh Hồng.",
  path: "/bao-gia",
});

export default function BaoGiaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
