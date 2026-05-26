ALTER TABLE "PartnerLedgerEntry"
ADD COLUMN "quantity" DOUBLE PRECISION,
ADD COLUMN "unit" TEXT,
ADD COLUMN "unitPrice" INTEGER,
ADD COLUMN "sourceName" TEXT,
ADD COLUMN "sourceCode" TEXT,
ADD COLUMN "sourceRow" INTEGER,
ADD COLUMN "paymentMethod" TEXT,
ADD COLUMN "countsInDebt" BOOLEAN NOT NULL DEFAULT true;

UPDATE "PartnerLedgerEntry"
SET "quantity" = 1,
    "unit" = 'lần',
    "unitPrice" = 20230000,
    "sourceName" = 'Chốt công nợ',
    "sourceCode" = 'NHAP_HANG:NH-0001',
    "sourceRow" = 2
WHERE "id" = 'long_opening_20260507';

UPDATE "PartnerLedgerEntry"
SET "quantity" = 300,
    "unit" = 'cell',
    "unitPrice" = 24967,
    "sourceName" = 'Long',
    "sourceCode" = 'NHAP_HANG:NH-0002',
    "sourceRow" = 3
WHERE "id" = 'long_purchase_20260508_300cell_eve_25p';

UPDATE "PartnerLedgerEntry"
SET "paymentMethod" = 'Chuyển khoản',
    "sourceCode" = 'THANH_TOAN:TT-0002',
    "sourceRow" = 3
WHERE "id" = 'long_payment_20260508_15000000';

CREATE UNIQUE INDEX "PartnerLedgerEntry_sourceCode_key" ON "PartnerLedgerEntry"("sourceCode");
CREATE INDEX "PartnerLedgerEntry_sourceName_idx" ON "PartnerLedgerEntry"("sourceName");
CREATE INDEX "PartnerLedgerEntry_countsInDebt_idx" ON "PartnerLedgerEntry"("countsInDebt");
