import { createHash } from "node:crypto";
import {
  buildMinhHongImportResponse,
  countMinhHongScopedSkippedRows,
  type MinhHongImportMode,
} from "./api-response";
import {
  isMinhHongImportConfirmationEnabled,
  minhHongImportConfirmationDisabledMessage,
} from "./import-policy";
import type { MinhHongImportScope } from "./import-scope";
import { reconcileMinhHongWorkbook } from "./reconciliation";
import { parseMinhHongAdminWorkbook, type MinhHongParsedWorkbook } from "./workbook-parser";
import {
  importMinhHongParsedWorkbook,
  previewMinhHongParsedWorkbook,
  type ImportRunner,
} from "./workbook-importer";

export interface MinhHongImportUpload {
  buffer: Buffer;
  fileName: string;
  size: number;
}

export interface MinhHongSourceSetupStatus {
  required: boolean;
  fingerprint?: string;
}

export type MinhHongImportSource = "workbook" | "raw-sheet";

interface RunMinhHongImportBaseInput {
  mode: MinhHongImportMode;
  previewFingerprint: string | null;
  scope: MinhHongImportScope;
  sourceSetup?: MinhHongSourceSetupStatus;
  userId: string;
}

type RunMinhHongImportInput = RunMinhHongImportBaseInput & (
  | {
      source: "workbook";
      upload: MinhHongImportUpload;
    }
  | {
      parsed: MinhHongParsedWorkbook;
      source: "raw-sheet";
    }
);

export class MinhHongSourceSetupRequiredError extends Error {
  constructor(public readonly sourceSetup: MinhHongSourceSetupStatus) {
    super("Source Sheet setup is required before confirm.");
    this.name = "MinhHongSourceSetupRequiredError";
  }
}

export class MinhHongPreviewChangedError extends Error {
  constructor() {
    super("The import preview no longer matches the current workbook.");
    this.name = "MinhHongPreviewChangedError";
  }
}

export class MinhHongConfirmationBlockedError extends Error {
  constructor(public readonly response: Record<string, unknown>) {
    super(String(response.message || "Workbook confirmation is blocked."));
    this.name = "MinhHongConfirmationBlockedError";
  }
}

function buildPreviewFingerprint(
  input: RunMinhHongImportInput,
  scope: MinhHongImportScope,
  parsed: unknown,
  reconciliation: unknown,
  changes: unknown
) {
  const hash = createHash("sha256");
  if (input.source === "workbook") hash.update(input.upload.buffer);
  hash.update(JSON.stringify({ source: input.source, scope, parsed, reconciliation, changes }));
  return hash.digest("hex");
}

export async function runMinhHongImport(
  input: RunMinhHongImportInput,
  runner: ImportRunner
) {
  const parsed = input.source === "workbook"
    ? await parseMinhHongAdminWorkbook(input.upload.buffer)
    : input.parsed;
  const reconciliation = reconcileMinhHongWorkbook(parsed, { scope: input.scope });
  const changes = await previewMinhHongParsedWorkbook(parsed, runner, { scope: input.scope });
  const previewFingerprint = buildPreviewFingerprint(
    input,
    input.scope,
    parsed,
    reconciliation,
    changes
  );

  if (input.mode === "preview") {
    const confirmationEnabled = isMinhHongImportConfirmationEnabled(input.scope);
    return {
      ...buildMinhHongImportResponse(
        input.mode,
        parsed,
        reconciliation,
        undefined,
        changes,
        { scope: input.scope }
      ),
      previewFingerprint,
      confirmation: {
        enabled: confirmationEnabled,
        ...(confirmationEnabled
          ? {}
          : { message: minhHongImportConfirmationDisabledMessage(input.scope) }),
      },
      sourceSetup: input.sourceSetup,
    };
  }

  if (input.sourceSetup?.required) {
    throw new MinhHongSourceSetupRequiredError(input.sourceSetup);
  }
  if (input.previewFingerprint !== previewFingerprint) {
    throw new MinhHongPreviewChangedError();
  }
  if (!reconciliation.ok || changes.conflicts.length > 0) {
    throw new MinhHongConfirmationBlockedError({
      success: false,
      mode: input.mode,
      message: changes.conflicts[0] || "Workbook còn lỗi nên chưa thể xác nhận cập nhật.",
      reconciliation,
      changes,
      counts: {
        partners: input.scope === "service-orders" ? 0 : parsed.partners.length,
        partnerEntries: input.scope === "service-orders" ? 0 : parsed.partnerEntries.length,
        customerOrders: input.scope === "partners" ? 0 : parsed.customerOrders.length,
        skippedRows: countMinhHongScopedSkippedRows(parsed, input.scope),
        errors: reconciliation.blockingIssues.length,
      },
    });
  }

  const importResult = await importMinhHongParsedWorkbook(parsed, runner, {
    userId: input.userId,
    scope: input.scope,
  });
  return buildMinhHongImportResponse(
    input.mode,
    parsed,
    reconciliation,
    importResult,
    undefined,
    { scope: input.scope }
  );
}
