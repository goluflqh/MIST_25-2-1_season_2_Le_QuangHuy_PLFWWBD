import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import {
  createServiceOrder,
  serializeServiceOrder,
  ServiceOrderValidationError,
} from "@/lib/service-orders";
import { recordAuditLog, toAuditJson } from "@/lib/audit-log";
import { createInvalidJsonResponse, readJsonBody } from "@/lib/api-route";
import { forbiddenResponse, getCurrentAdminUser } from "@/lib/session";

const MAX_IMPORT_ROWS = 300;

export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse("Không có quyền.");

    const body = await readJsonBody(request);
    if (!body || !Array.isArray(body.orders)) {
      return createInvalidJsonResponse("File import chưa đúng định dạng.");
    }

    const rows = body.orders as Record<string, unknown>[];
    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: "File import chưa có dòng đơn nào." }, { status: 400 });
    }

    if (rows.length > MAX_IMPORT_ROWS) {
      return NextResponse.json(
        { success: false, message: `Mỗi lần chỉ nên import tối đa ${MAX_IMPORT_ROWS} đơn để dễ kiểm tra.` },
        { status: 400 }
      );
    }

    const created = [];
    const failed = [];

    for (let index = 0; index < rows.length; index += 1) {
      try {
        const order = await createServiceOrder(rows[index], "IMPORT");
        created.push(order);
      } catch (error) {
        failed.push({
          rowNumber: index + 2,
          message: error instanceof Error ? error.message : "Dòng này chưa import được.",
        });
      }
    }

    if (created.length > 0) {
      await recordAuditLog({
        action: "SERVICE_ORDER_IMPORT",
        actor: admin,
        entity: "ServiceOrder",
        entityId: null,
        newData: toAuditJson({
          createdCount: created.length,
          failedCount: failed.length,
          orderIds: created.map((order) => order.id),
        }),
        request,
      });
    }

    return NextResponse.json({
      success: true,
      createdCount: created.length,
      failed,
      orders: created.map(serializeServiceOrder),
    });
  } catch (error) {
    console.error("Service orders import error:", error);

    if (error instanceof ServiceOrderValidationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { success: false, message: "Một số mã đơn bị trùng. Hãy để trống cột mã đơn nếu muốn hệ thống tự tạo." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Không import được đơn dịch vụ lúc này." },
      { status: 500 }
    );
  }
}
