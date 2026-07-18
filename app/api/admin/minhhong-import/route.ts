import { NextResponse } from "next/server";
import type { MinhHongImportMode } from "@/lib/minhhong-import/api-response";
import {
  MinhHongConfirmationBlockedError,
  MinhHongPreviewChangedError,
  type MinhHongImportSource,
  type MinhHongImportUpload,
  type MinhHongSourceSetupStatus,
  MinhHongSourceSetupRequiredError,
  runMinhHongImport,
} from "@/lib/minhhong-import/application";
import { MinhHongWorkbookImportError, type ImportRunner } from "@/lib/minhhong-import/workbook-importer";
import {
  buildMinhHongSourceImportPreviewFromExports,
  fetchMinhHongSourceSheetExports,
} from "@/lib/minhhong-import/source-sheet";
import type { MinhHongParsedWorkbook } from "@/lib/minhhong-import/workbook-parser";
import { normalizeMinhHongImportScope, type MinhHongImportScope } from "@/lib/minhhong-import/import-scope";
import {
  isMinhHongImportConfirmationEnabled,
  isMinhHongImportScopeEnabled,
  minhHongImportConfirmationDisabledMessage,
  minhHongImportScopeDisabledMessage,
} from "@/lib/minhhong-import/import-policy";
import {
  createMinhHongSourceSheetFetchGuard,
  MinhHongSourceSheetFetchError,
} from "@/lib/minhhong-import/source-fetch-guard";
import {
  getMinhHongManualRequestMaxBytes,
  MINHHONG_MANUAL_WORKBOOK_MAX_BYTES,
  MINHHONG_MANUAL_WORKBOOK_MAX_MB,
  MinhHongRequestBodyTooLargeError,
  readMinhHongRequestBody,
} from "@/lib/minhhong-import/workbook-limits";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, getCurrentAdminUser } from "@/lib/session";

const PREVIEW_FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/;

class WorkbookUploadTooLargeError extends Error {
  status = 413;

  constructor(message: string) {
    super(message);
    this.name = "WorkbookUploadTooLargeError";
  }
}

function manualWorkbookTooLargeError() {
  return new WorkbookUploadTooLargeError(
    `File Excel vượt quá giới hạn ${MINHHONG_MANUAL_WORKBOOK_MAX_MB} MB.`
  );
}

function assertRequestSizeWithinLimit(request: Request) {
  const contentLength = request.headers.get("content-length");
  if (!contentLength || !/^\d+$/.test(contentLength)) return;

  // Multipart includes boundary/header overhead; the parsed File itself is still capped at the exact limit below.
  if (Number(contentLength) > getMinhHongManualRequestMaxBytes(request.headers.get("content-type"))) {
    throw manualWorkbookTooLargeError();
  }
}

function parseMode(request: Request, formData?: FormData): MinhHongImportMode | null {
  const urlMode = new URL(request.url).searchParams.get("mode");
  const formMode = formData?.get("mode");
  const mode = String(urlMode || formMode || "preview").toLowerCase();
  return mode === "preview" || mode === "confirm" ? mode : null;
}

function parseSource(request: Request, formData?: FormData): MinhHongImportSource | null {
  const urlSource = new URL(request.url).searchParams.get("source");
  const formSource = formData?.get("source");
  const source = String(urlSource || formSource || "workbook").toLowerCase();
  if (["workbook", "excel", "xlsx"].includes(source)) return "workbook";
  if (["raw-sheet", "source-sheet", "sheet"].includes(source)) return "raw-sheet";
  return null;
}

function parseScope(request: Request, formData?: FormData) {
  const urlScope = new URL(request.url).searchParams.get("scope");
  const formScope = formData?.get("scope");
  return normalizeMinhHongImportScope(String(urlScope || formScope || "service-orders"));
}

function parsePreviewFingerprint(request: Request, formData?: FormData) {
  const urlFingerprint = new URL(request.url).searchParams.get("previewFingerprint");
  const formFingerprint = formData?.get("previewFingerprint");
  const fingerprint = String(urlFingerprint || formFingerprint || "").trim().toLowerCase();
  return PREVIEW_FINGERPRINT_PATTERN.test(fingerprint) ? fingerprint : null;
}

function isWorkbookFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

function validateWorkbookUpload(upload: MinhHongImportUpload | null) {
  if (!upload) return "Thiếu file workbook cần import.";
  if (!upload.fileName.toLowerCase().endsWith(".xlsx")) return "Chỉ nhận file Excel .xlsx.";
  if (upload.size === 0) return "File workbook đang rỗng.";
  if (upload.size > MINHHONG_MANUAL_WORKBOOK_MAX_BYTES) {
    return `File Excel vượt quá giới hạn ${MINHHONG_MANUAL_WORKBOOK_MAX_MB} MB.`;
  }
  return null;
}

async function readWorkbookUpload(request: Request): Promise<{ formData?: FormData; upload: MinhHongImportUpload | null }> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.toLowerCase().includes("multipart/form-data")) {
    const buffer = await readMinhHongRequestBody(
      request,
      getMinhHongManualRequestMaxBytes(contentType)
    ).catch((error) => {
      if (error instanceof MinhHongRequestBodyTooLargeError) throw manualWorkbookTooLargeError();
      throw error;
    });
    const headers = new Headers(request.headers);
    headers.set("content-length", String(buffer.byteLength));
    const bufferedRequest = new Request(request.url, {
      body: buffer,
      headers,
      method: request.method,
    });
    const formData = await bufferedRequest.formData();
    const workbookField = formData.get("workbook");
    const file = isWorkbookFile(workbookField) ? workbookField : null;
    if (file && file.size > MINHHONG_MANUAL_WORKBOOK_MAX_BYTES) {
      throw manualWorkbookTooLargeError();
    }
    return {
      formData,
      upload: file
        ? {
            buffer: Buffer.from(await file.arrayBuffer()),
            fileName: file.name,
            size: file.size,
          }
        : null,
    };
  }

  const rawName = request.headers.get("x-workbook-name") || "workbook.xlsx";
  const fileName = decodeURIComponent(rawName);
  const buffer = await readMinhHongRequestBody(request, MINHHONG_MANUAL_WORKBOOK_MAX_BYTES)
    .catch((error) => {
      if (error instanceof MinhHongRequestBodyTooLargeError) throw manualWorkbookTooLargeError();
      throw error;
    });
  return {
    formData: undefined,
    upload: {
      buffer,
      fileName,
      size: buffer.byteLength,
    },
  };
}

