-- Link consultation requests, redeemed coupons, and service orders.
ALTER TABLE "ContactRequest"
ADD COLUMN "couponRedemptionId" TEXT;

ALTER TABLE "ServiceOrder"
ADD COLUMN "contactRequestId" TEXT,
ADD COLUMN "couponRedemptionId" TEXT,
ADD COLUMN "couponCode" TEXT,
ADD COLUMN "couponDiscount" TEXT,
ADD COLUMN "discountAmount" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "ContactRequest_couponRedemptionId_key" ON "ContactRequest"("couponRedemptionId");
CREATE UNIQUE INDEX "ServiceOrder_contactRequestId_key" ON "ServiceOrder"("contactRequestId");
CREATE UNIQUE INDEX "ServiceOrder_couponRedemptionId_key" ON "ServiceOrder"("couponRedemptionId");

ALTER TABLE "ContactRequest"
ADD CONSTRAINT "ContactRequest_couponRedemptionId_fkey"
FOREIGN KEY ("couponRedemptionId") REFERENCES "CouponRedemption"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ServiceOrder"
ADD CONSTRAINT "ServiceOrder_contactRequestId_fkey"
FOREIGN KEY ("contactRequestId") REFERENCES "ContactRequest"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ServiceOrder"
ADD CONSTRAINT "ServiceOrder_couponRedemptionId_fkey"
FOREIGN KEY ("couponRedemptionId") REFERENCES "CouponRedemption"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
