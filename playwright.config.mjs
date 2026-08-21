import { defineConfig } from "@playwright/test";

const legacyBaselineState = "tests/e2e/fixtures/legacy-baseline-storage-state.json";
const legacyRegressionSuites = /(?:desktop-resilience|note-drawing-projection|visual-system|kanji-resource)\.spec\.mjs/;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  workers: 1,
  retries: 0,
  preserveOutput: "failures-only",
  reporter: [["line"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4180",
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: [
        /kanji-handwriting\.spec\.mjs/,
        /state-recovery\.spec\.mjs/,
        legacyRegressionSuites,
      ],
    },
    {
      name: "chromium-state-recovery",
      testMatch: /state-recovery\.spec\.mjs/,
    },
    {
      name: "chromium-legacy-regression",
      testMatch: legacyRegressionSuites,
      use: {
        storageState: legacyBaselineState,
      },
    },
    {
      name: "chromium-kanji-legacy-baseline",
      testMatch: /kanji-handwriting\.spec\.mjs/,
      use: {
        storageState: legacyBaselineState,
      },
    },
  ],
  webServer: {
    command: "node scripts/serve-static.mjs",
    url: "http://127.0.0.1:4180",
    timeout: 10_000,
    reuseExistingServer: false,
  },
});
