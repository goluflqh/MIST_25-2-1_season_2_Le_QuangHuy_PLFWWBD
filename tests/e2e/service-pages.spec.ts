import { expect, test } from "@playwright/test";

const servicePages = [
  {
    path: "/dich-vu/dong-pin",
    heading: "Tư vấn đóng pin Lithium theo đúng vị trí và cách khách sử dụng.",
    quoteSource: "service-dong-pin-local-trust",
    scenario: "Xe điện dùng đi làm hằng ngày",
  },
  {
    path: "/dich-vu/camera",
    heading: "Tư vấn lắp camera an ninh theo đúng vị trí và cách khách sử dụng.",
    quoteSource: "service-camera-local-trust",
    scenario: "Cửa hàng mặt tiền cần xem quầy và cửa ra vào",
  },
  {
    path: "/dich-vu/den-nang-luong",
    heading: "Tư vấn đèn năng lượng mặt trời theo đúng vị trí và cách khách sử dụng.",
    quoteSource: "service-den-nlmt-local-trust",
    scenario: "Sân, cổng cần sáng tự động mỗi tối",
  },
  {
    path: "/dich-vu/pin-luu-tru",
    heading: "Tư vấn pin lưu trữ & kích đề theo đúng vị trí và cách khách sử dụng.",
    quoteSource: "service-pin-luu-tru-local-trust",
    scenario: "Nguồn dự phòng cho gia đình hoặc cửa hàng",
  },
] as const;

test.describe("Service marketing pages", () => {
  for (const service of servicePages) {
    test(`${service.path} shows local trust guidance`, async ({ page }) => {
      test.setTimeout(60_000);

      await page.goto(service.path);

      await expect(page.getByRole("heading", { name: service.heading })).toBeVisible();
      await expect(page.getByText(service.scenario)).toBeVisible();
      await expect(page.getByText("Chuẩn bị trước để nhận tư vấn nhanh hơn")).toBeVisible();

      const quoteLink = page.locator(`a[href*="source=${service.quoteSource}"]`);
      await expect(quoteLink).toHaveCount(1);
      await expect(quoteLink).toHaveAttribute("href", new RegExp(`source=${service.quoteSource}`));
    });
  }
});
