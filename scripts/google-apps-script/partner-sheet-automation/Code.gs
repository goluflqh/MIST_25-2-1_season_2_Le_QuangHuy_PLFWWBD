const PARTNER_CONFIG = Object.freeze({
  sheetName: 'Đơn đối tác',
  catalogName: 'Danh mục đối tác',
  discountColumn: 13,
  firstInputRow: 89,
  lastInputRow: 3500,
});

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('MINH HỒNG')
    .addItem('Sửa công thức và định dạng', 'repairPartnerSheet')
    .addItem('Kiểm tra tự động', 'selfTestPartnerSheet')
    .addToUi();
}

function onEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  if (sheet.getName() !== PARTNER_CONFIG.sheetName) return;

  const firstRow = Math.max(e.range.getRow(), PARTNER_CONFIG.firstInputRow);
  const lastRow = Math.min(e.range.getLastRow(), PARTNER_CONFIG.lastInputRow);
  if (firstRow > lastRow) return;

  const partnerColumnWasEdited = e.range.getColumn() <= 2 && e.range.getLastColumn() >= 2;

  if (partnerColumnWasEdited) {
    const partnerRange = sheet.getRange(firstRow, 2, lastRow - firstRow + 1, 1);
    const rawPartnerNames = partnerRange.getDisplayValues().map(([name]) => name);
    const normalizedPartnerNames = rawPartnerNames.map((name) => name.trim().replace(/\s+/g, ' '));
    if (normalizedPartnerNames.some((name, index) => name !== rawPartnerNames[index])) {
      partnerRange.setValues(normalizedPartnerNames.map((name) => [name]));
    }
    registerPartners_(normalizedPartnerNames);
  }

  repairRows_(sheet, firstRow, lastRow);
}

function repairPartnerSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(PARTNER_CONFIG.sheetName);
  if (!sheet) throw new Error('Không tìm thấy tab Đơn đối tác.');

  if (sheet.getMaxRows() < PARTNER_CONFIG.lastInputRow) {
    sheet.insertRowsAfter(sheet.getMaxRows(), PARTNER_CONFIG.lastInputRow - sheet.getMaxRows());
  }

  const catalog = ensurePartnerCatalog_();
  const rowCount = PARTNER_CONFIG.lastInputRow - PARTNER_CONFIG.firstInputRow + 1;
  const template = sheet.getRange(PARTNER_CONFIG.firstInputRow, 1, 1, PARTNER_CONFIG.discountColumn);
  const inputRange = sheet.getRange(
    PARTNER_CONFIG.firstInputRow,
    1,
    rowCount,
    PARTNER_CONFIG.discountColumn
  );
  template.copyTo(inputRange, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);

  applyValidations_(sheet, catalog);
  sheet.setRowHeights(PARTNER_CONFIG.firstInputRow, rowCount, 34);
  sheet.getRange(PARTNER_CONFIG.firstInputRow, 5, rowCount, 1).setNumberFormat('0');
  sheet.getRange(PARTNER_CONFIG.firstInputRow, 6, rowCount, 2).setNumberFormat('#,##0"đ"');
  sheet.getRange(PARTNER_CONFIG.firstInputRow, 10, rowCount, 1).setNumberFormat('#,##0"đ"');
  sheet.getRange(
    PARTNER_CONFIG.firstInputRow,
    PARTNER_CONFIG.discountColumn,
    rowCount,
    1
  ).setNumberFormat('General"%"');

  repairRows_(sheet, PARTNER_CONFIG.firstInputRow, PARTNER_CONFIG.lastInputRow);

  SpreadsheetApp.flush();
  spreadsheet.toast('Đã phục hồi công thức, định dạng và dropdown đến dòng 3500.', 'MINH HỒNG', 5);
}

function repairRow_(sheet, row) {
  if (row < PARTNER_CONFIG.firstInputRow || row > PARTNER_CONFIG.lastInputRow) return;

  repairRows_(sheet, row, row);
}

