import assert from "node:assert/strict";
import test from "node:test";
import { hasSameOrigin } from "../../lib/request-origin";

test("accepts direct and reverse-proxy same-origin requests", () => {
  assert.equal(hasSameOrigin(new Request("https://minhhong.vn/api/admin/action", {
    method: "POST",
    headers: { origin: "https://minhhong.vn" },
  })), true);

  assert.equal(hasSameOrigin(new Request("http://app:3000/api/admin/action", {
    method: "POST",
    headers: {
      host: "app:3000",
      origin: "https://minhhong.vn",
      "x-forwarded-host": "minhhong.vn",
      "x-forwarded-proto": "https",
    },
  })), true);
});

test("rejects missing, malformed, or cross-origin requests", () => {
  assert.equal(hasSameOrigin(new Request("https://minhhong.vn/api/admin/action", { method: "POST" })), false);
  assert.equal(hasSameOrigin(new Request("https://minhhong.vn/api/admin/action", {
    method: "POST",
    headers: { origin: "not-a-url" },
  })), false);
  assert.equal(hasSameOrigin(new Request("https://minhhong.vn/api/admin/action", {
    method: "POST",
    headers: { origin: "https://attacker.example" },
  })), false);
});
