import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Đăng Nhập Hệ Thống | Minh Hồng",
  description: "Đăng nhập tài khoản để quản lý yêu cầu tư vấn, dịch vụ.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
