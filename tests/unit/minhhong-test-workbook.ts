import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ExcelJS from "exceljs";

const workbookPath = resolve("operations/minhhong-admin-import-template-2026-05-26.xlsx");

export async function readCleanMinhHongAdminWorkbookBuffer() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(readFileSync(workbookPath) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const customerSheet = workbook.getWorksheet("Đơn khách");

  if (customerSheet) {
    customerSheet.eachRow((row) => {
      const dateCell = row.getCell(2);
      if (dateCell.value === "37/1/2026") dateCell.value = "27/01/2026";
      if (dateCell.value === "28/012026") dateCell.value = "28/01/2026";
    });
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
