import assert from "node:assert/strict";
import test from "node:test";
import { formatMoneyInputValue, parseMoneyText } from "../../lib/money";

test("parses shorthand money input safely", () => {
  assert.equal(parseMoneyText("100k"), 100_000);
  assert.equal(parseMoneyText("1000k"), 1_000_000);
  assert.equal(parseMoneyText("1.234.000"), 1_234_000);
  assert.equal(parseMoneyText("1 234 000đ"), 1_234_000);
  assert.equal(parseMoneyText("abc"), 0);
});

test("formats money input with Vietnamese thousands separators", () => {
  assert.equal(formatMoneyInputValue("100k"), "100.000");
  assert.equal(formatMoneyInputValue("1000k"), "1.000.000");
  assert.equal(formatMoneyInputValue(""), "");
});
