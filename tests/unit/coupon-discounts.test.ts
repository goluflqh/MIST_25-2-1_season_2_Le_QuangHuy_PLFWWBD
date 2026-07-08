import assert from "node:assert/strict";
import test from "node:test";
import { getPayableAmount, getRemainingAmount } from "../../lib/coupon-discounts";

test("keeps service-order payable and remaining amounts non-negative", () => {
  assert.equal(getPayableAmount(1_000_000, 1_200_000), 0);
  assert.equal(getRemainingAmount(1_000_000, 200_000, -500_000), 800_000);
});
