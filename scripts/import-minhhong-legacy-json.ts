import { readFile } from "node:fs/promises";
import { buildLegacyPartnerEntries, buildLegacyServiceOrders, summarizeLegacyImport, type LegacyWorkbookRows } from "../lib/legacy-minhhong-import";
import { prisma } from "../lib/prisma";
import { createServiceOrder } from "../lib/service-orders";

function parseArgs() {
  const args = process.argv.slice(2);
  const jsonPath = args.find((arg) => !arg.startsWith("--"));
  return {
    dryRun: args.includes("--dry-run"),
    jsonPath,
  };
}

async function main() {
  const { dryRun, jsonPath } = parseArgs();
  if (!jsonPath) {
    throw new Error("Usage: npx tsx scripts/import-minhhong-legacy-json.ts <legacy-workbook.json> [--dry-run]");
  }

  const rows = JSON.parse(await readFile(jsonPath, "utf8")) as LegacyWorkbookRows;
  const summary = summarizeLegacyImport(rows);
  const partnerEntries = buildLegacyPartnerEntries(rows);
  const serviceOrders = buildLegacyServiceOrders(rows);

  console.log("Legacy Minh Hồng import summary:", summary);
  if (dryRun) return;

  let createdOrUpdatedEntries = 0;
  let createdOrders = 0;
  let skippedOrders = 0;

  for (const entry of partnerEntries) {
    const partner = await prisma.partner.upsert({
      where: { code: entry.partnerCode },
      update: {
        active: true,
        deletedAt: null,
        name: entry.partnerName,
        type: "SUPPLIER",
      },
      create: {
        active: true,
        code: entry.partnerCode,
        name: entry.partnerName,
        notes: "Đối tác import từ workbook cũ Minh Hồng.",
        type: "SUPPLIER",
      },
    });

    const entryData = {
      amount: entry.amount,
      countsInDebt: entry.countsInDebt,
      description: entry.description,
      entryDate: new Date(entry.entryDate),
      entryType: entry.entryType,
      notes: entry.notes,
      paymentMethod: entry.paymentMethod,
      quantity: entry.quantity,
      reference: entry.reference,
      sourceCode: entry.sourceCode,
      sourceName: entry.sourceName,
      sourceRow: entry.sourceRow,
      unit: entry.unit,
      unitPrice: entry.unitPrice,
    };
    await prisma.partnerLedgerEntry.upsert({
      where: { sourceCode: entry.sourceCode },
      update: {
        ...entryData,
        deletedAt: null,
        partnerId: partner.id,
      },
      create: {
        ...entryData,
        partnerId: partner.id,
      },
    });
    createdOrUpdatedEntries += 1;
  }

  for (const order of serviceOrders) {
    const existing = await prisma.serviceOrder.findUnique({ where: { orderCode: order.orderCode } });
    if (existing && !existing.deletedAt) {
      skippedOrders += 1;
      continue;
    }

    await createServiceOrder(order, "IMPORT");
    createdOrders += 1;
  }

  console.log(`Imported partner ledger entries: ${createdOrUpdatedEntries}`);
  console.log(`Created legacy customer orders: ${createdOrders}`);
  console.log(`Skipped existing legacy customer orders: ${skippedOrders}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
