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
  // untested route handler cost nothing and showed up nowhere. It is gone. Pages
  // and layouts stay out, because the two `!src/**/{layout,page}.tsx` entries
  // below still catch them; route handlers are now measured and floored.
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/layout.tsx",
    "!src/**/page.tsx",
  ],
  coverageThreshold,
  testMatch: [
    "<rootDir>/tests/unit/**/*.test.ts",
    "<rootDir>/tests/unit/**/*.test.tsx",
  ],
};

module.exports = createJestConfig(config);
