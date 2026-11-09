import { expect, test } from "@playwright/test";

test("create a task by text and complete it", async ({ page }, info) => {
  const title = `Smoke ${info.project.name} ${Math.random().toString(36).replace(/[^a-z]/g, "").slice(0, 6)}`;

  await page.goto("/");
  await expect(page.getByRole("tablist")).toBeVisible();

  // theme follows the system preference on first load
  const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  expect(isDark).toBe(info.project.name === "dark");

  // "+" opens a choice: voice task or text task
  await page.locator("button.fab").click();
  await page.getByTestId("choose-text").click();
  await expect(page).toHaveURL(/\/new\/text/);
  await page.locator("#title").fill(title);
  await page.getByTestId("create-item").click();
  // Create sends the text to the AI first (demo: offline mock) and opens the confirmation sheet
  await page.getByTestId("create-all").click();

  await expect(page).toHaveURL(/\/$/);
  const row = page.locator(`[data-testid="item-row"][data-title="${title}"]`);
  await expect(row).toBeVisible();

  // wait for the save itself (the checkmark is optimistic), so the reload below can't cancel it
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/items/") && r.request().method() === "PATCH" && r.ok()),
    row.getByRole("checkbox").click(),
  ]);
  await expect(row.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");

  // survives a reload (server state, not just the optimistic cache)
  await page.getByRole("tab").filter({ hasText: /completed|tamamlanan/i }).click();
  await page.reload();
  await expect(page.locator(`[data-testid="item-row"][data-title="${title}"]`).getByRole("checkbox")).toHaveAttribute(
    "aria-checked",
    "true",
  );
});
