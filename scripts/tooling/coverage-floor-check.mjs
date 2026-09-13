// scripts/tooling/coverage-floor-check.mjs
//
// THE COVERAGE RATCHET. Same mechanism as design-lint.mjs, pointed the other way.
//
// design-lint holds a DERIVED number (violations found by scanning the tree)
// against a committed baseline and fails when the derived number grows. This
// holds a DECLARED number (the coverage floors in coverage-floors.cjs) against a
// committed baseline and fails when the declared number shrinks. Two records,
// one comparison, no git history and no network: that is what makes either gate
// work at all, because a check that reads a single file cannot tell that the file
// was edited downwards.
//
// ── Why this exists (WO-0013 / T-0018, warrant WG-DEL-001 ruled B) ──────────
//
// jest.config.js is a file anyone can edit downwards, and this venture has done
// exactly that: the floors drifted down to global 8/5/10/10 while the entire app
// router sat behind `!src/app/**` in collectCoverageFrom, so the whole API
// surface had no floor at all. Nothing went red. A gate that can be lowered by
// the same commit that breaks it is not a gate, it is a comment.
//
// So: lowering a floor now fails the build. Raising one passes.
//
// ── The law ─────────────────────────────────────────────────────────────────
//
//   declared >= baseline           for every band, on every metric. Anything
//                                  less is a REGRESSION and exits non-zero.
//   a baselined band must stay     deleting a band deletes its floor, which is
//                                  lowering it to nothing. Also a regression.
//   jest.config.js must wire       floors nothing reads are not floors, so
//   coverage-floors.cjs in         unwiring the module is a regression too.
//   declared > baseline            a RAISE. Passes, and is reported so it can be
//                                  locked into the baseline.
//   a band not in the baseline     a NEW band. More surface under a floor is a
//                                  tightening, so it passes and is reported.
//
// `--update-baseline` locks raises in. Unlike design-lint's, it REFUSES to write
// a value lower than the one already recorded: the baseline is the ratchet pawl,
// and a pawl you can wind backwards with a flag is decorative.
//
//   node scripts/tooling/coverage-floor-check.mjs                  # gate (npm run lint)
//   node scripts/tooling/coverage-floor-check.mjs --report         # declared vs baseline
//   node scripts/tooling/coverage-floor-check.mjs --update-baseline
//
// What this check does NOT do is compare a floor against measured coverage.
// Jest already does that, in `npm run test:coverage`, and doing it twice would
// mean two answers to one question. This check only guards the direction of
// travel; jest still decides whether the code clears the bar.

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const FLOORS_PATH = join(ROOT, "scripts", "tooling", "coverage-floors.cjs");
const BASELINE_PATH = join(ROOT, "scripts", "tooling", "coverage-floors.baseline.json");
const JEST_CONFIG_PATH = join(ROOT, "jest.config.js");

const METRICS = ["statements", "branches", "lines", "functions"];

const require_ = createRequire(import.meta.url);

/** The floors jest actually enforces, read without booting next/jest. */
const declared = require_(FLOORS_PATH);

const baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, "utf-8"))
  : {};

// ── Compare ─────────────────────────────────────────────────────────────────

/** Floors that went DOWN, or vanished. Each one fails the build. */
const regressions = [];
/** Floors that went UP. Each one wants locking into the baseline. */
const raises = [];
/** Bands under a floor for the first time. */
const newBands = [];

for (const [band, floors] of Object.entries(baseline)) {
  const now = declared[band];
  if (!now) {
    regressions.push({
      band,
      metric: "(whole band)",
      was: "present",
      now: "deleted",
      why: "Deleting a band deletes its floor. That is lowering it to nothing.",
    });
    continue;
  }
  for (const metric of METRICS) {
    const was = floors[metric];
    if (was === undefined) continue;
    const value = now[metric];
    if (value === undefined) {
      regressions.push({
        band,
        metric,
        was,
        now: "removed",
        why: "A metric with no floor is a metric with a floor of zero.",
      });
    } else if (value < was) {
      regressions.push({
        band,
        metric,
        was,
        now: value,
        why: "The floors ratchet up only.",
      });
    } else if (value > was) {
      raises.push({ band, metric, was, now: value });
    }
  }
}

