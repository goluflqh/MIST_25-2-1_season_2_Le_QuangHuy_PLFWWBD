import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  auditDatabaseFinancialSnapshot,
  auditParsedMinhHongWorkbookFinancials,
  auditSourceMatchesDatabase,
  buildDatabaseAuditSnapshotFromPrisma,
  combineFinancialAuditSections,
  type FinancialAuditIssue,
  type FinancialAuditSection,
} from "../lib/minhhong-financial-audit";
import { normalizeMinhHongImportScope, type MinhHongImportScope } from "../lib/minhhong-import/import-scope";
import {
  buildMinhHongSourceImportPreviewFromExports,
  fetchMinhHongSourceSheetExports,
} from "../lib/minhhong-import/source-sheet";
import { parseMinhHongAdminWorkbook, type MinhHongParsedWorkbook } from "../lib/minhhong-import/workbook-parser";
import { prisma } from "../lib/prisma";

type SourceMode = "none" | "raw-sheet" | "workbook";
type DatabaseMode = "check" | "skip";

interface CliOptions {
  compareSourceToDb: boolean;
  db: DatabaseMode;
  scope: MinhHongImportScope;
  source: SourceMode;
  workbookPath: string;
}

const DEFAULT_WORKBOOK = "operations/minhhong-admin-import-template-2026-05-26.xlsx";

function readFlag(name: string, fallback = "") {
  const prefix = `--${name}=`;
  const arg = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

function hasFlag(name: string) {
  return process.argv.slice(2).includes(`--${name}`);
}

function parseSourceMode(value: string): SourceMode {
  if (value === "none" || value === "raw-sheet" || value === "workbook") return value;
  throw new Error("--source must be workbook, raw-sheet, or none.");
}

function parseDatabaseMode(value: string): DatabaseMode {
  if (value === "check" || value === "skip") return value;
  throw new Error("--db must be check or skip.");
}

function parseCliOptions(): CliOptions {
  const scope = normalizeMinhHongImportScope(readFlag("scope", "all"));
  if (!scope) throw new Error("--scope must be all, service-orders, or partners.");

  return {
    compareSourceToDb: hasFlag("compare-source-to-db"),
    db: parseDatabaseMode(readFlag("db", "skip")),
    scope,
    source: parseSourceMode(readFlag("source", "workbook")),
    workbookPath: readFlag("workbook", DEFAULT_WORKBOOK),
  };
}

async function readSourceWorkbook(options: CliOptions): Promise<MinhHongParsedWorkbook | null> {
  if (options.source === "none") return null;

  if (options.source === "raw-sheet") {
    const exportsData = await fetchMinhHongSourceSheetExports(fetch, options.scope);
    return (await buildMinhHongSourceImportPreviewFromExports(exportsData, options.scope)).parsed;
  }

  return parseMinhHongAdminWorkbook(readFileSync(resolve(options.workbookPath)));
}

async function readDatabaseSection(parsed: MinhHongParsedWorkbook | null, options: CliOptions): Promise<FinancialAuditSection | undefined> {
  if (options.db === "skip") return undefined;

  const [serviceOrders, partnerEntries] = await Promise.all([
    prisma.serviceOrder.findMany({
      where: { deletedAt: null },
      select: {
        discountAmount: true,
        id: true,
        orderCode: true,
        paidAmount: true,
        priceStatus: true,
        quotedPrice: true,
        source: true,
      },
    }),
    prisma.partnerLedgerEntry.findMany({
      where: { deletedAt: null },
      include: {
        partner: { select: { code: true } },
      },
    }),
  ]);
  const snapshot = buildDatabaseAuditSnapshotFromPrisma(serviceOrders, partnerEntries);
  const dbSection = auditDatabaseFinancialSnapshot(snapshot);

  if (!parsed || !options.compareSourceToDb) return dbSection;

  const matchSection = auditSourceMatchesDatabase(parsed, snapshot, options.scope);
  return {
    checks: [...dbSection.checks, ...matchSection.checks],
    issues: [...dbSection.issues, ...matchSection.issues],
    ok: dbSection.ok && matchSection.ok,
    summary: { ...dbSection.summary, ...matchSection.summary },
  };
}

function printIssues(title: string, issues: FinancialAuditIssue[]) {
  if (issues.length === 0) return;
  console.log(`\n${title}`);
  for (const item of issues) {
    const label = item.severity === "error" ? "ERROR" : "WARN";
    console.log(`- [${label}] ${item.code}: ${item.message}`);
  }
}

function printSection(title: string, section: FinancialAuditSection | undefined) {
  if (!section) return;
  console.log(`\n${title}: ${section.ok ? "OK" : "FAIL"}`);
  console.log(JSON.stringify(section.summary, null, 2));
  const failedChecks = section.checks.filter((check) => !check.ok);
  if (failedChecks.length > 0) {
    console.log("Failed checks:");
    for (const check of failedChecks) {
      console.log(`- ${check.label}: expected ${check.expected}, got ${check.actual}`);
    }
  }
  printIssues("Issues", section.issues);
}

async function main() {
  const options = parseCliOptions();
  const parsed = await readSourceWorkbook(options);
  const source = parsed ? auditParsedMinhHongWorkbookFinancials(parsed, { scope: options.scope }) : undefined;
  const database = await readDatabaseSection(parsed, options);
  const report = combineFinancialAuditSections({ database, source });

  console.log("Minh Hong financial audit");
  console.log(JSON.stringify({
    compareSourceToDb: options.compareSourceToDb,
    db: options.db,
    scope: options.scope,
    source: options.source,
    workbook: options.source === "workbook" ? options.workbookPath : undefined,
  }, null, 2));

  printSection("Source audit", source);
  printSection("Database audit", database);

  console.log(`\nFinal result: ${report.ok ? "OK" : "FAIL"}`);
  if (!report.ok) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
