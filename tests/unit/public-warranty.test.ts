import assert from "node:assert/strict";
import test from "node:test";
import {
  getPublicWarrantyStatus,
  maskWarrantySerial,
  serializePublicWarranty,
} from "../../lib/public-warranty";

test("public warranty always masks the full serial number", () => {
  assert.equal(maskWarrantySerial("MH-2026-123456"), "••••••••••3456");
  assert.equal(maskWarrantySerial("ABCD"), "••••CD");
  assert.equal(maskWarrantySerial("A"), "••••A");
  assert.notEqual(maskWarrantySerial("ABCD"), "ABCD");
});

test("public warranty treats the 1900 source sentinel as an unknown expiry", () => {
  const sentinel = new Date("1900-01-01T00:00:00.000Z");
  assert.equal(getPublicWarrantyStatus(sentinel), "unknown");

  assert.deepEqual(
    serializePublicWarranty({
      serialNo: "MH-UNKNOWN",
      productName: "Pin lithium",
      service: "DONG_PIN",
      endDate: sentinel,
    }),
    {
      maskedSerial: "••••••NOWN",
      productName: "Pin lithium",
      service: "Đóng pin",
      status: "unknown",
      expiryMonth: null,
      expiryYear: null,
    }
  );
});

test("public warranty summary excludes customer and internal fields", () => {
  const summary = serializePublicWarranty(
    {
      serialNo: "MH-2026-654321",
      productName: "Camera ngoài trời",
      service: "CAMERA",
      endDate: new Date("2027-08-15T00:00:00.000Z"),
    },
    new Date("2026-07-10T00:00:00.000Z")
  );

  assert.deepEqual(Object.keys(summary).sort(), [
    "expiryMonth",
    "expiryYear",
    "maskedSerial",
    "productName",
    "service",
    "status",
  ]);
  assert.equal(summary.maskedSerial.endsWith("4321"), true);
  assert.equal(summary.status, "active");
});