for (const band of Object.keys(declared)) {
  if (!(band in baseline)) newBands.push(band);
}

// Floors nothing reads are not floors. If jest.config.js stops requiring the
// module, every number above is decorative and this check is guarding a museum.
const jestConfigWiresFloors =
  existsSync(JEST_CONFIG_PATH) &&
  /coverage-floors\.cjs/.test(readFileSync(JEST_CONFIG_PATH, "utf-8"));

// ── Modes ───────────────────────────────────────────────────────────────────

const mode = process.argv[2];

if (mode === "--report") {
  console.log("coverage floors: declared vs baseline\n");
  const bands = [...new Set([...Object.keys(baseline), ...Object.keys(declared)])].sort();
  for (const band of bands) {
    console.log(`  ${band}`);
    for (const metric of METRICS) {
      const was = baseline[band]?.[metric];
      const now = declared[band]?.[metric];
      const mark = was === undefined ? "new" : now === undefined ? "GONE" : now > was ? "up" : now < was ? "DOWN" : "=";
      console.log(`    ${metric.padEnd(11)} baseline ${String(was ?? "-").padStart(3)}   declared ${String(now ?? "-").padStart(3)}   ${mark}`);
    }
  }
  process.exit(0);
}

if (mode === "--update-baseline") {
  if (regressions.length > 0) {
    console.error(
      "coverage floors: refusing to write a baseline that LOWERS a floor.\n" +
        "The baseline is the ratchet pawl. Raise the declared floors back to at\n" +
        "least the recorded ones, or make the case for a lower bar to the operator\n" +
        "and change the recorded number by hand with the reason in the commit.\n",
    );
    for (const r of regressions) {
      console.error(`  ${r.band}  ${r.metric}: ${r.was} -> ${r.now}`);
    }
    process.exit(1);
  }
  writeFileSync(BASELINE_PATH, JSON.stringify(declared, null, 2) + "\n");
  const bandCount = Object.keys(declared).length;
  console.log(
    `coverage floors: baseline written, ${bandCount} bands, ` +
      `${raises.length} raised, ${newBands.length} newly floored.`,
  );
  process.exit(0);
}

if (regressions.length > 0 || !jestConfigWiresFloors) {
  console.error("coverage floors: a floor was LOWERED\n");
  for (const r of regressions) {
    console.error(`  ${r.band}  ${r.metric}  (baseline ${r.was}, declared ${r.now})`);
    console.error(`    ${r.why}`);
  }
  if (!jestConfigWiresFloors) {
    console.error(
      "  jest.config.js no longer requires scripts/tooling/coverage-floors.cjs.\n" +
        "    Floors nothing reads are not floors.",
    );
  }
  console.error(
    "\nCoverage floors ratchet up only (WO-0013, warrant WG-DEL-001 ruled B).\n" +
      "If coverage genuinely fell, the fix is the tests, not the floor. Do NOT run\n" +
      "--update-baseline to absorb this; it will refuse.",
  );
  process.exit(1);
}

if (raises.length > 0 || newBands.length > 0) {
  for (const r of raises) {
    console.log(`coverage floors: RAISED  ${r.band} ${r.metric}  ${r.was} -> ${r.now}`);
  }
  for (const band of newBands) {
    console.log(`coverage floors: NEW BAND  ${band}`);
  }
  console.log(
    "Lock it in: npm run lint:coverage-floors -- --update-baseline (same commit).",
  );
  process.exit(0);
}

const total = Object.keys(declared).length;
console.log(
  `coverage floors: no floor lowered (${total} bands held at baseline). ` +
    `Run with --report to see them.`,
);
