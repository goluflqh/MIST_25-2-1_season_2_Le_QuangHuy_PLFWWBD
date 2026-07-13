import type { Metadata } from "next";
import WarrantyLookupClient from "./WarrantyLookupClient";

export const metadata: Metadata = {
  title: "Tra Cứu Bảo Hành",
  description:
    "Tra cứu nhanh trạng thái bảo hành Minh Hồng bằng số điện thoại, không cần đăng nhập hay nhớ mã phiếu.",
  alternates: {
    canonical: "/tra-cuu-bao-hanh",
  },
};

export default function WarrantyLookupPage() {
  return <WarrantyLookupClient />;
}
