import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildMinhHongRehearsalReport,
  type MinhHongRehearsalBaselinePolicy,
  type MinhHongRehearsalMode,
} from "../lib/minhhong-import/rehearsal";
import { importMinhHongParsedWorkbook, type ImportRunner } from "../lib/minhhong-import/workbook-importer";
import { parseMinhHongAdminWorkbook } from "../lib/minhhong-import/workbook-parser";
import { reconcileMinhHongWorkbook } from "../lib/minhhong-import/reconciliation";
import { prisma } from "../lib/prisma";

const DEFAULT_WORKBOOK = "operations/minhhong-admin-import-template-2026-05-26.xlsx";
const CONFIRM_DB_VALUES = new Set(["clean", "staging"]);
const IMPORT_SCOPE = "service-orders" as const;

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function hasArg(name: string) {
  return process.argv.includes(name);
}

function readMode(): MinhHongRehearsalMode {
  return hasArg("--confirm") ? "confirm" : "dry-run";
}

function readBaselinePolicy(): MinhHongRehearsalBaselinePolicy {
  if (hasArg("--lock-baseline")) return "locked";
  return String(process.env.MINHHONG_REHEARSAL_BASELINE || "").toLowerCase() === "locked" ? "locked" : "rolling";
}

async function assertCleanRehearsalDatabase() {
  const [partners, partnerEntries, serviceOrders] = await Promise.all([
    prisma.partner.count({ where: { deletedAt: null } }),
    prisma.partnerLedgerEntry.count({ where: { deletedAt: null } }),
    prisma.serviceOrder.count({ where: { deletedAt: null } }),
  ]);

  const totalOperationalRows = partners + partnerEntries + serviceOrders;
  if (totalOperationalRows === 0) return;

  throw new Error(
    `DB rehearsal chưa sạch: partners=${partners}, partnerLedgerEntries=${partnerEntries}, serviceOrders=${serviceOrders}. `
    + "Không dùng DB local/test/e2e/manual lẫn dữ liệu để kết luận số thật."
  );
}

async function main() {
  const mode = readMode();
  const baselinePolicy = readBaselinePolicy();
  const workbookPath = resolve(argValue("--workbook") || DEFAULT_WORKBOOK);
  const parsed = await parseMinhHongAdminWorkbook(readFileSync(workbookPath));
  const reconciliation = reconcileMinhHongWorkbook(parsed, { scope: IMPORT_SCOPE });
  let report = buildMinhHongRehearsalReport(parsed, reconciliation, mode, undefined, { baselinePolicy });

  console.log(JSON.stringify(report, null, 2));

  if (!report.ok) {
    process.exitCode = 1;
    return;
  }

  if (mode === "dry-run") {
    console.log("Dry-run hoàn tất: workbook khớp đối soát, chưa ghi DB.");
    console.log("Muốn confirm rehearsal, chạy với --confirm và MINHHONG_REHEARSAL_DB=clean hoặc staging trên DB sạch/staging.");
    console.log("Mặc định cho phép dữ liệu mới hợp lệ; thêm --lock-baseline nếu cần khóa đúng mốc workbook 26/05.");
    return;
  }

  const rehearsalDb = String(process.env.MINHHONG_REHEARSAL_DB || "").toLowerCase();
  if (!CONFIRM_DB_VALUES.has(rehearsalDb)) {
    throw new Error("Confirm rehearsal yêu cầu MINHHONG_REHEARSAL_DB=clean hoặc staging.");
  }

  await assertCleanRehearsalDatabase();
  const importResult = await importMinhHongParsedWorkbook(parsed, prisma as unknown as ImportRunner, {
    scope: IMPORT_SCOPE,
  });
  report = buildMinhHongRehearsalReport(parsed, reconciliation, mode, importResult, { baselinePolicy });
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
