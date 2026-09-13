/**
 * B15 (T-0109), decision 15 — the governance corpus leaves docs/ for org/.
 *
 * ADR-0010 is ACCEPTED and on disk (`org/decisions/ADR-0010-governance-corpus-
 * lives-under-org.md`); B0 wrote it and B15 executes it. Fourteen files under
 * `docs/` plus the root `OPERATORS_GUIDE.md` are EOS governance, written in a
 * vocabulary a new reader should never meet, and the docs pipeline publishes
 * `docs/` whole — so the corpus has to be OUT of `docs/` before the site exists,
 * not filtered out of it.
 *
 * The move is only half the work. ADR-0010 §2 requires every inbound reference
 * updated in the same commit, because a stale path reads as verified, which is
 * worse than no path at all (the whole reason `check-doc-links.mjs` exists).
 * This file is the sweep.
 *
 * The sweep's scope is deliberate: `src/ scripts/ ops/ tests/ docs/ .github/` and
 * the repository root. `org/` is EXCLUDED — ADR-0010 §3 rules that task records
 * and the plans citing the old paths are historical and are not rewritten.
 *
 * The old paths are assembled at run time rather than written as literals, so
 * this file does not match its own sweep.
 *
 * Red today: nothing has moved.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = join(__dirname, "..", "..");
const D = "docs/";

/** ADR-0010 §1, the move map, verbatim. */
const MOVES: Array<[from: string, to: string]> = [
  [`${D}LOCKBOOK.md`, "org/LOCKBOOK.md"],
  [`${D}RULINGS.json`, "org/RULINGS.json"],
  [`${D}VENTURE_BRIEF.md`, "org/VENTURE_BRIEF.md"],
  [`${D}ACCEPTANCE_SPINE.md`, "org/ACCEPTANCE_SPINE.md"],
  [`${D}PRODUCT_MAP.md`, "org/PRODUCT_MAP.md"],
  [`${D}COMPILE_REPORT.md`, "org/COMPILE_REPORT.md"],
  [`${D}EOS_FEEDBACK.md`, "org/EOS_FEEDBACK.md"],
  [`${D}genesis/LENS.md`, "org/genesis/LENS.md"],
  [`${D}genesis/RESEARCH_PACKET.md`, "org/genesis/RESEARCH_PACKET.md"],
  [`${D}genesis/WORK_PACKAGE.md`, "org/genesis/WORK_PACKAGE.md"],
  [`${D}eos-session0/CORRECTIVE_RAW.json`, "org/eos-session0/CORRECTIVE_RAW.json"],
  [`${D}eos-session0/WALK_RAW.json`, "org/eos-session0/WALK_RAW.json"],
  [`${D}eos-session0/fills.json`, "org/eos-session0/fills.json"],
  [`${D}UX_AUDIT.md`, "org/reviews/UX_AUDIT.md"],
  [`${D}QA_NOTES.md`, "org/reviews/QA_NOTES.md"],
  [`${D}QA_ROUND_6_BRIEF.md`, "org/reviews/QA_ROUND_6_BRIEF.md"],
  ["OPERATORS_GUIDE.md", "org/EOS_OPERATORS_GUIDE.md"],
];

const SWEEP_ROOTS = ["src", "scripts", "ops", "tests", "docs", ".github"];
const SWEEP_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".mts",
  ".mjs",
  ".cjs",
  ".js",
  ".json",
  ".md",
  ".yml",
  ".yaml",
];

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "coverage") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SWEEP_EXTENSIONS.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

const rel = (p: string) => relative(ROOT, p).split(sep).join("/");

function sweepFiles(): string[] {
  const files = SWEEP_ROOTS.flatMap((d) => walk(join(ROOT, d)));
  for (const entry of readdirSync(ROOT)) {
    if (!entry.endsWith(".md")) continue;
    const full = join(ROOT, entry);
    if (statSync(full).isFile()) files.push(full);
  }
  // This file and its siblings quote the old paths on purpose.
  return files.filter((f) => !rel(f).startsWith("tests/unit/b15-"));
}