function repairRows_(sheet, firstRow, lastRow) {
  if (firstRow > lastRow) return;

  const rowCount = lastRow - firstRow + 1;
  const transactionTypes = sheet.getRange(firstRow, 3, rowCount, 1).getDisplayValues();
  const amountRange = sheet.getRange(firstRow, 7, rowCount, 1);
  const amountValues = amountRange.getValues();
  const amountFormulas = amountRange.getFormulas();
  const balanceFormulas = sheet.getRange(firstRow, 10, rowCount, 1).getFormulas();
  const amountRepairs = [];
  const balanceRepairs = [];

  for (let index = 0; index < rowCount; index += 1) {
    const row = firstRow + index;
    const transactionType = transactionTypes[index][0].trim();
    const amountValue = amountValues[index][0];
    const amountFormula = amountFormulas[index][0];
    const expectedAmountFormula = purchaseFormula_(row);
    const isPurchase = transactionType === 'Mua hàng' || transactionType === 'Mua hang';
    const isUnusedBlankRow = !transactionType
      && !amountFormula
      && (amountValue === '' || amountValue == null);

    amountRepairs.push(
      (isPurchase && !formulasMatch_(amountFormula, expectedAmountFormula)) || isUnusedBlankRow
        ? expectedAmountFormula
        : null
    );

    const expectedBalanceFormula = balanceFormula_(row);
    balanceRepairs.push(
      formulasMatch_(balanceFormulas[index][0], expectedBalanceFormula)
        ? null
        : expectedBalanceFormula
    );
  }

  applyFormulaRepairs_(sheet, firstRow, 7, amountRepairs);
  applyFormulaRepairs_(sheet, firstRow, 10, balanceRepairs);

  sheet.getRange(firstRow, 5, rowCount, 1).setNumberFormat('0');
  sheet.getRange(firstRow, 6, rowCount, 2).setNumberFormat('#,##0"đ"');
  sheet.getRange(firstRow, 10, rowCount, 1).setNumberFormat('#,##0"đ"');
  sheet.getRange(firstRow, PARTNER_CONFIG.discountColumn, rowCount, 1).setNumberFormat('General"%"');
}

function applyFormulaRepairs_(sheet, firstRow, column, repairs) {
  let segmentStart = -1;
  let segmentFormulas = [];

  const flushSegment = () => {
    if (segmentStart < 0) return;
    sheet.getRange(firstRow + segmentStart, column, segmentFormulas.length, 1)
      .setFormulas(segmentFormulas.map((formula) => [formula]));
    segmentStart = -1;
    segmentFormulas = [];
  };

  for (let index = 0; index <= repairs.length; index += 1) {
    const formula = repairs[index];
    if (formula) {
      if (segmentStart < 0) segmentStart = index;
      segmentFormulas.push(formula);
    } else {
      flushSegment();
    }
  }
}

function formulasMatch_(actual, expected) {
  const normalize = (formula) => String(formula || '')
    .trim()
    .replace(/^=/, '')
    .replace(/,/g, ';')
    .replace(/\s+/g, '');
  return normalize(actual) === normalize(expected);
}

function purchaseFormula_(row) {
  return `=IF(OR(AND($C${row}<>"Mua hàng";$C${row}<>"Mua hang");$E${row}="";$F${row}="");"";ROUND($E${row}*$F${row};0))`;
}

function balanceFormula_(row) {
  const currentRowCounts = `OR($K${row}="";$K${row}="Có";$K${row}="Co";$K${row}="Yes";$K${row}="True";$K${row}="1")`;
  const countedRows = `((($K$2:$K${row}="")+($K$2:$K${row}="Có")+($K$2:$K${row}="Co")+($K$2:$K${row}="Yes")+($K$2:$K${row}="True")+($K$2:$K${row}="1"))>0)`;
  const negativeTypes = `((($C$2:$C${row}="Thanh toán")+($C$2:$C${row}="Thanh toan")+($C$2:$C${row}="Trả hàng")+($C$2:$C${row}="Tra hang"))>0)`;
  const purchaseTypes = `((($C$2:$C${row}="Mua hàng")+($C$2:$C${row}="Mua hang"))>0)`;
  return `=IF(OR($B${row}="";$C${row}="";$G${row}="");"";IF(NOT(${currentRowCounts});"";SUMPRODUCT(($B$2:$B${row}=$B${row})*${countedRows}*$G$2:$G${row}*(1-2*${negativeTypes}))-SUMPRODUCT(($B$2:$B${row}=$B${row})*${countedRows}*${purchaseTypes}*$G$2:$G${row}*IFERROR($M$2:$M${row}/100;0))))`;
}

