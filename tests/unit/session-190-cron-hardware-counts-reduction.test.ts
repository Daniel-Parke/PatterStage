/**
 * Source-pattern test that pins the session-190 cron page refactor:
 * `hardwareEnabled` + `hardwareTotal` are derived from a SINGLE
 * `.reduce()` pass over `hardware.jobs`, with named accumulator
 * keys. The pre-refactor code did two independent reads
 * (`.filter((j) => j.enabled).length` + `.length`) — the test
 * pins the single-pass shape.
 *
 * Same pattern as session-188's reductions in
 * `agents/page.tsx` (driftCount + syncErrorCount) and
 * `models/import/route.ts` (modelsImported + modelsSkipped).
 *
 * @jest-environment node
 */
import { readFileSync } from "fs";
import { join } from "path";

const cronPagePath = join(
  __dirname,
  "..",
  "..",
  "src",
  "app",
  "orchestration",
  "cron",
  "page.tsx",
);

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

const cronPageSrc = stripComments(readFileSync(cronPagePath, "utf8"));

describe("session-190 cron page hardwareEnabled + hardwareTotal single-pass refactor", () => {
  it("hardwareEnabled is destructured from the .reduce() result, not a .filter().length", () => {
    // The pre-refactor shape was
    //   const hardwareEnabled = hardware.jobs.filter((j) => j.enabled).length;
    // The post-refactor shape is
    //   const { enabled: hardwareEnabled, total: hardwareTotal } = useMemo(
    //     () => hardware.jobs.reduce(...),
    //     [hardware.jobs],
    //   );
    // Pin the destructure: `enabled: hardwareEnabled` and
    // `total: hardwareTotal` in the same reduce.
    const destructureBlock = cronPageSrc.match(
      /const \{ enabled: hardwareEnabled, total: hardwareTotal \} = useMemo\(\s*\(\) =>\s*hardware\.jobs\.reduce\(/,
    );
    expect(destructureBlock).not.toBeNull();
  });

  it("the .reduce() body has BOTH the enabled check AND the total increment", () => {
    // The accumulator increments `enabled` for jobs with
    // `j.enabled === true`, and increments `total` for every job.
    // Pin both increments in the reduce body.
    const reduceBlock = cronPageSrc.match(
      /hardware\.jobs\.reduce\(\s*\(acc, j\) => \{[\s\S]*?\},\s*\{ enabled: 0, total: 0 \},/,
    );
    expect(reduceBlock).not.toBeNull();
    expect(reduceBlock![0]).toMatch(/if \(j\.enabled\) acc\.enabled \+= 1/);
    expect(reduceBlock![0]).toMatch(/acc\.total \+= 1/);
    expect(reduceBlock![0]).toMatch(/return acc/);
  });

  it("the reduce is memoized with useMemo + [hardware.jobs] deps", () => {
    // The useMemo wrapper memoizes the result against the
    // hardware.jobs reference. The deps array is `[hardware.jobs]`
    // (NOT `[]` — that would freeze the result on mount and never
    // re-run when hardware.jobs changes; NOT `[hardware]` — that
    // would re-run on every page render since `hardware` is a
    // fresh object literal on every render).
    //
    // The anchor: the destructure + useMemo + the inner
    // .reduce( (acc, j) => { ... }, { enabled: 0, total: 0 } )
    // close, then the deps array on the next line.
    // Use [\s\S]+? with a non-greedy match against the literal
    // `[hardware.jobs])` at the end — that's the unique
    // signature of this exact useMemo block.
    const useMemoBlock = cronPageSrc.match(
      /const \{ enabled: hardwareEnabled, total: hardwareTotal \} = useMemo\(\s*\(\) =>\s*hardware\.jobs\.reduce\([\s\S]+?\),[\s\S]*?\[hardware\.jobs\],/,
    );
    expect(useMemoBlock).not.toBeNull();
  });

  it("the pre-refactor .filter().length inline is gone", () => {
    // The inline `hardware.jobs.filter((j) => j.enabled).length`
    // was the pre-refactor shape. The post-refactor reads
    // `hardwareEnabled` from the destructure. Pin the absence
    // of the inline form.
    expect(cronPageSrc).not.toMatch(
      /hardware\.jobs\.filter\(\(j\) => j\.enabled\)\.length/,
    );
  });

  it("the pre-refactor .length inline on hardware.jobs is gone", () => {
    // The inline `hardware.jobs.length` (which read the total
    // directly) is gone — the total is now derived from the
    // same .reduce() pass. The `|| 0` display fallback for
    // the empty-array case is preserved at the pageSubtitle
    // string-template site (line ~358).
    // Note: this regex checks for `.hardware.jobs.length` as
    // a standalone expression (not as part of the .reduce
    // array reference). The .reduce() call reads
    // `hardware.jobs.reduce(...)` — that pattern uses `.length`
    // is not in it.
    const standaloneLengthReads = cronPageSrc.match(
      /hardware\.jobs\.length/g,
    );
    // The only acceptable occurrence is the
    // `hardware.jobs.reduce(...)` array reference. The
    // standalone `.length` read is gone.
    // The pattern `hardware.jobs.length` matches both forms:
    //   1. `hardware.jobs.length` (standalone)
    //   2. NOT a substring of `.reduce(` — the reduce call uses
    //      `hardware.jobs.reduce(`, which is `hardware.jobs` +
    //      `.reduce(`, not `hardware.jobs.length`.
    // So `hardware.jobs.length` should appear ZERO times in
    // the post-refactor file.
    expect(standaloneLengthReads).toBeNull();
  });
});
