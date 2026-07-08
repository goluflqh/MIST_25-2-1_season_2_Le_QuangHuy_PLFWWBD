import assert from "node:assert/strict";
import test from "node:test";
import { adminTimePresetLabels, getAdminTimePresetRange, matchesAdminTimePreset } from "../../lib/admin-time-filter";

const today = "2026-05-27";

test("exposes Vietnamese admin time preset labels", () => {
  assert.deepEqual(adminTimePresetLabels, {
    ALL: "Tất cả",
    TODAY: "Hôm nay",
    LAST_7_DAYS: "7 ngày qua",
    THIS_MONTH: "Tháng này",
    LAST_MONTH: "Tháng trước",
    CUSTOM: "Tùy chọn",
  });
});

test("builds stable preset ranges", () => {
  assert.deepEqual(getAdminTimePresetRange("ALL", today), { from: "", to: "" });
  assert.deepEqual(getAdminTimePresetRange("TODAY", today), { from: "2026-05-27", to: "2026-05-27" });
  assert.deepEqual(getAdminTimePresetRange("LAST_7_DAYS", today), { from: "2026-05-21", to: "2026-05-27" });
  assert.deepEqual(getAdminTimePresetRange("THIS_MONTH", today), { from: "2026-05-01", to: "2026-05-27" });
  assert.deepEqual(getAdminTimePresetRange("LAST_MONTH", today), { from: "2026-04-01", to: "2026-04-30" });
  assert.deepEqual(getAdminTimePresetRange("CUSTOM", today, "2026-05-08", "2026-05-19"), { from: "2026-05-08", to: "2026-05-19" });
});

test("matches date keys against presets", () => {
  assert.equal(matchesAdminTimePreset("2026-05-27", "TODAY", today), true);
  assert.equal(matchesAdminTimePreset("2026-05-26", "TODAY", today), false);
  assert.equal(matchesAdminTimePreset("2026-05-21", "LAST_7_DAYS", today), true);
  assert.equal(matchesAdminTimePreset("2026-05-20", "LAST_7_DAYS", today), false);
  assert.equal(matchesAdminTimePreset("2026-04-30", "LAST_MONTH", today), true);
  assert.equal(matchesAdminTimePreset("2026-05-15", "CUSTOM", today, "2026-05-08", "2026-05-19"), true);
  assert.equal(matchesAdminTimePreset("2026-05-20", "CUSTOM", today, "2026-05-08", "2026-05-19"), false);
});
