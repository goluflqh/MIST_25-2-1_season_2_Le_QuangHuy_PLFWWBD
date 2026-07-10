import { NextResponse } from "next/server";
import { buildMinhHongImportResponse, countMinhHongScopedSkippedRows, type MinhHongImportMode } from "@/lib/minhhong-import/api-response";
import { importMinhHongParsedWorkbook, MinhHongWorkbookImportError, previewMinhHongParsedWorkbook, type ImportRunner } from "@/lib/minhhong-import/workbook-importer";
import {
  applyMinhHongSourceSheetDateRepairs,
  buildMinhHongSourceImportWorkbookFromExports,
  buildMinhHongSourceSheetDateFormatTargetsFromExports,
  buildMinhHongSourceSheetDateRepairsFromExports,
  fetchMinhHongSourceSheetExports,
  type MinhHongSourceSheetDateFormatTarget,
  type MinhHongSourceSheetDateRepair,
} from "@/lib/minhhong-import/source-sheet";
import { normalizeMinhHongImportScope, type MinhHongImportScope } from "@/lib/minhhong-import/import-scope";
import { parseMinhHongAdminWorkbook } from "@/lib/minhhong-import/workbook-parser";
import { reconcileMinhHongWorkbook } from "@/lib/minhhong-import/reconciliation";
import {
  createMinhHongSourceSheetFetchGuard,
  MinhHongSourceSheetFetchError,
} from "@/lib/minhhong-import/source-fetch-guard";
import {
  getMinhHongManualRequestMaxBytes,
  MINHHONG_MANUAL_WORKBOOK_MAX_BYTES,
  MINHHONG_MANUAL_WORKBOOK_MAX_MB,
  MinhHongRequestBodyTooLargeError,
  MINHHONG_SOURCE_WORKBOOK_MAX_BYTES,
  MINHHONG_SOURCE_WORKBOOK_MAX_MB,
  readMinhHongRequestBody,
} from "@/lib/minhhong-import/workbook-limits";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, getCurrentAdminUser } from "@/lib/session";

interface WorkbookUpload {
  buffer: Buffer;
  dateFormatTargets?: MinhHongSourceSheetDateFormatTarget[];
  dateRepairs?: MinhHongSourceSheetDateRepair[];
  fileName: string;
  size: number;
}

type MinhHongImportSource = "workbook" | "raw-sheet";

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

