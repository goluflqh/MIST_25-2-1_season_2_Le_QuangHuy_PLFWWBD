-- Stable identity for service orders imported from external source rows.
-- Existing/manual rows remain NULL and are unaffected.
ALTER TABLE "ServiceOrder" ADD COLUMN "sourceCode" TEXT;

CREATE UNIQUE INDEX "ServiceOrder_sourceCode_key" ON "ServiceOrder"("sourceCode");
