import assert from "node:assert/strict";
import test from "node:test";
import { getCleanupAuthStatus } from "../../lib/cleanup-auth";

test("cleanup authorization fails closed when the secret is missing", () => {
  assert.equal(getCleanupAuthStatus("Bearer undefined", undefined), "misconfigured");
  assert.equal(getCleanupAuthStatus("Bearer undefined", "   "), "misconfigured");
});

test("cleanup authorization only accepts the exact configured bearer secret", () => {
  assert.equal(getCleanupAuthStatus("Bearer cron-secret", "cron-secret"), "authorized");
  assert.equal(getCleanupAuthStatus("Bearer wrong-secret", "cron-secret"), "unauthorized");
  assert.equal(getCleanupAuthStatus(null, "cron-secret"), "unauthorized");
});
