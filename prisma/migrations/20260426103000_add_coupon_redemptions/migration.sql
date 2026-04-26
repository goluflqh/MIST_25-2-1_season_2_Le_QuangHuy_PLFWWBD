-- Split coupon definitions from per-user redemptions.
CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

INSERT INTO "CouponRedemption" ("id", "couponId", "userId", "createdAt")
SELECT 'legacy_' || "id", "id", "userId", "createdAt"
FROM "Coupon"
WHERE "userId" IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE UNIQUE INDEX "CouponRedemption_couponId_userId_key" ON "CouponRedemption"("couponId", "userId");
CREATE INDEX "CouponRedemption_couponId_idx" ON "CouponRedemption"("couponId");
CREATE INDEX "CouponRedemption_userId_idx" ON "CouponRedemption"("userId");
CREATE INDEX "CouponRedemption_createdAt_idx" ON "CouponRedemption"("createdAt");

ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Coupon" DROP CONSTRAINT IF EXISTS "Coupon_userId_fkey";
DROP INDEX IF EXISTS "Coupon_userId_idx";
ALTER TABLE "Coupon" DROP COLUMN IF EXISTS "userId";
