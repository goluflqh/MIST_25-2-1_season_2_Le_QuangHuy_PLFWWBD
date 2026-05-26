import { NextResponse } from "next/server";
import { recordAuditLog, toAuditJson } from "@/lib/audit-log";
import { SheetSyncConfigError, syncMinhHongGoogleSheet } from "@/lib/google-sheets-sync";
import { forbiddenResponse, getCurrentAdminUser } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse("Không có quyền.");

    const result = await syncMinhHongGoogleSheet();

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
