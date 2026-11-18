import { test, expect } from "@playwright/test";

test("mobile navigation opens, traps focus and navigates", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await page.getByRole("button", { name: "Open menu" }).click();
  await menu.getByRole("link", { name: "Training" }).click();
  await expect(page).toHaveURL(/\/training$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Trainings delivered");
});

test("no horizontal scroll at phone width", async ({ page }) => {
  for (const path of ["/", "/work", "/contact", "/about", "/training/oracle-database-19c-bootcamp"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});
