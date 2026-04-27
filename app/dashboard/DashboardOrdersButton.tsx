"use client";

import { useRouter } from "next/navigation";

export default function DashboardOrdersButton() {
  const router = useRouter();

  return (
    <a
      href="/dashboard/orders"
      data-testid="dashboard-open-orders"
      onClick={(event) => {
        event.preventDefault();
        router.push("/dashboard/orders");
      }}
      className="self-start rounded-xl bg-slate-900 px-4 py-2 text-sm font-body font-bold text-white transition-colors hover:bg-slate-800"
    >
      Mở đơn dịch vụ
    </a>
  );
}
