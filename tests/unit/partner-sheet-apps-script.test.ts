import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";

import { buildPartnerPayableSheetFormula } from "../../lib/minhhong-import/source-sheet";

interface PartnerSheetAutomation {
  balanceFormula_: (row: number) => string;
  onEdit: (event: { range: PartnerSheetEditRangeMock }) => void;
  purchaseFormula_: (row: number) => string;
  repairRow_: (sheet: PartnerSheetMock, row: number) => void;
}

interface PartnerSheetMock {
  getName?: () => string;
  getRange: (...coordinates: number[]) => PartnerSheetRangeMock;
}

interface PartnerSheetEditRangeMock {
  getColumn: () => number;
  getLastColumn: () => number;
  getLastRow: () => number;
  getRow: () => number;
  getSheet: () => PartnerSheetMock;
}

interface PartnerSheetRangeMock {
  getDisplayValue: () => string;
  getDisplayValues: () => string[][];
  getFormula: () => string;
  getFormulas: () => string[][];
  getValues: () => unknown[][];
  isBlank: () => boolean;
  setFormula: (formula: string) => PartnerSheetRangeMock;
  setFormulas: (formulas: string[][]) => PartnerSheetRangeMock;
  setNumberFormat: (format: string) => PartnerSheetRangeMock;
}

function createRangeMock(overrides: Partial<PartnerSheetRangeMock> = {}): PartnerSheetRangeMock {
  const mock = {
    getDisplayValue: () => "",
    getFormula: () => "",
    getValues: () => [[""]],
    isBlank: () => false,
    setFormula: () => mock,
    setNumberFormat: () => mock,
    ...overrides,
  } as PartnerSheetRangeMock;
  mock.getDisplayValues ??= () => [[mock.getDisplayValue()]];
  mock.getFormulas ??= () => [[mock.getFormula()]];
  mock.setFormulas ??= (formulas) => mock.setFormula(formulas[0][0]);
  return mock;
}

function loadPartnerSheetAutomation(globals: Record<string, unknown> = {}) {
  const source = readFileSync(
    resolve(process.cwd(), "scripts/google-apps-script/partner-sheet-automation/Code.gs"),
    "utf8"
  );
  const context: Record<string, unknown> = { ...globals };
  vm.runInNewContext(
    `${source}\n;globalThis.__partnerSheetAutomation = { balanceFormula_, onEdit, purchaseFormula_, repairRow_ };`,
    context
  );
  return context.__partnerSheetAutomation as PartnerSheetAutomation;
}

test("Apps Script restores the canonical discount-aware payable formula on every managed row", () => {
  const automation = loadPartnerSheetAutomation();

  for (let row = 89; row <= 3500; row += 1) {
    assert.equal(automation.balanceFormula_(row), buildPartnerPayableSheetFormula(row));
  }
});

test("Apps Script purchase formula calculates both accented and unaccented purchase rows", () => {
  const automation = loadPartnerSheetAutomation();

  assert.equal(
    automation.purchaseFormula_(93),
    '=IF(OR(AND($C93<>"Mua hàng";$C93<>"Mua hang");$E93="";$F93="");"";ROUND($E93*$F93;0))'
  );
});

test("Apps Script onEdit restores a missing payable formula", () => {
  const automation = loadPartnerSheetAutomation();
  let payableFormula = "";
  const range = (overrides: Partial<PartnerSheetRangeMock> = {}) => createRangeMock(overrides);
  const sheet: PartnerSheetMock = {
    getRange: (_row, column) => column === 10
      ? range({
          getFormula: () => payableFormula,
          setFormula: (formula) => {
            payableFormula = formula;
            return range();
          },
        })
      : range(),
  };

  automation.repairRow_(sheet, 93);

  assert.equal(payableFormula, buildPartnerPayableSheetFormula(93));
});

test("Apps Script onEdit replaces a noncanonical payable formula", () => {
  const automation = loadPartnerSheetAutomation();
  let payableFormula = "=A_FUTURE_CANONICAL_FORMULA";
  let payableFormulaWrites = 0;
  const range = (overrides: Partial<PartnerSheetRangeMock> = {}) => createRangeMock(overrides);
  const sheet: PartnerSheetMock = {
    getRange: (_row, column) => {
      if (column === 3) return range({ getDisplayValue: () => "Thanh toán" });
      if (column === 10) {
        return range({
          getFormula: () => payableFormula,
          setFormula: (formula) => {
            payableFormula = formula;
            payableFormulaWrites += 1;
            return range();
          },
        });
      }
      return range();
    },
  };

  automation.repairRow_(sheet, 93);

  assert.equal(payableFormula, buildPartnerPayableSheetFormula(93));
  assert.equal(payableFormulaWrites, 1);
});

