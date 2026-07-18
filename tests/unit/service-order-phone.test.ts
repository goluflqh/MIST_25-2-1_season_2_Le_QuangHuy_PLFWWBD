import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("missing-phone migration requires both an audited source ID and the unchanged legacy placeholder", () => {
  const sql = readFileSync(
    resolve("prisma/migrations/20260718040000_mark_missing_service_order_phones/migration.sql"),
    "utf8"
  );

  assert.equal((sql.match(/DON_KHACH:MH_[0-9A-F]{32}/g) || []).length, 33);
  assert.match(sql, /"sourceCode" IN/);
  assert.match(sql, /"customerPhone" = '099' \|\| RIGHT/);
  assert.match(sql, /"sourceRow" IS NULL AND "customerPhone" = '0990000000'/);
});
