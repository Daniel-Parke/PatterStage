/** @jest-environment node */

// T-0081 acceptance oracle — findings 3 and 12, which are the same complaint
// twice: a number the product displays with confidence, that nothing computes.
//
// FINDING 3. `/api/status` reports `skillsCount` and `sessionsCount` from the
// meta table. Nothing writes either key, so both are the `getSystemStatNumber`
// default forever, and an install with 40 skills reports 0. It survived because
// `api-routes-simple.test.ts:128` mocks the GETTER and asserts the route echoes
// it — the vacuous-sweep class T-0075 named: a test that proves the plumbing
// while the tap is dry.
//
// The mirror image is three keys WRITTEN by nobody's reader:
// `config.memory_provider`, `config.default_model`, `memory.available`. Work
// done every sync tick, stored, and never looked at. ConfigSync's own header
// claims it extracts a "skills count" it has never written.
//
// FINDING 12. `runsCompleted: 0` for an agent that had just completed runs.
// FOUR causes, each independently sufficient:
//
//   RC-A  progression snapshots are captured ONLY inside GET /api/stats. An
//         API-driven pass never opens the dashboard, so nothing captures, and
//         /api/agents/progression reads stored rows that were never written --
//         while spend reads live. That asymmetry is the whole bug report.
//   RC-B  the Composer profile picker sends the DISPLAY NAME ("Bob (local
//         default)") where a slug belongs, so those runs attribute to a profile
//         that does not exist and vanish from every per-agent number.
//   RC-C  countAgentActiveDays matches `profile_name = ?`, but a root-agent run
//         stores NULL. Its sibling runsByProfile coalesces NULL to "default".
//         So the same run counts for XP and not for active days.
//   RC-D  the root agent is absent from /api/agents/experience entirely, which
//         lists profiles only -- and the root agent is the one every default
//         install actually uses.

import { join } from "path";
import { readFileSync, readdirSync, statSync } from "fs";

const SRC = join(process.cwd(), "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const SOURCES = walk(SRC).map((f) => readFileSync(f, "utf-8"));
const ALL_SOURCE = SOURCES.join("\n");

function keysMatching(pattern: RegExp): Set<string> {
  const found = new Set<string>();
  for (const match of ALL_SOURCE.matchAll(pattern)) found.add(match[1]);
  return found;
}

const READ_KEYS = () => keysMatching(/getSystemStat(?:Number|Boolean)?\(\s*"([^"]+)"/g);
const WRITE_KEYS = () => {
  const keys = keysMatching(/setSystemStat(?:Boolean)?\(\s*"([^"]+)"/g);
  // setMultipleStats takes an object literal; collect its keys from each call.
  for (const call of ALL_SOURCE.matchAll(/setMultipleStats\(\{([\s\S]*?)\}\)/g)) {
    for (const k of call[1].matchAll(/"([^"]+)"\s*:/g)) keys.add(k[1]);
  }
  return keys;
};

describe("every meta key has both a writer and a reader", () => {
  it("GUARD: the scan finds a real population, not an empty one", () => {
    // The assertion that makes the two below mean anything. A regex that
    // silently stops matching turns "no orphan keys" into "no keys", and this
    // whole file would pass while measuring nothing -- which is precisely the
    // defect class it exists to catch.
    expect(SOURCES.length).toBeGreaterThan(300);
    expect(READ_KEYS().size).toBeGreaterThanOrEqual(5);
    expect(WRITE_KEYS().size).toBeGreaterThanOrEqual(5);
  });

  it("no key is READ that nothing writes", () => {
    // skills.count and sessions.total are read here and written nowhere, so
    // /api/status reports the default and calls it a measurement.
    const orphanReads = [...READ_KEYS()].filter((k) => !WRITE_KEYS().has(k));

    expect(orphanReads).toEqual([]);
  });

  it("no key is WRITTEN that nothing reads", () => {
    // The mirror image: work done on every sync tick and stored for nobody.
    const orphanWrites = [...WRITE_KEYS()].filter((k) => !READ_KEYS().has(k));

    expect(orphanWrites).toEqual([]);
  });

  it("HONESTY NOTE: this reads source text, so it proves reachability not behaviour", () => {
    // Stated as a test so it cannot be quietly forgotten. A key present in both
    // sets could still be written on a branch that never runs. What this
    // catches is the cheaper and commoner fault -- a key with no counterpart at
    // all -- and the live-count tests below are what prove the numbers move.
    expect(READ_KEYS().has("config.present")).toBe(true);
  });
});

describe("ConfigSync does not claim work it does not do", () => {
  it("its header does not promise a skills count", () => {
    const source = readFileSync(
      join(SRC, "modules", "hermes", "sync", "ConfigSync.ts"),
      "utf-8",
    );

    // Only the DESCRIPTIVE part is judged -- everything before the historical
    // note that begins "It used to claim". A header that records a removed
    // false claim has to be able to quote it; what must not survive is the
    // claim itself, stated in the present tense as something the file does.
    //
    // The claim was "extracts key metadata (memory provider, default model,
    // skills count)". It has never written a skills count. A false comment is
    // worse than no comment: it sends the next reader hunting for a writer that
    // was never there, which is exactly the search finding 3 required.
    const marker = source.indexOf("It used to claim");
    const describes = source.slice(0, marker === -1 ? 1200 : marker);

    expect(describes).not.toMatch(/skills/i);
  });

  it("GUARD: the header slice being judged is not empty", () => {
    // Without this, a renamed marker string would silently shrink the judged
    // text to nothing and the test above would pass by measuring no header at
    // all -- the vacuous-sweep shape this whole task is about.
    const source = readFileSync(
      join(SRC, "modules", "hermes", "sync", "ConfigSync.ts"),
      "utf-8",
    );
    const marker = source.indexOf("It used to claim");
    const describes = source.slice(0, marker === -1 ? 1200 : marker);

    expect(describes.length).toBeGreaterThan(200);
    expect(describes).toMatch(/config\.yaml/);
  });
});
