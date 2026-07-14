import { NextResponse } from "next/server";
import {
  buildMinhHongSourceSheetLink,
  getDefaultMinhHongSourceSheetLinkTargetId,
  getMinhHongSourceSheetLinkTargets,
  type MinhHongSourceSheetLinkScope,
  type MinhHongSourceSheetLinkTargetId,
} from "@/lib/minhhong-import/source-sheet";
import { normalizeMinhHongImportScope } from "@/lib/minhhong-import/import-scope";
import { getCurrentAdminUser } from "@/lib/session";

function unauthenticatedRedirect(request: Request) {
  const requestUrl = new URL(request.url);
  const requestHost = request.headers.get("host")?.trim();
  const localHostUrl = requestHost ? new URL(`http://${requestHost}`) : null;
  if (localHostUrl && ["localhost", "127.0.0.1"].includes(localHostUrl.hostname)) {
    requestUrl.host = localHostUrl.host;
  }

  // Local cookies are hostname-scoped; keep links on the canonical dev hostname.
  if (requestUrl.hostname === "localhost") {
    requestUrl.hostname = "127.0.0.1";
    return NextResponse.redirect(requestUrl);
  }

  const loginUrl = new URL("/dang-nhap", requestUrl);
  loginUrl.searchParams.set("redirect", `${requestUrl.pathname}${requestUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

function parseScope(request: Request): MinhHongSourceSheetLinkScope | null {
  return normalizeMinhHongImportScope(new URL(request.url).searchParams.get("scope") || "all");
}

function parseTargetId(request: Request, scope: MinhHongSourceSheetLinkScope): MinhHongSourceSheetLinkTargetId | null {
  const requested = new URL(request.url).searchParams.get("target") as MinhHongSourceSheetLinkTargetId | null;
  const allowedTargets = getMinhHongSourceSheetLinkTargets(scope);
  if (!requested) return getDefaultMinhHongSourceSheetLinkTargetId(scope);
  return allowedTargets.some((target) => target.id === requested) ? requested : null;
}

export async function GET(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return unauthenticatedRedirect(request);

    const scope = parseScope(request);
    if (!scope) {
      return NextResponse.json({ success: false, message: "Phạm vi Sheet phải là all, service-orders hoặc partners." }, { status: 400 });
    }

    const targetId = parseTargetId(request, scope);
    if (!targetId) {
      return NextResponse.json({ success: false, message: "Sheet gốc cần mở không hợp lệ với trang hiện tại." }, { status: 400 });
    }

    const link = await buildMinhHongSourceSheetLink(targetId);
    return NextResponse.redirect(link.url);
  } catch (error) {
    console.error("Minh Hong source Sheet link error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Không tạo được link Sheet gốc lúc này.",
      },
      { status: 500 }
    );
  }
}
