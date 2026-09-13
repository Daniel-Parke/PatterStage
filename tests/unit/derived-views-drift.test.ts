/**
 * @jest-environment node
 *
 * The derived-view drift gate, tested against the drift it exists for.
 *
 * org/TASKS.md is derived from the records under org/tasks/, and it drifted:
 * four consecutive records read `done` with a named owner while the table still
 * reported them `proposed | unassigned`, and two newer records had no row at
 * all. Nothing caught it, because nothing compared the two. It surfaced in
 * review, by eye.
 *
 * A gate whose failure path is never exercised is a gate nobody can trust, so
 * these run the real script over fixture repos and assert on its exit code and
 * its message. The green case is the live repo itself, which keeps the gate
 * honest about the tree it actually guards.
 */

import { execFileSync } from "child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const SCRIPT = join(__dirname, "..", "..", "scripts", "tooling", "check-derived-views.mjs");
const REPO = join(__dirname, "..", "..");

interface Run {
  code: number;
  out: string;
}

/**
 * Run the check with the repo root relocated to `root`.
 *
 * The script resolves ROOT from its own location, so the fixture gets a copy of
 * the script at the same depth rather than an env var the production path would
 * never use. Testing a different code path than the one that ships is how a
 * green test comes to mean nothing.
 */
function runIn(root: string): Run {
  const dir = join(root, "scripts", "tooling");
  mkdirSync(dir, { recursive: true });
  cpSync(SCRIPT, join(dir, "check-derived-views.mjs"));
  // No scripts/docs/lib.mjs here on purpose. The script grew a second derived
  // view in T-0109, and it imports that module LAZILY, only where docs/ exists.
  // These fixtures hold only org/, which is the shape these cases are about.
  try {
    const out = execFileSync(process.execPath, [join(dir, "check-derived-views.mjs")], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

/** A fixture repo: records in, table rows out. */
function fixture(records: Array<Record<string, string>>, rows: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "ps-derived-"));
  mkdirSync(join(root, "org", "tasks"), { recursive: true });
  for (const r of records) {
    writeFileSync(join(root, "org", "tasks", `${r.id}.json`), JSON.stringify(r, null, 2));
  }
  writeFileSync(
    join(root, "org", "TASKS.md"),
    ["# TASKS", "", "| id | mode | tier | status | owner |", "| --- | --- | --- | --- | --- |", ...rows, ""].join("\n"),
  );
  return root;
}

const REC = {
  id: "T-0001",
  mode: "standard",
  tier_ruled: "R2",
  status: "done",
  owner_session: "a-session-2026-08-26",
};
const ROW = "| T-0001 | standard | R2 | done | a-session-2026-08-26 |";

describe("check-derived-views", () => {
  const made: string[] = [];
  const build = (recs: Array<Record<string, string>>, rows: string[]) => {
    const r = fixture(recs, rows);
    made.push(r);
    return r;
  };
  afterAll(() => {
    for (const r of made) rmSync(r, { recursive: true, force: true });
  });

  it("passes when the table agrees with the records", () => {
    const { code } = runIn(build([REC], [ROW]));
    expect(code).toBe(0);
  });

  it("fails on the exact drift that occurred: a closed record still shown as proposed", () => {
    const { code, out } = runIn(build([REC], ["| T-0001 | standard | R2 | proposed | unassigned |"]));
    expect(code).toBe(1);
    expect(out).toContain('status="proposed"');
    expect(out).toContain('the record says status="done"');
  });

  it("fails when a record has no row, which is how the newest two went missing", () => {
    const { code, out } = runIn(build([REC], []));
    expect(code).toBe(1);
    expect(out).toContain("T-0001 has a record but no row");
  });

  it("fails when a row has no record", () => {
    const { code, out } = runIn(build([REC], [ROW, "| T-9999 | standard | R2 | done | ghost |"]));
    expect(code).toBe(1);
    expect(out).toContain("T-9999 has a row in org/TASKS.md but no record");
  });

  it("reports an unreadable record rather than guessing at it", () => {
    const root = build([REC], [ROW]);
    writeFileSync(join(root, "org", "tasks", "T-0002.json"), "{ not json");
    const { code, out } = runIn(root);
    expect(code).toBe(1);
    expect(out).toContain("T-0002.json: not valid JSON");
  });

  it("points at the generator, and warns off hand-editing the derived file", () => {
    const { out } = runIn(build([REC], []));
    expect(out).toContain("Do NOT hand-edit org/TASKS.md");
    expect(out).toContain("render_views");
  });

  it("does not mistake a tier or mode change for agreement", () => {
    const { code, out } = runIn(build([REC], ["| T-0001 | high-assurance | R3 | done | a-session-2026-08-26 |"]));
    expect(code).toBe(1);
    expect(out).toContain('mode="high-assurance"');
    expect(out).toContain('tier="R3"');
  });

  it("passes against the live repo, so the gate is honest about the tree it guards", () => {
    const out = execFileSync(process.execPath, [SCRIPT], { cwd: REPO, encoding: "utf-8" });
    expect(out).toContain("matches all");
  });
});