test("Apps Script bulk onEdit preserves payment amount formulas and canonical payable formulas", () => {
  const automation = loadPartnerSheetAutomation();
  const firstRow = 93;
  const lastRow = 144;
  const cells = new Map<string, { formula: string; value: unknown }>();
  const key = (row: number, column: number) => `${row}:${column}`;

  for (let row = firstRow; row <= lastRow; row += 1) {
    cells.set(key(row, 3), { formula: "", value: row === firstRow ? "Thanh toán" : "" });
    cells.set(key(row, 7), {
      formula: row === firstRow ? "=CUSTOM_PAYMENT_AMOUNT" : "",
      value: row === firstRow ? 1260750 : "",
    });
    cells.set(key(row, 10), { formula: buildPartnerPayableSheetFormula(row), value: "" });
  }

  const formulaWrites: Array<{ column: number; formula: string; row: number }> = [];
  const range = (row: number, column: number, rowCount = 1): PartnerSheetRangeMock => ({
    getDisplayValue: () => String(cells.get(key(row, column))?.value ?? ""),
    getDisplayValues: () => Array.from({ length: rowCount }, (_, index) => [
      String(cells.get(key(row + index, column))?.value ?? ""),
    ]),
    getFormula: () => cells.get(key(row, column))?.formula ?? "",
    getFormulas: () => Array.from({ length: rowCount }, (_, index) => [
      cells.get(key(row + index, column))?.formula ?? "",
    ]),
    getValues: () => Array.from({ length: rowCount }, (_, index) => [
      cells.get(key(row + index, column))?.value ?? "",
    ]),
    isBlank: () => false,
    setFormula: (formula: string) => {
      formulaWrites.push({ column, formula, row });
      cells.set(key(row, column), { formula, value: "" });
      return range(row, column, rowCount);
    },
    setFormulas: (formulas: string[][]) => {
      formulas.forEach(([formula], index) => {
        formulaWrites.push({ column, formula, row: row + index });
        cells.set(key(row + index, column), { formula, value: "" });
      });
      return range(row, column, rowCount);
    },
    setNumberFormat: () => range(row, column, rowCount),
  } as PartnerSheetRangeMock);
  const sheet: PartnerSheetMock = {
    getName: () => "Đơn đối tác",
    getRange: (row, column, rowCount = 1) => range(row, column, rowCount),
  };
  const editRange: PartnerSheetEditRangeMock = {
    getColumn: () => 3,
    getLastColumn: () => 3,
    getLastRow: () => lastRow,
    getRow: () => firstRow,
    getSheet: () => sheet,
  };

  automation.onEdit({ range: editRange });

  assert.equal(cells.get(key(firstRow, 7))?.formula, "=CUSTOM_PAYMENT_AMOUNT");
  assert.equal(cells.get(key(firstRow, 10))?.formula, buildPartnerPayableSheetFormula(firstRow));
  assert.equal(formulaWrites.some((write) => write.row === firstRow && write.column === 7), false);
  assert.equal(formulaWrites.some((write) => write.row === firstRow && write.column === 10), false);
});

test("Apps Script bulk partner paste reads the partner catalog once", () => {
  const firstRow = 93;
  const lastRow = 144;
  let activeSpreadsheetReads = 0;
  const catalogValues = Array.from({ length: 999 }, (_, index) => [index === 0 ? "Long" : ""]);
  const catalogRange = (address: string) => {
    const mock = {
      getDisplayValues: () => address === "A2:A1000" ? catalogValues : [[""]],
      getValue: () => address === "A1" ? "Tên đối tác" : "",
      setBackground: () => mock,
      setFontColor: () => mock,
      setFontWeight: () => mock,
      setValue: () => mock,
    };
    return mock;
  };
  const catalog = {
    getMaxRows: () => 1000,
    getRange: (address: string) => catalogRange(address),
    isSheetHidden: () => true,
  };
  const spreadsheet = {
    getSheetByName: () => catalog,
  };
  const automation = loadPartnerSheetAutomation({
    SpreadsheetApp: {
      getActiveSpreadsheet: () => {
        activeSpreadsheetReads += 1;
        return spreadsheet;
      },
    },
  });
  const range = (row: number, column: number, rowCount = 1): PartnerSheetRangeMock => ({
    getDisplayValue: () => column === 2 ? "Long" : "",
    getDisplayValues: () => Array.from({ length: rowCount }, (_, index) => [
      column === 2 ? "Long" : column === 3 ? "" : String(row + index),
    ]),
    getFormula: () => column === 10 ? buildPartnerPayableSheetFormula(row) : "",
    getFormulas: () => Array.from({ length: rowCount }, (_, index) => [
      column === 10 ? buildPartnerPayableSheetFormula(row + index) : "",
    ]),
    getValues: () => Array.from({ length: rowCount }, () => [""]),
    isBlank: () => false,
    setFormula: () => range(row, column, rowCount),
    setFormulas: () => range(row, column, rowCount),
    setNumberFormat: () => range(row, column, rowCount),
    setValue: () => range(row, column, rowCount),
    setValues: () => range(row, column, rowCount),
  } as PartnerSheetRangeMock);
  const sheet: PartnerSheetMock = {
    getName: () => "Đơn đối tác",
    getRange: (row, column, rowCount = 1) => range(row, column, rowCount),
  };

  automation.onEdit({
    range: {
      getColumn: () => 2,
      getLastColumn: () => 2,
      getLastRow: () => lastRow,
      getRow: () => firstRow,
      getSheet: () => sheet,
    },
  });

  assert.equal(activeSpreadsheetReads, 1);
});

test("Apps Script onEdit keeps discount input formatted as a literal percent", () => {
  const automation = loadPartnerSheetAutomation();
  let discountFormat = "";
  const range = (overrides: Partial<PartnerSheetRangeMock> = {}) => createRangeMock({
    getFormula: () => buildPartnerPayableSheetFormula(93),
    ...overrides,
  });
  const sheet: PartnerSheetMock = {
    getRange: (_row, column) => column === 13
      ? range({
          setNumberFormat: (format) => {
            discountFormat = format;
            return range();
          },
        })
      : range(),
  };

  automation.repairRow_(sheet, 93);

  assert.equal(discountFormat, 'General"%"');
});
