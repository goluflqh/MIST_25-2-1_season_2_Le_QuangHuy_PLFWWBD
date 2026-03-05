import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dịch Vụ",
  description: "Dịch vụ đóng pin Lithium, lắp camera an ninh, đèn năng lượng mặt trời, pin lưu trữ tại Minh Hồng. Chuyên nghiệp, uy tín.",
};

export default function DichVuLayout({ children }: { children: React.ReactNode }) {
  return children;
}
