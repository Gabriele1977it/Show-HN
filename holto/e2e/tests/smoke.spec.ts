import { test, expect, type Page } from "@playwright/test";

// Collect uncaught page errors and console errors. An empty list at the end of a
// test is the "silent rewrite" detector: it catches UI that quietly broke even
// when the page still looks roughly right.
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  return errors;
}

// ── Public surfaces (no login needed) — the reliable baseline ────────────────

test("app shell loads and renders the sign-in surface without errors", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/", { waitUntil: "networkidle" });

  await expect(page).toHaveTitle(/holto/i);
  // The unauthenticated app boots to a get-started / sign-in surface.
  await expect(page.getByText(/holto|sign in|log in|get started|email/i).first()).toBeVisible();

  // Visual baseline. First run writes it; later runs diff against it.
  await expect(page).toHaveScreenshot("app-shell.png", { fullPage: true, maxDiffPixelRatio: 0.03 });

  expect(errors, `Console/page errors:\n${errors.join("\n")}`).toEqual([]);
});

test("marketing landing page renders", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(process.env.E2E_MARKETING_URL || "https://holtotravel.com", { waitUntil: "networkidle" });

  await expect(page.getByText(/holto/i).first()).toBeVisible();
  await expect(page).toHaveScreenshot("marketing.png", { fullPage: true, maxDiffPixelRatio: 0.03 });

  expect(errors, `Console/page errors:\n${errors.join("\n")}`).toEqual([]);
});

// ── Signed-in key pages — only run when credentials are provided ─────────────
// Set E2E_EMAIL and E2E_PASSWORD (use a dedicated test account) to enable.

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.describe("signed-in key pages", () => {
  test.skip(!EMAIL || !PASSWORD, "Set E2E_EMAIL and E2E_PASSWORD to run authenticated checks");

  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    // Forgiving selectors — adjust to match the real sign-in form if it changes.
    await page.getByPlaceholder(/email/i).first().fill(EMAIL!);
    await page.getByPlaceholder(/password/i).first().fill(PASSWORD!);
    await page.getByRole("button", { name: /sign in|log in|continue/i }).first().click();
    await page.waitForLoadState("networkidle");
  });

  // Routes registered in the Expo Router stack; add pages as the app grows.
  const pages: [name: string, path: string][] = [
    ["home", "/"],
    ["cost-of-living", "/cost-of-living"],
    ["visa", "/visa"],
    ["alerts", "/alerts"],
    ["currency", "/currency"],
  ];

  for (const [name, path] of pages) {
    test(`${name} renders without errors`, async ({ page }) => {
      const errors = collectErrors(page);
      if (path !== "/") await page.goto(path, { waitUntil: "networkidle" });
      await expect(page.locator("body")).toBeVisible();
      await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, maxDiffPixelRatio: 0.03 });
      expect(errors, `Console/page errors:\n${errors.join("\n")}`).toEqual([]);
    });
  }
});
