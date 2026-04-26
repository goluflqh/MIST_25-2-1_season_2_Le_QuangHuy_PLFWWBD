import assert from "node:assert/strict";
import test from "node:test";
import {
  consumeRateLimitForRequest,
  getRateLimitStatusForRequest,
  resetRateLimitForRequest,
} from "../../lib/rate-limit";

test("async rate limit helpers keep the in-memory behavior outside production", async () => {
  const previousStore = process.env.RATE_LIMIT_STORE;
  process.env.RATE_LIMIT_STORE = "memory";

  const identifier = `unit:${Date.now()}:${Math.random()}`;
  const config = { limit: 2, windowSec: 60 };

  try {
    await resetRateLimitForRequest(identifier);

    const initial = await getRateLimitStatusForRequest(identifier, config);
    assert.equal(initial.allowed, true);
    assert.equal(initial.remaining, 2);
    assert.equal(initial.count, 0);

    const first = await consumeRateLimitForRequest(identifier, config);
    const second = await consumeRateLimitForRequest(identifier, config);
    const third = await consumeRateLimitForRequest(identifier, config);

    assert.equal(first.allowed, true);
    assert.equal(second.allowed, true);
    assert.equal(third.allowed, false);
    assert.equal(third.remaining, 0);
    assert.equal(third.count, 3);
  } finally {
    await resetRateLimitForRequest(identifier);

    if (previousStore === undefined) {
      delete process.env.RATE_LIMIT_STORE;
    } else {
      process.env.RATE_LIMIT_STORE = previousStore;
    }
  }
});
