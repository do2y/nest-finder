// Regression (smoke) tests for existing behavior that must keep working. Assertions avoid internal implementation details (globals, function names).
import { test, expect } from "@playwright/test";

test.describe("existing behavior regression", () => {
  test("first load: 7 map markers, first listing selected, chart rendered", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".custom-marker")).toHaveCount(7);
    await expect(page.locator("#prop-name")).toHaveText("자이 4단지");
    await expect(page.locator("#prop-price")).toContainText("1억 9,200");
    const hasChart = await page.evaluate(() => !!window.Chart && !!window.Chart.getChart("priceChart"));
    expect(hasChart).toBe(true);
  });

  test("marker click: name and price of the selected listing update", async ({ page }) => {
    await page.goto("/");
    await page.locator(".custom-marker").nth(1).click({ force: true });
    await expect(page.locator("#prop-name")).toHaveText("래미안 센터빌");
    await expect(page.locator("#prop-price")).toContainText("1억 5,000");
  });
});
