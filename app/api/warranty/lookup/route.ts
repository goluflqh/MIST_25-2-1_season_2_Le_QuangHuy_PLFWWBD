import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/warranty/lookup?serial=XXX — Public warranty lookup
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const serial = searchParams.get("serial");
    if (!serial) return NextResponse.json({ success: false, message: "Vui lòng nhập số serial." }, { status: 400 });

    const warranty = await prisma.warranty.findUnique({ where: { serialNo: serial } });
    if (!warranty) return NextResponse.json({ success: false, message: "Không tìm thấy thông tin bảo hành." }, { status: 404 });

    const isValid = new Date() < new Date(warranty.endDate);
    return NextResponse.json({
      success: true,
      warranty: {
        serialNo: warranty.serialNo,
        productName: warranty.productName,
        customerName: warranty.customerName,
        service: warranty.service,
        startDate: warranty.startDate,
        endDate: warranty.endDate,
        notes: warranty.notes,
        isValid,
      },
    });
  } catch (error) {
    console.error("Warranty lookup error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
