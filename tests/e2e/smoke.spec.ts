import { expect, test } from "@playwright/test";

test("create a task by text and complete it", async ({ page }, info) => {
  const title = `Smoke ${info.project.name} ${Date.now()}`;

  await page.goto("/");
  await expect(page.getByRole("tablist")).toBeVisible();

  // theme follows the system preference on first load
  const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  expect(isDark).toBe(info.project.name === "dark");

  await page.getByRole("button", { name: /new task|yeni tapşırıq/i }).click();
  await expect(page).toHaveURL(/\/new/);
  await page.locator("#title").fill(title);
  await page.getByTestId("create-item").click();

  await expect(page).toHaveURL(/\/$/);
  const row = page.locator(`[data-testid="item-row"][data-title="${title}"]`);
  await expect(row).toBeVisible();

  await row.getByRole("checkbox").click();
  await expect(row.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");

  // survives a reload (server state, not just the optimistic cache)
  await page.getByRole("tab").filter({ hasText: /completed|tamamlanan/i }).click();
  await page.reload();
  await expect(page.locator(`[data-testid="item-row"][data-title="${title}"]`).getByRole("checkbox")).toHaveAttribute(
    "aria-checked",
    "true",
  );
});
