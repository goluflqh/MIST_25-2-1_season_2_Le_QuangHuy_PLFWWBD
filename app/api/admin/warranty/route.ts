import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.user.role !== "ADMIN") return null;
  return session.user;
}

// GET — Admin list all warranties
export async function GET() {
  try {
    const admin = await verifyAdmin();
    if (!admin) return NextResponse.json({ success: false }, { status: 403 });
    const warranties = await prisma.warranty.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true, phone: true } } },
    });
    return NextResponse.json({ success: true, warranties });
  } catch (error) {
    console.error("Warranty GET error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// POST — Admin creates warranty (must verify customer phone exists)
export async function POST(request: Request) {
  try {
    const admin = await verifyAdmin();
    if (!admin) return NextResponse.json({ success: false }, { status: 403 });

    const body = await request.json();
    const { serialNo, productName, customerPhone, service, endDate, notes } = body;

    // Verify customer phone exists in User table
    const customer = await prisma.user.findUnique({ where: { phone: customerPhone } });
    if (!customer) {
      return NextResponse.json({
        success: false,
        message: `SĐT ${customerPhone} chưa đăng ký tài khoản. Khách hàng cần tạo tài khoản trước khi tạo phiếu bảo hành.`,
      }, { status: 400 });
    }

    const warranty = await prisma.warranty.create({
      data: {
        serialNo,
        productName,
        customerName: customer.name,
        customerPhone,
        service: service || "KHAC",
        endDate: new Date(endDate),
        notes: notes || null,
        userId: customer.id,
      },
    });

    return NextResponse.json({ success: true, warranty });
  } catch (error) {
    console.error("Warranty POST error:", error);
    return NextResponse.json({ success: false, message: "Lỗi tạo phiếu BH. Serial có thể đã tồn tại." }, { status: 500 });
  }
}

// DELETE — Admin deletes warranty
export async function DELETE(request: Request) {
  try {
    const admin = await verifyAdmin();
    if (!admin) return NextResponse.json({ success: false }, { status: 403 });
    const { id } = await request.json();
    await prisma.warranty.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Warranty DELETE error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