async function readSourceSheetPreview(scope: MinhHongImportScope): Promise<{
  parsed: MinhHongParsedWorkbook;
  sourceSetup: MinhHongSourceSetupStatus;
}> {
  const sourceExports = await fetchMinhHongSourceSheetExports(createMinhHongSourceSheetFetchGuard(), scope);
  const { parsed, sourceIdPlan } = await buildMinhHongSourceImportPreviewFromExports(sourceExports, scope);

  const setupRequired = sourceIdPlan.requiresSetup;
  return {
    parsed,
    sourceSetup: {
      required: setupRequired,
      ...(setupRequired ? { fingerprint: sourceIdPlan.fingerprint } : {}),
    },
  };
}

export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse("Không có quyền.");

    const sourceFromUrl = parseSource(request);
    if (!sourceFromUrl) {
      return NextResponse.json({ success: false, message: "Nguồn import phải là workbook hoặc raw-sheet." }, { status: 400 });
    }
    if (sourceFromUrl === "workbook") {
      assertRequestSizeWithinLimit(request);
    }
    const scopeFromUrl = parseScope(request);
    if (!scopeFromUrl) {
      return NextResponse.json({ success: false, message: "Phạm vi import phải là all, service-orders hoặc partners." }, { status: 400 });
    }
    if (!isMinhHongImportScopeEnabled(scopeFromUrl)) {
      return NextResponse.json(
        { success: false, message: minhHongImportScopeDisabledMessage(scopeFromUrl) },
        { status: 403 }
      );
    }
    if (parseMode(request) === "confirm" && !isMinhHongImportConfirmationEnabled(scopeFromUrl)) {
      return NextResponse.json(
        { success: false, mode: "confirm", message: minhHongImportConfirmationDisabledMessage(scopeFromUrl) },
        { status: 403 }
      );
    }

    const sourceRead = sourceFromUrl === "raw-sheet"
      ? { formData: undefined, upload: null, ...await readSourceSheetPreview(scopeFromUrl) }
      : { ...await readWorkbookUpload(request), parsed: undefined, sourceSetup: undefined };
    const { formData, parsed, sourceSetup, upload } = sourceRead;
    const mode = parseMode(request, formData);
    if (!mode) {
      return NextResponse.json({ success: false, message: "Mode import phải là preview hoặc confirm." }, { status: 400 });
    }
    const scope = parseScope(request, formData);
    if (!scope) {
      return NextResponse.json({ success: false, message: "Phạm vi import phải là all, service-orders hoặc partners." }, { status: 400 });
    }
    if (!isMinhHongImportScopeEnabled(scope)) {
      return NextResponse.json(
        { success: false, message: minhHongImportScopeDisabledMessage(scope) },
        { status: 403 }
      );
    }
    if (mode === "confirm" && !isMinhHongImportConfirmationEnabled(scope)) {
      return NextResponse.json(
        { success: false, mode, message: minhHongImportConfirmationDisabledMessage(scope) },
        { status: 403 }
      );
    }

    if (sourceFromUrl === "workbook") {
      const fileError = validateWorkbookUpload(upload);
      if (fileError || !upload) {
        return NextResponse.json(
          { success: false, message: fileError || "Workbook chưa đúng định dạng." },
          { status: 400 }
        );
      }
    }

    const commonInput = {
      mode,
      previewFingerprint: parsePreviewFingerprint(request, formData),
      scope,
      sourceSetup,
      userId: admin.id,
    };
    const result = sourceFromUrl === "raw-sheet"
      ? await runMinhHongImport({
          ...commonInput,
          parsed: parsed as MinhHongParsedWorkbook,
          source: "raw-sheet",
        }, prisma as unknown as ImportRunner)
      : await runMinhHongImport({
          ...commonInput,
          source: "workbook",
          upload: upload as MinhHongImportUpload,
        }, prisma as unknown as ImportRunner);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof MinhHongSourceSetupRequiredError) {
      return NextResponse.json(
        {
          success: false,
          mode: "confirm",
          message: "Hãy hoàn tất thiết lập Google Sheet trước khi cập nhật dữ liệu lên web.",
          sourceSetup: error.sourceSetup,
        },
        { status: 409 }
      );
    }
    if (error instanceof MinhHongPreviewChangedError) {
      return NextResponse.json(
        {
          success: false,
          mode: "confirm",
          message: "Dữ liệu vừa thay đổi. Hãy kiểm tra lại trước khi cập nhật lên web.",
        },
        { status: 409 }
      );
    }
    if (error instanceof MinhHongConfirmationBlockedError) {
      return NextResponse.json(error.response, { status: 422 });
    }
    if (error instanceof WorkbookUploadTooLargeError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    if (error instanceof MinhHongSourceSheetFetchError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }

    console.error("Minh Hong workbook import error:", error);

    if (error instanceof MinhHongWorkbookImportError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { success: false, message: "Không xử lý được workbook Minh Hồng lúc này." },
      { status: 500 }
    );
  }
}
