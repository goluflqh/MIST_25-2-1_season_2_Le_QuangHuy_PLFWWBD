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
    <div className="flex min-h-[calc(100vh-100px)]">
      <AdminSidebar initialCounts={counts} />

      {/* Main Content */}
      <div className="flex-1 bg-slate-50">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h1 className="font-heading font-bold text-xl text-slate-900">Bảng Điều Khiển</h1>
          <span className="text-sm text-slate-500 font-body">Admin: {admin.name}</span>
        </header>
        <div className="p-6">
          <NotifyProvider>{children}</NotifyProvider>
        </div>
      </div>
    </div>
  );
}
