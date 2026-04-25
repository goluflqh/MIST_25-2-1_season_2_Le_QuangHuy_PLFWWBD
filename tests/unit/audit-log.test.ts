import assert from "node:assert/strict";
import test from "node:test";
import { toAuditJson } from "../../lib/audit-log";

test("serializes audit payloads into JSON-safe values", () => {
  const payload = toAuditJson({
    createdAt: new Date("2026-04-25T00:00:00.000Z"),
    nested: { note: null },
  });

  assert.deepEqual(payload, {
    createdAt: "2026-04-25T00:00:00.000Z",
    nested: { note: null },
  });
});

test("omits absent audit payloads", () => {
  assert.equal(toAuditJson(null), undefined);
  assert.equal(toAuditJson(undefined), undefined);
});
