ALTER TABLE "PartnerLedgerEntry"
ADD COLUMN "discountPercent" DOUBLE PRECISION,
ADD COLUMN "discountAmount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "PartnerLedgerEntry"
ADD CONSTRAINT "PartnerLedgerEntry_discountPercent_check"
CHECK ("discountPercent" IS NULL OR ("discountPercent" > 0 AND "discountPercent" <= 100));

ALTER TABLE "PartnerLedgerEntry"
ADD CONSTRAINT "PartnerLedgerEntry_discountAmount_check"
CHECK ("discountAmount" >= 0);

ALTER TABLE "PartnerLedgerEntry"
ADD CONSTRAINT "PartnerLedgerEntry_discount_consistency_check"
CHECK (
  ("discountPercent" IS NULL AND "discountAmount" = 0)
  OR ("discountPercent" IS NOT NULL AND "entryType" = 'PURCHASE')
);
