import { NextResponse } from "next/server";
import {
  isMinhHongImportConfirmationEnabled,
  isMinhHongImportScopeEnabled,
  minhHongImportConfirmationDisabledMessage,
  minhHongImportScopeDisabledMessage,
} from "@/lib/minhhong-import/import-policy";
import { normalizeMinhHongImportScope } from "@/lib/minhhong-import/import-scope";
import {
  applyMinhHongSourceIdPlan,
  applyMinhHongSourceSheetSetup,
  buildMinhHongSourceIdPlanFromExports,
  fetchMinhHongSourceSheetExports,
  MinhHongSourceIdPartialWriteError,
  MinhHongSourceIdPlanChangedError,
} from "@/lib/minhhong-import/source-sheet";
import {
  createMinhHongSourceSheetFetchGuard,
  MinhHongSourceSheetFetchError,
} from "@/lib/minhhong-import/source-fetch-guard";
import { hasSameOrigin } from "@/lib/request-origin";
import { forbiddenResponse, getCurrentAdminUser } from "@/lib/session";

const SETUP_FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/;

function parseScope(request: Request) {
  return normalizeMinhHongImportScope(new URL(request.url).searchParams.get("scope") || "service-orders");
}

async function parseSetupFingerprint(request: Request) {
  const body = await request.json().catch(() => null) as { setupFingerprint?: unknown } | null;
  const fingerprint = String(body?.setupFingerprint || "").trim().toLowerCase();
  return SETUP_FINGERPRINT_PATTERN.test(fingerprint) ? fingerprint : null;
}

export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse("Không có quyền.");
    if (!hasSameOrigin(request)) {
      return NextResponse.json(
        { success: false, message: "Yêu cầu không hợp lệ. Hãy thao tác lại từ trang quản trị." },
        { status: 403 }
      );
    }

    const scope = parseScope(request);
    if (!scope) {
      return NextResponse.json({ success: false, message: "Phạm vi cập nhật không hợp lệ." }, { status: 400 });
    }
    if (!isMinhHongImportScopeEnabled(scope)) {
      return NextResponse.json(
        { success: false, message: minhHongImportScopeDisabledMessage(scope) },
        { status: 403 }
      );
    }
    if (!isMinhHongImportConfirmationEnabled(scope)) {
      return NextResponse.json(
        { success: false, message: minhHongImportConfirmationDisabledMessage(scope) },
        { status: 403 }
      );
    }

    const reviewedFingerprint = await parseSetupFingerprint(request);
    if (!reviewedFingerprint) {
      return NextResponse.json(
        { success: false, message: "Dữ liệu kiểm tra đã cũ. Hãy bấm Kiểm tra dữ liệu rồi thử lại." },
        { status: 400 }
      );
    }

    const guardedFetch = createMinhHongSourceSheetFetchGuard();
    const sourceExports = await fetchMinhHongSourceSheetExports(guardedFetch, scope);
    const plan = await buildMinhHongSourceIdPlanFromExports(sourceExports, scope);
    if (!plan.canApply) {
      return NextResponse.json(
        {
          success: false,
          message: "Google Sheet có dữ liệu liên kết chưa hợp lệ. Hãy kiểm tra các dòng được báo rồi thử lại.",
        },
        { status: 422 }
      );
    }

    const result = await applyMinhHongSourceIdPlan(
      plan,
      reviewedFingerprint,
      sourceExports,
      guardedFetch,
      scope
    );
    await applyMinhHongSourceSheetSetup(plan, sourceExports, guardedFetch);

    return NextResponse.json({
      success: true,
      message: "Google Sheet đã sẵn sàng.",
      preparedRows: result.updatedCells,
    });
  } catch (error) {
    if (error instanceof MinhHongSourceIdPlanChangedError) {
      return NextResponse.json(
        {
          success: false,
          message: "Google Sheet vừa được chỉnh sửa. Hệ thống chưa thay đổi dữ liệu; hãy thử lại.",
        },
        { status: 409 }
      );
    }
    if (error instanceof MinhHongSourceIdPartialWriteError) {
      return NextResponse.json(
        {
          success: false,
          message: "Thiết lập chưa hoàn tất. Hãy bấm thử lại để hệ thống kiểm tra và hoàn tất phần còn lại.",
        },
        { status: 409 }
      );
    }
    if (error instanceof MinhHongSourceSheetFetchError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }

    console.error("Minh Hong source Sheet setup error:", error);
    return NextResponse.json(
      { success: false, message: "Chưa hoàn tất được thiết lập Google Sheet lúc này. Hãy thử lại." },
      { status: 500 }
    );
  }
}