describe("B15 · the governance corpus moves under org/ (ADR-0010 §1)", () => {
  it.each(MOVES)("%s is gone", (from) => {
    expect(existsSync(join(ROOT, from))).toBe(false);
  });

  it.each(MOVES)("%s now lives at %s", (_from, to) => {
    expect(existsSync(join(ROOT, to))).toBe(true);
  });

  it("gives the review records their own folder", () => {
    expect(existsSync(join(ROOT, "org", "reviews"))).toBe(true);
  });

  it("leaves the two legal notices at the repository root", () => {
    // ADR-0010 §1: they are notices a redistributor looks for at the root, and
    // neither is governance. The plan's audit line lists REBRANDING under
    // "archive"; the accepted ADR overrides it.
    expect(existsSync(join(ROOT, "REBRANDING.md"))).toBe(true);
    expect(existsSync(join(ROOT, "TRADEMARK.md"))).toBe(true);
  });

  it("keeps docs/adr/README.md as the public pointer", () => {
    expect(existsSync(join(ROOT, "docs", "adr", "README.md"))).toBe(true);
  });
});

describe("B15 · every inbound reference moves in the same commit (ADR-0010 §2)", () => {
  const files = sweepFiles();

  it("finds a tree to sweep, so an empty walk cannot read as a pass", () => {
    expect(files.length).toBeGreaterThan(200);
  });

  it.each(MOVES.map(([from]) => from))("nothing outside org/ still names %s", (from) => {
    const hits: string[] = [];
    for (const file of files) {
      // Blank out every NEW home before looking for an old one. This was a
      // substring sweep, and "org/EOS_OPERATORS_GUIDE.md" contains
      // "OPERATORS_GUIDE.md": the sweep refused the very reference the move is
      // supposed to produce, so this case and the docs/README.md case below
      // could not both pass (T-0109).
      let text = readFileSync(file, "utf-8");
      for (const [, to] of MOVES) text = text.split(to).join("");
      if (text.includes(from)) hits.push(rel(file));
    }
    expect(hits).toEqual([]);
  });

  it("eos-compile.mjs reads the session-0 fills from org/, not docs/", () => {
    // The one LIVE path in the sweep rather than a comment: line 134 today reads
    // join(OUT, "docs", "eos-session0", "fills.json"), which the substring sweep
    // above cannot see because the segments are separate arguments.
    const source = readFileSync(join(ROOT, "scripts", "tooling", "eos-compile.mjs"), "utf-8");
    expect(source).not.toContain('"docs", "eos-session0"');
  });

  it("eos-compile.mjs's HAND_WRITTEN list names the new homes", () => {
    const source = readFileSync(join(ROOT, "scripts", "tooling", "eos-compile.mjs"), "utf-8");
    expect(source).toContain("org/VENTURE_BRIEF.md");
    expect(source).toContain("org/EOS_FEEDBACK.md");
  });

  it("docs/README.md points at org/ once and carries no Governance table", () => {
    const readme = readFileSync(join(ROOT, "docs", "README.md"), "utf-8");
    expect(readme).toContain("org/EOS_OPERATORS_GUIDE.md");
    expect(readme).toContain("org/START.md");
    expect(readme).not.toMatch(/^#+\s*Governance/m);
  });
});

describe("B15 · docs/ is re-tiered into six sections", () => {
  const TIERS = ["start-here", "concepts", "guides", "running", "reference", "contributing"];

  it.each(TIERS)("docs/%s/ exists", (tier) => {
    expect(existsSync(join(ROOT, "docs", tier))).toBe(true);
  });

  it("keeps only the index and the GitHub-recognised files at the top of docs/", () => {
    const top = readdirSync(join(ROOT, "docs"))
      .filter((e) => e.endsWith(".md"))
      .sort();
    expect(top).toEqual([
      "CODE_OF_CONDUCT.md",
      "CONTRIBUTING.md",
      "README.md",
      "SECURITY.md",
      "SUPPORT.md",
    ]);
  });

  it("dissolves the 164 KB walkthrough into the guides tier", () => {
    expect(existsSync(join(ROOT, "docs", "USER_WALKTHROUGH_GUIDE.md"))).toBe(false);
  });

  it("retires the Laboratory page along with the Laboratory label", () => {
    expect(existsSync(join(ROOT, "docs", "LABORATORY.md"))).toBe(false);
  });

  it("writes the manifest as a derived file at the top of docs/", () => {
    expect(existsSync(join(ROOT, "docs", "manifest.json"))).toBe(true);
  });
});
