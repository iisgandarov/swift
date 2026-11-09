import { expect, test } from "@playwright/test";

// Demo mode uses the offline mock provider: any recording "transcribes" to a fixed
// two-item Azerbaijani sentence, so the whole pipeline can be exercised without keys.

test("voice → confirmation sheet → create all", async ({ page }) => {
  await page.goto("/new");
  await page.getByTestId("voice-button").click();
  await expect(page.getByTestId("voice-stop")).toBeEnabled();
  await page.waitForTimeout(1200);
  await page.getByTestId("voice-stop").click();

  const cards = page.getByTestId("draft-card");
  await expect(cards).toHaveCount(2, { timeout: 10_000 });
  await expect(page.getByText(/Sabah saat 10-da/)).toBeVisible();

  // remove nothing, just create both
  await page.getByTestId("create-all").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('[data-testid="item-row"]').filter({ hasText: /TLB/ }).first()).toBeVisible();
});

test("typed sentence is understood", async ({ page }) => {
  await page.goto("/new");
  await page.locator("#title").fill("sabah axşam 7-də ailə ilə şam yeməyi");
  await page.getByTestId("parse-text").click();
  const card = page.getByTestId("draft-card");
  await expect(card).toHaveCount(1, { timeout: 10_000 });
  await expect(card.getByRole("radio", { name: /Tədbir|Event/ })).toHaveAttribute("aria-checked", "true");
  await expect(card.getByText("19:00 – 20:00")).toBeVisible();
});
