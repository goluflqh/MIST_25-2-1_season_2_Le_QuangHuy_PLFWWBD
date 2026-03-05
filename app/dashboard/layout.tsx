import { NotifyProvider } from "@/components/NotifyProvider";
import AdminSidebar from "@/components/AdminSidebar";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side admin role check
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) redirect("/dang-nhap");

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) redirect("/dang-nhap");
  if (session.user.role !== "ADMIN") redirect("/tai-khoan");

  const adminName = session.user.name;

  return (
    <div className="flex min-h-[calc(100vh-100px)]">
      <AdminSidebar />

      {/* Main Content */}
      <div className="flex-1 bg-slate-50">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h1 className="font-heading font-bold text-xl text-slate-900">Bảng Điều Khiển</h1>
          <span className="text-sm text-slate-500 font-body">Admin: {adminName}</span>
        </header>
        <div className="p-6">
          <NotifyProvider>{children}</NotifyProvider>
        </div>
      </div>
    </div>
  );
}
