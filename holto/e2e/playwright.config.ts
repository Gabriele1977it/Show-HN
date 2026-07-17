import { defineConfig, devices } from "@playwright/test";

// Where to point the tests. Defaults to the live PWA; override with E2E_BASE_URL
// (e.g. a Render preview URL, or http://localhost:8081 for a local web export).
const BASE_URL = process.env.E2E_BASE_URL || "https://app.holtotravel.com";

export default defineConfig({
  testDir: "./tests",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 900 },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"] } },
  ],
});
