import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, phone, service, message } = body;

    if (!name || !phone || !service) {
      return NextResponse.json(
        { success: false, message: "Thiếu thông tin bắt buộc (tên, SĐT, dịch vụ)." },
        { status: 400 }
      );
    }

    const validServices = ["DONG_PIN", "DEN_NLMT", "PIN_LUU_TRU", "CAMERA", "CUSTOM", "KHAC"];
    const serviceType = validServices.includes(service) ? service : "KHAC";

    const contactRequest = await prisma.contactRequest.create({
      data: {
        name,
        phone,
        service: serviceType,
        message: message || null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Yêu cầu đã được gửi thành công. Đội ngũ kỹ thuật sẽ liên hệ với bạn trong vòng 15 phút.",
        id: contactRequest.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Contact API Error:", error);
    return NextResponse.json(
      { success: false, message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;
    if (!token) return NextResponse.json({ success: false }, { status: 401 });

    const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ success: false }, { status: 403 });
    }

    const contacts = await prisma.contactRequest.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, contacts });
  } catch (error) {
    console.error("Contact GET Error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
