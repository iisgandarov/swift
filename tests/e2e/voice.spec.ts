import { expect, test } from "@playwright/test";

// Demo mode uses the offline mock provider: any recording "transcribes" to a fixed
// two-item Azerbaijani sentence, so the whole pipeline can be exercised without keys.

test("+ → voice task starts recording → confirmation sheet → create all", async ({ page }) => {
  await page.goto("/");
  await page.locator("button.fab").click();
  await page.getByTestId("choose-voice").click();
  await expect(page).toHaveURL(/\/new\/voice/);
  await expect(page.getByTestId("voice-stop")).toBeEnabled(); // listening started by itself
  await page.waitForTimeout(1200);
  await page.getByTestId("voice-stop").click();

  const cards = page.getByTestId("draft-card");
  await expect(cards).toHaveCount(2, { timeout: 10_000 });
  await page.getByTestId("create-all").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('[data-testid="item-row"]').filter({ hasText: /TLB/ }).first()).toBeVisible();
});

test("long-press on + goes straight to voice", async ({ page }) => {
  await page.goto("/");
  const fab = page.locator("button.fab");
  await fab.hover();
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expect(page).toHaveURL(/\/new\/voice/);
});

test("typed sentence is understood when tapping Create", async ({ page }) => {
  await page.goto("/new/text");
  await page.locator("#title").fill("sabah axşam 7-də ailə ilə şam yeməyi");
  await page.getByTestId("create-item").click();
  const card = page.getByTestId("draft-card");
  await expect(card).toHaveCount(1, { timeout: 10_000 });
  await expect(card.getByRole("radio", { name: /Tədbir|Event/ })).toHaveAttribute("aria-checked", "true");
  await expect(card.getByText("19:00 – 20:00")).toBeVisible();
});

test("manual form choices win over the AI", async ({ page }) => {
  await page.goto("/new/text");
  await page.locator("#title").fill("sabah saat 10-da Ramizlə görüş");
  await page.getByRole("button", { name: /Prioritet|Priority/ }).click();
  await page.getByRole("option", { name: /Yüksək|High/ }).click();
  await page.getByTestId("create-item").click();
  const card = page.getByTestId("draft-card");
  await expect(card).toHaveCount(1, { timeout: 10_000 });
  await expect(card.getByText(/Yüksək|High/)).toBeVisible();
});

test("voice, text and save timings appear in Settings → Speed", async ({ page }) => {
  await page.goto("/new/voice");
  await expect(page.getByTestId("voice-stop")).toBeEnabled();
  await page.waitForTimeout(1200);
  await page.getByTestId("voice-stop").click();
  await expect(page.getByTestId("draft-card")).toHaveCount(2, { timeout: 10_000 });
  await page.getByTestId("create-all").click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/settings");
  const speed = page.locator("section", { has: page.getByRole("heading", { name: /^(Sürət|Speed)$/i }) });
  await expect(speed.getByText(/Səsli tapşırıq|Voice task/)).toBeVisible();
  await expect(speed.getByText(/Saxlama|Saving/)).toBeVisible();
  // server stages arrive through the Server-Timing header
  for (const stage of ["wait", "auth", "rate", "context", "ai", "c_wav", "c_kb", "insert"]) {
    await expect(speed.getByRole("cell", { name: stage, exact: true }).first()).toBeVisible();
  }
});

test("text: an instant draft shows at once and the AI answer replaces it", async ({ page }) => {
  // hold the AI answer for 1.5 s to see the instant draft first
  await page.route("**/api/parse", async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await page.goto("/new/text");
  await page.locator("#title").fill("sabah saat 10-da Ramizlə görüş");
  const t0 = Date.now();
  await page.getByTestId("create-item").click();
  await expect(page.getByTestId("draft-list")).toHaveAttribute("data-refining", "true", { timeout: 1000 });
  expect(Date.now() - t0).toBeLessThan(1000);
  await expect(page.getByTestId("draft-card")).toHaveCount(1);
  await expect(page.getByTestId("create-all")).toBeDisabled();
  await expect(page.getByTestId("draft-list")).not.toHaveAttribute("data-refining", "true", { timeout: 10_000 });
  await expect(page.getByTestId("create-all")).toBeEnabled();
});

test("text: if the AI fails, the instant draft stays and can be saved", async ({ page }) => {
  await page.route("**/api/parse", (route) => route.fulfill({ status: 502, contentType: "application/json", body: '{"error":"ai_unavailable"}' }));
  await page.goto("/new/text");
  await page.locator("#title").fill("sabah saat 10-da Ramizlə görüş");
  await page.getByTestId("create-item").click();
  await expect(page.getByText(/dəqiqləşdirə bilmədi|couldn't refine/)).toBeVisible();
  await expect(page.getByTestId("create-all")).toBeEnabled();
  await page.getByTestId("create-all").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('[data-testid="item-row"]').filter({ hasText: /Ramiz/ }).first()).toBeVisible();
});
