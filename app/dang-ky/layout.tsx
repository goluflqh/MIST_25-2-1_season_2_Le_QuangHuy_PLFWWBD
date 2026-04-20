import { buildMarketingMetadata } from "@/lib/site";

export const metadata = buildMarketingMetadata({
  title: "Đăng Ký Tài Khoản",
  description: "Trở thành đối tác và khách hàng thành viên của Minh Hồng để nhận ưu đãi.",
  path: "/dang-ky",
});

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
