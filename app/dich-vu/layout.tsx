import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dịch Vụ",
  description:
    "Dịch vụ đóng pin xe điện, sửa pin lithium, lắp camera an ninh, đèn năng lượng mặt trời và pin lưu trữ tại Điện máy pin Minh Hồng Đà Nẵng.",
};

export default function DichVuLayout({ children }: { children: React.ReactNode }) {
  return children;
}
