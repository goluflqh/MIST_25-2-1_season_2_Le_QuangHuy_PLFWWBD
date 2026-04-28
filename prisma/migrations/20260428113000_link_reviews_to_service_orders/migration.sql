-- Link a customer review to the completed service order it evaluates.
ALTER TABLE "Review" ADD COLUMN "serviceOrderId" TEXT;

CREATE UNIQUE INDEX "Review_serviceOrderId_key" ON "Review"("serviceOrderId");
CREATE INDEX "Review_serviceOrderId_idx" ON "Review"("serviceOrderId");

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_serviceOrderId_fkey"
  FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
