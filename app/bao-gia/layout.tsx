import { buildMarketingMetadata } from "@/lib/site";

export const metadata = buildMarketingMetadata({
  title: "Bảng Giá Tham Khảo Dịch Vụ",
  description:
    "Bảng giá tham khảo đóng pin Lithium, lắp camera, đèn năng lượng mặt trời, pin lưu trữ tại Minh Hồng. Giá hiển thị theo dữ liệu báo giá đang được bật và có thể cập nhật.",
  path: "/bao-gia",
});

export default function BaoGiaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
