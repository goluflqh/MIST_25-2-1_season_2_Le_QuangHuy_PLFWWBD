import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bảng Giá Dịch Vụ",
  description: "Bảng giá đóng pin Lithium, lắp camera, đèn năng lượng mặt trời, pin lưu trữ tại Minh Hồng. Giá cập nhật mới nhất.",
};

export default function BaoGiaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
