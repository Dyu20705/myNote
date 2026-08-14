import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  workers: 1,
  retries: 0,
  preserveOutput: "failures-only",
  reporter: [["line"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /kanji-handwriting\.spec\.mjs/,
    },
    {
      name: "chromium-kanji-legacy-baseline",
      testMatch: /kanji-handwriting\.spec\.mjs/,
      use: {
        storageState: "tests/e2e/fixtures/legacy-baseline-storage-state.json",
      },
    },
  ],
  webServer: {
    command: "node scripts/serve-static.mjs",
    url: "http://127.0.0.1:4173",
    timeout: 10_000,
    reuseExistingServer: false,
  },
});
