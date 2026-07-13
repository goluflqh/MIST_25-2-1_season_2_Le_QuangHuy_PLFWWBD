import assert from "node:assert/strict";
import test from "node:test";
import { hasPriceUnit, normalizePriceRange, toValidPricingDate } from "../../lib/pricing-display";
import { getAbsoluteUrl, marketingSitemapRoutes } from "../../lib/site";
import { buildBreadcrumbJsonLd } from "../../lib/structured-data";

test("marketing sitemap includes public service and privacy routes", () => {
  const routes = new Set<string>(marketingSitemapRoutes.map((route) => route.path));

  assert.deepEqual(
    ["/dich-vu", "/tra-cuu-bao-hanh", "/quyen-rieng-tu"].every((path) => routes.has(path)),
    true
  );
});

test("service hub breadcrumb resolves to the canonical service route", () => {
  const breadcrumb = buildBreadcrumbJsonLd([
    { name: "Trang chủ", path: "/" },
    { name: "Dịch vụ", path: "/dich-vu" },
  ]);

  assert.equal(breadcrumb.itemListElement[1]?.item, getAbsoluteUrl("/dich-vu"));
});

test("pricing display normalizes ungrouped ranges without duplicating units", () => {
  assert.equal(normalizePriceRange("700000 - 4.000.000 VNĐ"), "700.000–4.000.000 VNĐ");
  assert.equal(normalizePriceRange("350.000 - 800.000"), "350.000–800.000");
  assert.equal(normalizePriceRange("700000đ/cam"), "700.000đ/cam");
  assert.equal(hasPriceUnit("700.000 VNĐ"), true);
  assert.equal(hasPriceUnit("700.000 VND"), true);
  assert.equal(hasPriceUnit("700.000đ"), true);
  assert.equal(hasPriceUnit("700.000 đ/cam"), true);
  assert.equal(hasPriceUnit("700.000"), false);
});

test("pricing update dates remain valid after cache serialization", () => {
  assert.equal(toValidPricingDate("2026-07-11T00:00:00.000Z")?.toISOString(), "2026-07-11T00:00:00.000Z");
  assert.equal(toValidPricingDate(new Date("2026-07-10T00:00:00.000Z"))?.toISOString(), "2026-07-10T00:00:00.000Z");
  assert.equal(toValidPricingDate("not-a-date"), null);
  assert.equal(toValidPricingDate(undefined), null);
});
