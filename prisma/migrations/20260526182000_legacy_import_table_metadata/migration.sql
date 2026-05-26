ALTER TABLE "ServiceOrder"
ADD COLUMN "sourceName" TEXT,
ADD COLUMN "sourceRow" INTEGER;

ALTER TABLE "PartnerLedgerEntry"
ADD COLUMN "category" TEXT,
ADD COLUMN "receivedGoods" BOOLEAN;

CREATE INDEX "ServiceOrder_sourceName_idx" ON "ServiceOrder"("sourceName");
CREATE INDEX "ServiceOrder_sourceRow_idx" ON "ServiceOrder"("sourceRow");
