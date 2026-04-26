import { buildMarketingMetadata } from "@/lib/site";

export const metadata = buildMarketingMetadata({
  title: "Đăng Nhập Hệ Thống",
  description: "Đăng nhập tài khoản để quản lý yêu cầu tư vấn, dịch vụ.",
  path: "/dang-nhap",
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