function sourceWorkbookTooLargeError() {
  return new WorkbookUploadTooLargeError(
    `Workbook sinh từ Sheet gốc vượt quá giới hạn ${MINHHONG_SOURCE_WORKBOOK_MAX_MB} MB. Sheet gốc không bị thay đổi.`
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
  return normalizeMinhHongImportScope(String(urlScope || formScope || "all"));
}

function isWorkbookFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

function validateWorkbookUpload(upload: WorkbookUpload | null, source: MinhHongImportSource) {
  if (!upload) return "Thiếu file workbook cần import.";
  if (!upload.fileName.toLowerCase().endsWith(".xlsx")) return "Chỉ nhận file Excel .xlsx.";
  if (upload.size === 0) return "File workbook đang rỗng.";
  if (source === "workbook" && upload.size > MINHHONG_MANUAL_WORKBOOK_MAX_BYTES) {
    return `File Excel vượt quá giới hạn ${MINHHONG_MANUAL_WORKBOOK_MAX_MB} MB.`;
  }
  if (source === "raw-sheet" && upload.size > MINHHONG_SOURCE_WORKBOOK_MAX_BYTES) {
    return `Workbook sinh từ Sheet gốc vượt quá giới hạn ${MINHHONG_SOURCE_WORKBOOK_MAX_MB} MB. Sheet gốc không bị thay đổi.`;
  }
  return null;
}

async function readWorkbookUpload(request: Request): Promise<{ formData?: FormData; upload: WorkbookUpload | null }> {
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

async function readSourceSheetWorkbook(scope: MinhHongImportScope): Promise<WorkbookUpload> {
  const sourceExports = await fetchMinhHongSourceSheetExports(createMinhHongSourceSheetFetchGuard());
  const buffer = await buildMinhHongSourceImportWorkbookFromExports(sourceExports);
  if (buffer.byteLength > MINHHONG_SOURCE_WORKBOOK_MAX_BYTES) {
    throw sourceWorkbookTooLargeError();
  }
  const shouldRepairCustomerDates = scope !== "partners";
  const dateFormatTargets = shouldRepairCustomerDates ? buildMinhHongSourceSheetDateFormatTargetsFromExports(sourceExports) : [];
  const dateRepairs = shouldRepairCustomerDates ? await buildMinhHongSourceSheetDateRepairsFromExports(sourceExports) : [];

  return {
    buffer,
    dateFormatTargets,
    dateRepairs,
    fileName: "minhhong-raw-source-sheets.xlsx",
    size: buffer.byteLength,
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

    const { formData, upload } = sourceFromUrl === "raw-sheet"
      ? { formData: undefined, upload: await readSourceSheetWorkbook(scopeFromUrl) }
      : await readWorkbookUpload(request);
    const mode = parseMode(request, formData);
    const source = parseSource(request, formData);
    if (!mode) {
      return NextResponse.json({ success: false, message: "Mode import phải là preview hoặc confirm." }, { status: 400 });
    }
    if (!source) {
      return NextResponse.json({ success: false, message: "Nguồn import phải là workbook hoặc raw-sheet." }, { status: 400 });
    }
    const scope = parseScope(request, formData);
    if (!scope) {
      return NextResponse.json({ success: false, message: "Phạm vi import phải là all, service-orders hoặc partners." }, { status: 400 });
    }

    const fileError = validateWorkbookUpload(upload, source);
    if (fileError || !upload) {
      return NextResponse.json({ success: false, message: fileError || "Workbook chưa đúng định dạng." }, { status: 400 });
    }

    const parsed = await parseMinhHongAdminWorkbook(upload.buffer);
    const reconciliation = reconcileMinhHongWorkbook(parsed, { scope });
    const changes = await previewMinhHongParsedWorkbook(parsed, prisma as unknown as ImportRunner, { scope });

    if (mode === "preview") {
      return NextResponse.json(buildMinhHongImportResponse(mode, parsed, reconciliation, undefined, changes, {
        scope,
        sourceSheetDateRepairs: source === "raw-sheet" && scope !== "partners" ? upload.dateRepairs?.length || 0 : undefined,
      }));
    }

    if (!reconciliation.ok || changes.conflicts.length > 0) {
      return NextResponse.json(
        {
          success: false,
          mode,
          message: changes.conflicts[0] || "Workbook còn lỗi nên chưa thể xác nhận cập nhật.",
          reconciliation,
          changes,
          counts: {
            partners: scope === "service-orders" ? 0 : parsed.partners.length,
            partnerEntries: scope === "service-orders" ? 0 : parsed.partnerEntries.length,
            customerOrders: scope === "partners" ? 0 : parsed.customerOrders.length,
            skippedRows: countMinhHongScopedSkippedRows(parsed, scope),
            errors: reconciliation.blockingIssues.length,
          },
        },
        { status: 422 }
      );
    }

    const importResult = await importMinhHongParsedWorkbook(parsed, prisma as unknown as ImportRunner, { userId: admin.id, scope });
    let sourceSheetDateRepairs = 0;
    let sourceSheetDateRepairWarning: string | null = null;
    if (source === "raw-sheet" && scope !== "partners" && ((upload.dateRepairs?.length || 0) > 0 || (upload.dateFormatTargets?.length || 0) > 0)) {
      try {
        const repairResult = await applyMinhHongSourceSheetDateRepairs(upload.dateRepairs || [], fetch, {
          formatTargets: upload.dateFormatTargets,
        });
        sourceSheetDateRepairs = repairResult.updatedCells;
      } catch (repairError) {
        sourceSheetDateRepairWarning = "Đã áp dụng dữ liệu vào web nhưng chưa sửa được ngày trên Sheet gốc: "
          + (repairError instanceof Error ? repairError.message : "Google Sheets API chưa xử lý được.");
      }
    }
    return NextResponse.json(buildMinhHongImportResponse(
      mode,
      parsed,
      reconciliation,
      {
        ...importResult,
        sourceSheetDateRepairs,
        warnings: sourceSheetDateRepairWarning
          ? [...importResult.warnings, sourceSheetDateRepairWarning]
          : importResult.warnings,
      },
      undefined,
      {
        scope,
        sourceSheetDateRepairs: source === "raw-sheet" && scope !== "partners" ? upload.dateRepairs?.length || 0 : undefined,
      }
    ));
  } catch (error) {
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
