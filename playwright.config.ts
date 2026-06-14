import { defineConfig, devices } from "@playwright/test";
import { join } from "path";

const smokeOnly = process.env.PLAYWRIGHT_SMOKE === "1";
const port = process.env.PORT || "3000";
const baseURL = `http://127.0.0.1:${port}`;
const e2eDataDir = join(process.cwd(), "tmp", "e2e-data");

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: smokeOnly ? "**/smoke.spec.ts" : "**/*.spec.ts",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    // Force -p so E2E matches baseURL even when .env.local sets a different PORT.
    command: `npm run start -- -p ${port} -H 0.0.0.0`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Isolated, fresh DB per run (global-setup wipes it) — independent of the
    // developer's working DB and free of legacy schema drift.
    env: { CH_DATA_DIR: e2eDataDir },
  },
});
