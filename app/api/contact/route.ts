import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, getCurrentAdminUser, getCurrentSession } from "@/lib/session";

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

    // Auto-link to logged-in user if available
    let userId: string | undefined;
    try {
      const session = await getCurrentSession();
      if (session) userId = session.userId;
    } catch { /* ignore — guest user */ }

    const contactRequest = await prisma.contactRequest.create({
      data: {
        name,
        phone,
        service: serviceType,
        message: message || null,
        userId: userId || null,
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
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();

    const contacts = await prisma.contactRequest.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, contacts });
  } catch (error) {
    console.error("Contact GET Error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
