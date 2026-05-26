import assert from "node:assert/strict";
import test from "node:test";
import { parseAdminDateInput } from "../../lib/admin-date";
import { formatVietnamDate, getVietnamCalendarParts } from "../../lib/vietnam-time";

test("parses Vietnamese day/month/year dates", () => {
  const parsed = parseAdminDateInput("30/04/2026", { endOfDay: true });

  assert.ok(parsed);
  assert.equal(formatVietnamDate(parsed), "30/04/2026");
  assert.equal(parsed.getUTCHours(), 16);
  assert.equal(parsed.getUTCMinutes(), 59);
});

test("parses yyyy-mm-dd dates for existing API callers", () => {
  const parsed = parseAdminDateInput("2026-04-30");

  assert.ok(parsed);
  assert.deepEqual(getVietnamCalendarParts(parsed), { day: 30, month: 4, year: 2026 });
});

test("rejects impossible dates", () => {
  assert.equal(parseAdminDateInput("31/02/2026"), null);
  assert.equal(parseAdminDateInput("not a date"), null);
});
