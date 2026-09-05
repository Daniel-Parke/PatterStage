/* eslint-disable @typescript-eslint/no-require-imports -- Jest config is CommonJS */
const nextJest = require("next/jest.js");

const createJestConfig = nextJest({ dir: "./" });

// The coverage floors are NOT written here. They live in a module of their own so
// that scripts/tooling/coverage-floor-check.mjs can read them without booting
// next/jest, and hold them against coverage-floors.baseline.json: lowering a
// floor is a red build (WO-0013). Editing the numbers in this file is not a way
// round that, because there are no numbers in this file to edit.
const coverageThreshold = require("./scripts/tooling/coverage-floors.cjs");

/** Unit tests live under `tests/unit/**`. */
const config = {
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/tests/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    // Intercept better-sqlite3 at resolution time so the real CJS module
    // (which calls require('fs') at evaluation time) is never loaded.
    // The mock exports a minimal Database-compatible object with prepare/run/get/all.
    "^better-sqlite3$": "<rootDir>/tests/__mocks__/better-sqlite3.cjs",
  },
  // `!src/app/**` used to sit at the end of this list, which excluded the ENTIRE
  // app router from measurement and left the API surface with no floor at all: an
  // untested route handler cost nothing and showed up nowhere. It is gone.
  //
  // `!src/**/page.tsx` went the same way, for the same reason (T-0044). The live
  // QA pass found its defects in page-level WIRING, and that was precisely the
  // code no floor could see: sessions/page.tsx rendered <SessionInsights
  // sessions={sessions} /> and never passed the total it already had in hand, so
  // four tiles described 50 rows while the header beside them counted 35,790.
  //
  // Measured before making the change, over the whole suite, rather than guessed:
  // including pages moves global statements 58.53 -> 54.22, branches 49.40 ->
  // 45.91, functions 53.39 -> 47.12, lines 60.05 -> 55.78. It breaches no floor.
  // The declared floors are 38/27/40/27, so every band keeps double-digit
  // headroom and not one number in coverage-floors.cjs moved. The percentages
  // drop because the denominator grew, which is the honest reading: pages sit
  // near 14% covered against roughly 58% for everything else, and that gap was
  // invisible while they were excluded.
  //
  // Layouts stay out. They are framework scaffolding with no branching of their
  // own, and measuring them would buy pressure to test the framework.
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/layout.tsx",
  ],
  coverageThreshold,
  testMatch: [
    "<rootDir>/tests/unit/**/*.test.ts",
    "<rootDir>/tests/unit/**/*.test.tsx",
  ],
  // Keep jest out of tmp/ entirely.
  //
  // testMatch already stops tests THERE from running, but jest-haste-map scans
  // wider than testMatch: it indexes package names and manual mocks across the
  // whole rootDir. A scratch checkout under tmp/ (an agent's git worktree, a
  // release probe) therefore produced two warnings on every run:
  //
  //   jest-haste-map: duplicate manual mock found: better-sqlite3
  //   jest-haste-map: Haste module naming collision: patterstage
  //
  // The duplicate-mock one is not cosmetic. Which of two identically-named
  // manual mocks wins is not something to leave to scan order when the mock in
  // question is the database.
  //
  // tmp/ is gitignored, so nothing in it is ever part of this project.
  modulePathIgnorePatterns: ["<rootDir>/tmp/"],
};

module.exports = createJestConfig(config);
