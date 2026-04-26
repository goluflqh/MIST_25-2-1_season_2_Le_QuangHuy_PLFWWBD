import { buildMarketingMetadata } from "@/lib/site";

export const metadata = buildMarketingMetadata({
  title: "Tài Khoản",
  description: "Theo dõi yêu cầu tư vấn, lịch sử dịch vụ và thông tin tài khoản khách hàng.",
  path: "/tai-khoan",
});

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
