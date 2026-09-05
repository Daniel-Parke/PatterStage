/** @jest-environment node */

// T-0088, ruling 4: bound everything. One helper turns a query string into a
// limit and an offset that cannot be NaN, negative, fractional or unbounded.
// Sessions had `LIMIT -1` (SQLite: unlimited) and `LIMIT NaN` (500) reachable
// from the URL; missions had no limit at all.

import { parseListBounds } from "@/lib/list-bounds";

const sp = (q: string) => new URLSearchParams(q);
const o = { defaultLimit: 200, maxLimit: 500 };

describe("parseListBounds", () => {
  it("defaults when nothing is asked", () => {
    expect(parseListBounds(sp(""), o)).toEqual({ limit: 200, offset: 0 });
  });

  it("honours a sane request", () => {
    expect(parseListBounds(sp("limit=5&offset=10"), o)).toEqual({ limit: 5, offset: 10 });
  });

  it("clamps a limit above the ceiling to the ceiling", () => {
    expect(parseListBounds(sp("limit=99999"), o).limit).toBe(500);
  });

  it("clamps a negative or zero limit to one, never to unlimited", () => {
    // SQLite reads LIMIT -1 as "no limit": the cap bypass the report found.
    expect(parseListBounds(sp("limit=-1"), o).limit).toBe(1);
    expect(parseListBounds(sp("limit=0"), o).limit).toBe(1);
  });

  it("treats junk as unspecified", () => {
    expect(parseListBounds(sp("limit=abc&offset=xyz"), o)).toEqual({ limit: 200, offset: 0 });
    expect(parseListBounds(sp("limit=&offset="), o)).toEqual({ limit: 200, offset: 0 });
  });

  it("floors fractions and floors a negative offset at zero", () => {
    expect(parseListBounds(sp("limit=7.9&offset=2.2"), o)).toEqual({ limit: 7, offset: 2 });
    expect(parseListBounds(sp("offset=-5"), o).offset).toBe(0);
  });

  it("never returns a non-finite number", () => {
    const r = parseListBounds(sp("limit=Infinity&offset=1e400"), o);
    expect(Number.isFinite(r.limit)).toBe(true);
    expect(Number.isFinite(r.offset)).toBe(true);
    expect(r.limit).toBe(500);
  });
});
