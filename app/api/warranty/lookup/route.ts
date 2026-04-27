import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidPhone, normalizePhone, sanitizeText } from "@/lib/sanitize";

function serializeWarranty(warranty: {
  id: string;
  serialNo: string;
  productName: string;
  customerName: string;
  customerPhone: string;
  service: string;
  startDate: Date;
  endDate: Date;
  notes: string | null;
}) {
  return {
    id: warranty.id,
    serialNo: warranty.serialNo,
    productName: warranty.productName,
    customerName: warranty.customerName,
    customerPhone: warranty.customerPhone,
    service: warranty.service,
    startDate: warranty.startDate,
    endDate: warranty.endDate,
    notes: warranty.notes,
    isValid: new Date() < new Date(warranty.endDate),
  };
}

// GET /api/warranty/lookup?query=XXX — Public warranty lookup by serial or phone.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const explicitSerial = sanitizeText(searchParams.get("serial") || "");
    const explicitPhone = sanitizeText(searchParams.get("phone") || "");
    const query = sanitizeText(searchParams.get("query") || "");
    const rawLookup = explicitSerial || explicitPhone || query;

    if (!rawLookup) {
      return NextResponse.json(
        { success: false, message: "Vui lòng nhập số serial hoặc số điện thoại." },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhone(explicitPhone || query);
    const shouldLookupPhone = Boolean(explicitPhone) || (!explicitSerial && isValidPhone(normalizedPhone));

    if (shouldLookupPhone) {
      if (!isValidPhone(normalizedPhone)) {
        return NextResponse.json(
          { success: false, message: "Số điện thoại tra cứu chưa đúng định dạng." },
          { status: 400 }
        );
      }

      const warranties = await prisma.warranty.findMany({
        where: { customerPhone: normalizedPhone, deletedAt: null },
        orderBy: [{ createdAt: "desc" }, { endDate: "desc" }],
      });

      if (warranties.length === 0) {
        return NextResponse.json(
          { success: false, message: "Không tìm thấy phiếu bảo hành theo số điện thoại này." },
          { status: 404 }
        );
      }

      const serialized = warranties.map(serializeWarranty);
      return NextResponse.json({
        success: true,
        lookupType: "phone",
        warranty: serialized[0],
        warranties: serialized,
      });
    }

    const serial = sanitizeText(explicitSerial || query).toUpperCase();
    const warranty = await prisma.warranty.findFirst({
      where: {
        deletedAt: null,
        serialNo: { equals: serial, mode: "insensitive" },
      },
    });

    if (!warranty) {
      return NextResponse.json(
        { success: false, message: "Không tìm thấy thông tin bảo hành." },
        { status: 404 }
      );
    }

    const serialized = serializeWarranty(warranty);
    return NextResponse.json({
      success: true,
      lookupType: "serial",
      warranty: serialized,
      warranties: [serialized],
    });
  } catch (error) {
    console.error("Warranty lookup error:", error);
    return NextResponse.json(
      { success: false, message: "Chưa tra cứu được bảo hành lúc này." },
      { status: 500 }
    );
  }
}
