import { NextResponse } from "next/server";
import { recordAuditLog, toAuditJson } from "@/lib/audit-log";
import { SheetSyncConfigError, syncMinhHongGoogleSheet, type MinhHongSheetSyncScope } from "@/lib/google-sheets-sync";
import { forbiddenResponse, getCurrentAdminUser } from "@/lib/session";

function parseSheetSyncScope(value: string | null): MinhHongSheetSyncScope {
  if (!value) return "all";
  if (value === "all" || value === "service-orders" || value === "partners") return value;
  throw new SheetSyncConfigError("Phạm vi xuất Google Sheet không hợp lệ.");
}

export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse("Không có quyền.");

    const scope = parseSheetSyncScope(new URL(request.url).searchParams.get("scope"));
    const result = await syncMinhHongGoogleSheet(scope);

    await recordAuditLog({
      action: "GOOGLE_SHEET_SYNC",
      actor: admin,
      entity: "GoogleSheet",
      entityId: result.spreadsheetId,
      newData: toAuditJson(result),
      request,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Google Sheet sync error:", error);

    if (error instanceof SheetSyncConfigError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { success: false, message: "Không sync được Google Sheet lúc này. Kiểm tra quyền service account với sheet chuẩn." },
      { status: 500 }
    );
  }
}