function ensurePartnerCatalog_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let catalog = spreadsheet.getSheetByName(PARTNER_CONFIG.catalogName);
  if (!catalog) catalog = spreadsheet.insertSheet(PARTNER_CONFIG.catalogName);

  if (catalog.getMaxRows() < 1000) catalog.insertRowsAfter(catalog.getMaxRows(), 1000 - catalog.getMaxRows());
  if (catalog.getRange('A1').getValue() !== 'Tên đối tác') catalog.getRange('A1').setValue('Tên đối tác');

  const existingNames = catalog.getRange('A2:A1000').getDisplayValues().flat().map((name) => name.trim()).filter(Boolean);
  if (!existingNames.some((name) => name.toLocaleLowerCase('vi-VN') === 'long')) {
    catalog.getRange(Math.max(catalog.getLastRow() + 1, 2), 1).setValue('Long');
  }

  catalog.getRange('A1:B1').setFontWeight('bold').setBackground('#0f4c81').setFontColor('#ffffff');
  if (!catalog.isSheetHidden()) catalog.hideSheet();
  return catalog;
}

function registerPartner_(name) {
  return registerPartners_([name])[0] || null;
}

function registerPartners_(names) {
  const uniqueCandidates = [];
  const candidateKeys = new Set();
  names.forEach((name) => {
    if (!name || name === 'Khác') return;
    const key = name.toLocaleLowerCase('vi-VN');
    if (candidateKeys.has(key)) return;
    candidateKeys.add(key);
    uniqueCandidates.push(name);
  });
  if (!uniqueCandidates.length) return [];

  const catalog = ensurePartnerCatalog_();
  const catalogNames = catalog.getRange('A2:A1000').getDisplayValues().flat();
  const existingKeys = new Set(
    catalogNames.map((name) => name.trim()).filter(Boolean).map((name) => name.toLocaleLowerCase('vi-VN'))
  );
  const missingNames = uniqueCandidates.filter(
    (name) => !existingKeys.has(name.toLocaleLowerCase('vi-VN'))
  );
  const emptyIndexes = catalogNames
    .map((name, index) => name.trim() ? -1 : index)
    .filter((index) => index >= 0);
  if (missingNames.length > emptyIndexes.length) throw new Error('Danh mục đối tác đã đầy.');

  const addedRows = [];
  let segmentStart = -1;
  let segmentValues = [];
  const flushSegment = () => {
    if (segmentStart < 0) return;
    catalog.getRange(segmentStart + 2, 1, segmentValues.length, 1)
      .setValues(segmentValues.map((name) => [name]));
    segmentStart = -1;
    segmentValues = [];
  };

  missingNames.forEach((name, index) => {
    const emptyIndex = emptyIndexes[index];
    if (segmentStart < 0 || emptyIndex === segmentStart + segmentValues.length) {
      if (segmentStart < 0) segmentStart = emptyIndex;
      segmentValues.push(name);
    } else {
      flushSegment();
      segmentStart = emptyIndex;
      segmentValues.push(name);
    }
    addedRows.push(emptyIndex + 2);
  });
  flushSegment();
  return addedRows;
}

function applyValidations_(sheet, catalog) {
  const rowCount = PARTNER_CONFIG.lastInputRow - PARTNER_CONFIG.firstInputRow + 1;
  const dateRule = SpreadsheetApp.newDataValidation()
    .requireDate()
    .setAllowInvalid(true)
    .setHelpText('Chọn hoặc nhập ngày theo định dạng dd/mm/yyyy.')
    .build();
  const partnerRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(catalog.getRange('A2:A1000'), true)
    .setAllowInvalid(true)
    .setHelpText('Chọn tên cụ thể hoặc nhập tên mới; tên mới sẽ tự được lưu vào danh mục.')
    .build();
  const typeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Mua hàng', 'Thanh toán', 'Trả hàng', 'Số dư đầu kỳ', 'Điều chỉnh'], true)
    .setAllowInvalid(false)
    .setHelpText('Chọn loại giao dịch để hệ thống tính công nợ đúng.')
    .build();
  const paymentRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Tiền mặt', 'Chuyển khoản', 'Tiền mặt + chuyển khoản', 'Cấn trừ công nợ', 'Khác'], true)
    .setAllowInvalid(true)
    .setHelpText('Chọn phương thức thường dùng hoặc nhập nội dung khác.')
    .build();
  const debtRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Có', 'Không'], true)
    .setAllowInvalid(false)
    .setHelpText('Để trống được hiểu là Có; chọn Không cho dòng chỉ đối chiếu.')
    .build();
  const discountRule = SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied(
      `=AND(ISNUMBER(M${PARTNER_CONFIG.firstInputRow});M${PARTNER_CONFIG.firstInputRow}>=0;M${PARTNER_CONFIG.firstInputRow}<=100)`
    )
    .setAllowInvalid(false)
    .setHelpText('Nhập số từ 0 đến 100, ví dụ 15 hoặc 15,5.')
    .build();

  sheet.getRange(PARTNER_CONFIG.firstInputRow, 1, rowCount, 1).setDataValidation(dateRule);
  sheet.getRange(PARTNER_CONFIG.firstInputRow, 2, rowCount, 1).setDataValidation(partnerRule);
  sheet.getRange(PARTNER_CONFIG.firstInputRow, 3, rowCount, 1).setDataValidation(typeRule);
  sheet.getRange(PARTNER_CONFIG.firstInputRow, 8, rowCount, 1).setDataValidation(paymentRule);
  sheet.getRange(PARTNER_CONFIG.firstInputRow, 11, rowCount, 1).setDataValidation(debtRule);
  sheet.getRange(
    PARTNER_CONFIG.firstInputRow,
    PARTNER_CONFIG.discountColumn,
    rowCount,
    1
  ).setDataValidation(discountRule);
}

function selfTestPartnerSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(PARTNER_CONFIG.sheetName);
  if (!sheet) throw new Error('Không tìm thấy tab Đơn đối tác.');

  const testRow = 3499;
  const rowRange = sheet.getRange(testRow, 1, 1, PARTNER_CONFIG.discountColumn);
  const originalValues = rowRange.getValues();
  const originalFormulas = rowRange.getFormulas();
  const originalFormats = rowRange.getNumberFormats();
  const originalValidations = rowRange.getDataValidations();
  const testPartnerName = `Đối tác thử Codex ${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  let testPartnerCatalogRow = null;
  let testError = null;

  try {
    testPartnerCatalogRow = registerPartner_(testPartnerName);
    rowRange.clearContent();
    sheet.getRange(testRow, 2).setValue(testPartnerName);
    sheet.getRange(testRow, 3).setValue('Mua hàng');
    sheet.getRange(testRow, 5).setValue(2);
    sheet.getRange(testRow, 6).setValue(300000);
    sheet.getRange(testRow, PARTNER_CONFIG.discountColumn).setValue(15);
    repairRow_(sheet, testRow);
    SpreadsheetApp.flush();

    if (sheet.getRange(testRow, 7).getValue() !== 600000) throw new Error('Mua hàng không tự tính 600.000đ.');
    if (sheet.getRange(testRow, 10).getValue() !== 510000) {
      throw new Error('Chiết khấu 15% không cho ra công nợ 510.000đ.');
    }

    rowRange.clearContent();
    repairRow_(sheet, testRow);
    SpreadsheetApp.flush();
    if (!sheet.getRange(testRow, 7).getFormula()) throw new Error('Công thức Số tiền bị mất sau khi xóa dòng.');
    if (!sheet.getRange(testRow, 10).getFormula()) throw new Error('Công thức Còn phải trả bị mất sau khi xóa dòng.');

    const catalog = ensurePartnerCatalog_();
    const catalogNames = catalog.getRange('A2:A1000').getDisplayValues().flat();
    const testPartnerIndex = catalogNames.findIndex((name) => name === testPartnerName);
    if (testPartnerIndex < 0) throw new Error('Tên đối tác mới không được thêm vào danh mục.');
    applyValidations_(sheet, catalog);
  } catch (error) {
    testError = error;
  } finally {
    if (testPartnerCatalogRow != null) {
      const catalog = ensurePartnerCatalog_();
      const testPartnerCell = catalog.getRange(testPartnerCatalogRow, 1);
      if (testPartnerCell.getDisplayValue() === testPartnerName) testPartnerCell.clearContent();
    }
    rowRange.clearContent();
    rowRange.setValues(originalValues);
    for (let column = 0; column < originalFormulas[0].length; column += 1) {
      if (originalFormulas[0][column]) sheet.getRange(testRow, column + 1).setFormula(originalFormulas[0][column]);
    }
    rowRange.setNumberFormats(originalFormats);
    rowRange.setDataValidations(originalValidations);
    SpreadsheetApp.flush();
  }

  if (testError) throw testError;
  spreadsheet.toast('Kiểm tra thành công: tính tiền, chiết khấu, phục hồi sau xóa và thêm đối tác mới đều đúng.', 'MINH HỒNG', 8);
  Logger.log('Partner sheet self-test passed.');
}
