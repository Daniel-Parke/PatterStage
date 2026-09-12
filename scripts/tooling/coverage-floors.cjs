// scripts/tooling/coverage-floors.cjs
//
// THE DECLARED COVERAGE FLOORS. jest.config.js feeds this object straight into
// `coverageThreshold`, so these numbers are what `npm run test:coverage` enforces
// against real measured coverage.
//
// They live here, in a plain CommonJS module with no Next.js wrapper around it,
// for one reason: coverage-floor-check.mjs has to be able to read them without
// booting next/jest. That check holds every number below against
// coverage-floors.baseline.json and fails the build if one has gone DOWN. See
// that file's header for the ratchet law.
//
// HEADROOM, measured 2026-08-23. Every floor is floor(measured), so some sit
// within a hair of the real number. In covered units the tightest are:
//   global.lines            1 unit of 7196
//   src/app/api functions   2 of 229
//   src/app/api lines       6
//   src/lib functions       6
// A single uncovered line added outside src/lib and src/app/api can therefore
// turn global.lines red. That is the ratchet doing its job, not a flake: the
// answer is to cover the line you just added, never to lower the floor, which
// the check refuses anyway. Recorded here because the first person to hit a
// 0.02 percent margin will assume the build is flaky unless someone told them.
//
// ── The bands, and why they are ordered ─────────────────────────────────────
//
//   src/lib/       the engine. Pure-ish logic, repositories, adapters, schemas.
//                  It is the cheapest surface to test and the most expensive to
//                  get wrong, so it carries the highest floor.
//   src/app/api/   the service. Route handlers. Until WO-0013 the whole app
//                  router was excluded from collectCoverageFrom, so this surface
//                  had no floor AT ALL: an untested route handler cost nothing.
//   global         everything else, which is overwhelmingly UI (src/components,
//                  src/modules, src/hooks). Jest subtracts the two bands above
//                  from the global group, so this really is the remainder.
//
// Engine above service above UI, on all four metrics. That ordering is not
// imposed, it is what the suite measures; the floors were set from a real
// `npm run test:coverage` run and rounded DOWN to the integer. Rounding down is
// deliberate: a floor set at or above the measurement fails the very build that
// introduces it, and each band was measured AFTER `!src/app/**` came out of
// collectCoverageFrom, because widening the denominator moves every band.
//
// Measured on a clean tree at 3d79fbbe, 307 suites, 2360 tests, all passing.
//
// TO RAISE A FLOOR: write more tests, run `npm run test:coverage` to see the new
// measured number, raise the number here to the rounded-down measurement, then
// run `npm run lint:coverage-floors -- --update-baseline` in the same commit.
//
// TO LOWER ONE: you cannot. That is the entire point of the row.

module.exports = {
  // Measured at 38.43 / 27.77 / 40.02 / 27.79.
  global: {
    statements: 38,
    branches: 27,
    lines: 40,
    functions: 27,
  },
  // Measured at 69.42 / 59.75 / 70.65 / 72.5.
  "src/lib/": {
    statements: 69,
    branches: 59,
    lines: 70,
    functions: 72,
  },
  // Measured at 42.94 / 36.61 / 45.22 / 44.97.
  "src/app/api/": {
    statements: 42,
    branches: 36,
    lines: 45,
    functions: 44,
  },
};
