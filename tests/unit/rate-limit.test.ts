import assert from "node:assert/strict";
import test from "node:test";
import {
  consumeRateLimitForRequest,
  getClientIP,
  getRateLimitStatusForRequest,
  resetRateLimitForRequest,
} from "../../lib/rate-limit";

test("accepts only valid proxy IP values for rate-limit identity", () => {
  assert.equal(getClientIP(new Request("http://localhost", {
    headers: {
      "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      "x-real-ip": "198.51.100.20",
    },
  })), "203.0.113.10");
  assert.equal(getClientIP(new Request("http://localhost", {
    headers: { "x-forwarded-for": "2001:db8::1" },
  })), "2001:db8::1");
  assert.equal(getClientIP(new Request("http://localhost", {
    headers: {
      "x-forwarded-for": "spoofed-value",
      "x-real-ip": "198.51.100.20",
    },
  })), "198.51.100.20");
  assert.equal(getClientIP(new Request("http://localhost", {
    headers: { "x-forwarded-for": "spoofed-value" },
  })), "unknown");
});

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

test("database rate limit serializes concurrent requests for a fresh bucket", {
  skip: process.env.TEST_DATABASE_RATE_LIMIT !== "1",
}, async () => {
  const previousStore = process.env.RATE_LIMIT_STORE;
  process.env.RATE_LIMIT_STORE = "database";

  const identifier = `unit:database:${Date.now()}:${Math.random()}`;
  const config = { limit: 5, windowSec: 60 };

  try {
    await resetRateLimitForRequest(identifier);
    const results = await Promise.all(
      Array.from({ length: 20 }, () => consumeRateLimitForRequest(identifier, config))
    );

    assert.equal(results.filter((result) => result.allowed).length, 5);
    assert.deepEqual(results.map((result) => result.count).sort((left, right) => left - right),
      Array.from({ length: 20 }, (_, index) => index + 1));

    const final = await getRateLimitStatusForRequest(identifier, config);
    assert.equal(final.count, 20);
    assert.equal(final.allowed, false);
  } finally {
    await resetRateLimitForRequest(identifier);

    if (previousStore === undefined) {
      delete process.env.RATE_LIMIT_STORE;
    } else {
      process.env.RATE_LIMIT_STORE = previousStore;
    }
  }
});
