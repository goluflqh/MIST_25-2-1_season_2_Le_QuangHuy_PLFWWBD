import assert from "node:assert/strict";
import test from "node:test";
import { parseAdminDateInput } from "../../lib/admin-date";

test("parses Vietnamese day/month/year dates", () => {
  const parsed = parseAdminDateInput("30/04/2026", { endOfDay: true });

  assert.ok(parsed);
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 3);
  assert.equal(parsed.getDate(), 30);
  assert.equal(parsed.getHours(), 23);
  assert.equal(parsed.getMinutes(), 59);
});

test("parses yyyy-mm-dd dates for existing API callers", () => {
  const parsed = parseAdminDateInput("2026-04-30");

  assert.ok(parsed);
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 3);
  assert.equal(parsed.getDate(), 30);
});

test("rejects impossible dates", () => {
  assert.equal(parseAdminDateInput("31/02/2026"), null);
  assert.equal(parseAdminDateInput("not a date"), null);
});
