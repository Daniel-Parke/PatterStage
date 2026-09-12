/** @jest-environment node */

// T-0064 — the skip the log had been calling an FK violation.
//
// HONESTY NOTE, first: this test was written AFTER the fix, not before it. The
// rest of this round was oracle-first and this item was not, which is worth
// saying rather than leaving a reader to assume a discipline that was not
// followed. The measurement below is therefore a characterisation of the fix,
// not a repro I watched fail.
//
// THE DEFECT. `estimateSessionSize` used `?? 0`, which catches null and
// undefined and NOT NaN. Its inputs come from a blind cast over the agent's own
// state.db (`readHermesSessionsFromStateDb` ends in `.all() as
// HermesSessionRow[]`), so a non-numeric message_count produced NaN.
// better-sqlite3 binds NaN as a double, SQLite stores a NaN double as NULL, and
// the NOT NULL on `sessions.size` rejects the row.
//
// So the row was skipped, the bare catch discarded the reason, and the summary
// line asserted "FK/constraint errors" -- a cause the code had never observed
// and, in this case, the wrong one. Two rows failed this way every 15 seconds
// for a whole QA session, twice per tick, at ERROR level.

import { readFileSync } from "fs";
import { join } from "path";

import { estimateSessionSize } from "@/lib/sessions/session-repository";

describe("estimateSessionSize never returns NaN", () => {
  it.each([
    ["a string count from a foreign state.db", "12", {}],
    ["an object", {}, null],
    ["an array", [], null],
    ["a boolean", true, null],
    ["NaN itself", NaN, null],
    ["Infinity", Infinity, null],
  ])("coerces %s to a real number", (_label, messageCount, apiCallCount) => {
    const size = estimateSessionSize(messageCount, apiCallCount);
    expect(Number.isFinite(size)).toBe(true);
    expect(size).toBeGreaterThanOrEqual(0);
  });

  it("still counts real numbers", () => {
    // The control. Without it, "coerce everything to 0" would pass every
    // assertion above and quietly make every session zero bytes.
    expect(estimateSessionSize(10, 4)).toBe(10 * 200 + 4 * 50);
  });

  it("still honours the minimum", () => {
    expect(estimateSessionSize(0, 0, 512)).toBe(512);
  });

  it("takes unknown, so an upstream cast cannot launder a bad value past it", () => {
    // The parameter type is part of the fix. Narrowing it back to
    // `number | null` would let the blind cast in state-db.ts satisfy the
    // compiler again while still passing a string at runtime.
    const src = readFileSync(
      join(process.cwd(), "src", "lib", "sessions", "session-repository.ts"),
      "utf-8",
    );
    const fn = src.slice(src.indexOf("export function estimateSessionSize"));
    expect(fn.slice(0, 200)).toMatch(/messageCount: unknown/);
  });
});
