import { redirect } from "next/navigation";
import AdminSidebar from "@/components/AdminSidebar";
import { NotifyProvider } from "@/components/NotifyProvider";
import { getAdminNotificationCounts } from "@/lib/notifications";
import { getCurrentSessionUser } from "@/lib/session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getCurrentSessionUser();

  if (!admin) redirect("/dang-nhap");
  if (admin.role !== "ADMIN") redirect("/tai-khoan");

  const counts = await getAdminNotificationCounts();

  return (
    <AdminSidebar adminName={admin.name} initialCounts={counts}>
      <NotifyProvider>{children}</NotifyProvider>
    </AdminSidebar>
  );
}
