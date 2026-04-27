ALTER TABLE "Warranty" ADD COLUMN "serviceOrderId" TEXT;

CREATE UNIQUE INDEX "Warranty_serviceOrderId_key" ON "Warranty"("serviceOrderId");

ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
