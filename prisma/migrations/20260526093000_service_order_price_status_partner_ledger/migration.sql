ALTER TABLE "ServiceOrder"
ADD COLUMN "priceStatus" TEXT NOT NULL DEFAULT 'CONFIRMED';

UPDATE "ServiceOrder"
SET "priceStatus" = CASE
  WHEN "quotedPrice" IS NULL OR "quotedPrice" = 0 THEN 'LEGACY_MISSING'
  ELSE 'CONFIRMED'
END;

ALTER TABLE "ServiceOrder"
ALTER COLUMN "priceStatus" SET DEFAULT 'PENDING_QUOTE';

CREATE TABLE "Partner" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "type" TEXT NOT NULL DEFAULT 'SUPPLIER',
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerLedgerEntry" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "entryType" TEXT NOT NULL,
  "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "amount" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "reference" TEXT,
  "notes" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Partner_code_key" ON "Partner"("code");
CREATE INDEX "ServiceOrder_priceStatus_idx" ON "ServiceOrder"("priceStatus");
CREATE INDEX "Partner_code_idx" ON "Partner"("code");
CREATE INDEX "Partner_name_idx" ON "Partner"("name");
CREATE INDEX "Partner_type_idx" ON "Partner"("type");
CREATE INDEX "Partner_active_idx" ON "Partner"("active");
CREATE INDEX "Partner_deletedAt_idx" ON "Partner"("deletedAt");
CREATE INDEX "PartnerLedgerEntry_partnerId_idx" ON "PartnerLedgerEntry"("partnerId");
CREATE INDEX "PartnerLedgerEntry_entryType_idx" ON "PartnerLedgerEntry"("entryType");
CREATE INDEX "PartnerLedgerEntry_entryDate_idx" ON "PartnerLedgerEntry"("entryDate");
CREATE INDEX "PartnerLedgerEntry_deletedAt_idx" ON "PartnerLedgerEntry"("deletedAt");
CREATE INDEX "PartnerLedgerEntry_partnerId_entryDate_idx" ON "PartnerLedgerEntry"("partnerId", "entryDate");

ALTER TABLE "PartnerLedgerEntry"
ADD CONSTRAINT "PartnerLedgerEntry_partnerId_fkey"
FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Partner" ("id", "code", "name", "phone", "type", "notes", "active", "createdAt", "updatedAt")
VALUES (
  'partner_long_20260507',
  'LONG',
  'Long',
  NULL,
  'SUPPLIER',
  'Đối tác Long, số dư chốt theo Minh Hồng. Web là nguồn quản lý chính.',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "PartnerLedgerEntry" (
  "id",
  "partnerId",
  "entryType",
  "entryDate",
  "amount",
  "description",
  "reference",
  "notes",
  "createdAt",
  "updatedAt"
)
VALUES
  (
    'long_opening_20260507',
    'partner_long_20260507',
    'OPENING_BALANCE',
    '2026-05-07T00:00:00.000Z',
    20230000,
    'Nợ Long đến 07/05/2026 theo chốt Minh Hồng',
    'CHOT-2026-05-07',
    'Bỏ qua lệch thô nhỏ khoảng 200k theo quyết định đã chốt.',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'long_purchase_20260508_300cell_eve_25p',
    'partner_long_20260507',
    'PURCHASE',
    '2026-05-08T00:00:00.000Z',
    7490000,
    'Mua thêm 300cell eve 25p',
    'LONG-300CELL-EVE-25P-2026-05-08',
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'long_payment_20260508_15000000',
    'partner_long_20260507',
    'PAYMENT',
    '2026-05-08T00:00:00.000Z',
    15000000,
    'Trả trước cho Long',
    'TRA-TRUOC-LONG-2026-05-08',
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("id") DO NOTHING;

-- The production Minh Hong partner ledger must be loaded from the approved
-- workbook import, not from schema migrations. Keep fresh databases empty so
-- the rehearsal/import step can prove all business rows came from the workbook.
DELETE FROM "PartnerLedgerEntry" WHERE "partnerId" = 'partner_long_20260507';
DELETE FROM "Partner" WHERE "id" = 'partner_long_20260507';
