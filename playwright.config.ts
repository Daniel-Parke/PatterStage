import { defineConfig, devices } from "@playwright/test";
import { randomBytes } from "crypto";
import { join } from "path";

const smokeOnly = process.env.PLAYWRIGHT_SMOKE === "1";
const port = process.env.PORT || "3000";
const baseURL = `http://127.0.0.1:${port}`;
const e2eDataDir = join(process.cwd(), "tmp", "e2e-data");

// Per-run auth token. The proxy fails closed (503) with no token and 401s a
// wrong one, so the harness must both configure a token (PS_AUTH_TOKEN on the
// webServer — the documented container-injection path, which beats the data-dir
// token file) and present it on every request (Bearer beats cookie in
// src/proxy.ts, so plain page navigations authenticate too). Stashed in
// process.env because Playwright worker processes re-evaluate this config and
// must agree with the main process that started the server.
if (!process.env.PS_E2E_AUTH_TOKEN) {
  process.env.PS_E2E_AUTH_TOKEN = randomBytes(32).toString("base64url");
}
const authToken = process.env.PS_E2E_AUTH_TOKEN;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: smokeOnly ? "**/smoke.spec.ts" : "**/*.spec.ts",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Zero retries, unconditionally (WG-DEL-004, ruled C: determinism first).
  //
  // A retry on a blocking gate converts a real intermittent failure into a green
  // run, and the failure that got retried away is the one worth knowing about. CI
  // used to allow one, so a test that passed on the second attempt reported the
  // same as a test that passed on the first.
  //
  // A test that needs a retry is a flake, and a flake gets quarantined with an
  // owner and a deadline, not tolerated at the gate.
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  use: {
    baseURL,
    // Applies to browser contexts and the `request` fixture alike, so every
    // navigation and API call authenticates against the proxy.
    extraHTTPHeaders: { Authorization: `Bearer ${authToken}` },
    // retain-on-failure, not on-first-retry: with retries at 0 there is no first
    // retry, so the old value would have produced a trace for nothing. A failure
    // now always leaves the artefact needed to diagnose it.
    trace: "retain-on-failure",
  },
  webServer: {
    // Force -p so E2E matches baseURL even when .env.local sets a different PORT.
    //
    // The wipe runs HERE, as the first half of the command, and not in
    // globalSetup. Playwright boots webServer before globalSetup, and the server
    // seeds its catalogue during boot, so a wipe from globalSetup deletes the
    // database the running server just seeded. See tests/e2e/prepare-data-dir.mjs
    // for the full account and the CI failure it caused.
    command:
      `node tests/e2e/prepare-data-dir.mjs "${e2eDataDir}" && ` +
      `npm run start -- -p ${port} -H 0.0.0.0`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Isolated, fresh DB per run (prepare-data-dir.mjs wipes it before boot),
    // independent of the developer's working DB and free of legacy schema drift.
    //
    // PS_DATA_DIR as well as CH_DATA_DIR, because src/lib/paths.ts resolves
    // PS_DATA_DIR first and .env.local sets it. Next.js loads .env.local on
    // `next start` and does not override variables already present in the
    // environment, so setting only CH_DATA_DIR meant any developer with
    // PS_DATA_DIR in .env.local ran the whole suite against their working
    // database while believing it was isolated. That is why the CI-only failure
    // in tools-personalities.spec.ts could not be reproduced locally.
    env: { PS_DATA_DIR: e2eDataDir, CH_DATA_DIR: e2eDataDir, PS_AUTH_TOKEN: authToken },
  },
});
