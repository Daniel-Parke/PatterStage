// scripts/tooling/eos-compile.mjs
//
// The mechanical core of EOS Session 0 phase D: prune, fill, front-matter
// rewrite. inception/COMPILE.md sanctions scripting exactly this much and says
// the script is part of the session's record, so this file IS a Session 0
// artefact and not a convenience.
//
// It is also the first working piece of the seed-pack generator the owner asked
// for. What is deterministic lives here; what needs judgement (the interview, the
// rulings, the distillation) stays with a human and an agent. That split is the
// whole design: the agent does the INTERVIEW, code does the COMPILE.
//
//   node scripts/tooling/eos-compile.mjs --check    # report, write nothing
//   node scripts/tooling/eos-compile.mjs            # compile
//
// What it deliberately does NOT do:
//   - author add-on files (bounded authoring, a human writes those)
//   - distil doctrine into the lock-book (judgement)
//   - byte-copy AGENTS.md to CLAUDE.md (already gated by check-agent-files.mjs)

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

const EOS = process.env.EOS_ROOT || "C:/Users/Daniel/Documents/Coding/Github/PatterTech_EOS";
const OUT = process.cwd();
const CHECK = process.argv.includes("--check");
let VENTURE_NAME = "the venture";
const SCALE = "M";

/** Parse SCALE_MATRIX.md's pipe table: the law of what a seed contains. */
function readMatrix() {
  const src = readFileSync(join(EOS, "kernel", "SCALE_MATRIX.md"), "utf-8");
  const rows = [];
  for (const line of src.split(/\r?\n/)) {
    const m = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(x|)\s*\|\s*(x|)\s*\|\s*(x|)\s*\|$/);
    if (!m) continue;
    const [, path, template, s, mCol, l] = m;
    if (path === "path" || path.startsWith("---")) continue;
    rows.push({ path, template, S: s === "x", M: mCol === "x", L: l === "x" });
  }
  return rows.filter((r) => r[SCALE]);
}

/**
 * Remove every fenced section whose scale list excludes the ruled scale, and the
 * fence markers themselves.
 *
 * COMPILE.md: "A fence inside kept content is a template defect: stop and file it
 * in the venture's feedback file before continuing." So an unclosed fence throws
 * rather than silently truncating a file.
 */
function prune(text, scale) {
  let pruned = 0;
  const lines = text.split(/\r?\n/);
  const out = [];
  let skipping = false;
  let openedAt = -1;
  for (let i = 0; i < lines.length; i++) {
    // kernel/README.md defines both markers: `<!-- scale: M L -->` opens,
    // `<!-- scale: end -->` closes. Test the close FIRST, because it shares the
    // opening marker's prefix and would otherwise be read as an open fence.
    const close = /<!--\s*scale:\s*end\s*-->/.test(lines[i]);
    const open = close ? null : lines[i].match(/<!--\s*scale:\s*([SML][SML,\s]*?)\s*-->/);
    if (open) {
      const scales = open[1].split(/[,\s]+/).filter(Boolean);
      skipping = !scales.includes(scale);
      if (skipping) pruned += 1;
      openedAt = i + 1;
      continue; // drop the fence line itself
    }
    if (close) {
      skipping = false;
      openedAt = -1;
      continue;
    }
    if (!skipping) out.push(lines[i]);
  }
  if (openedAt !== -1) {
    throw new Error(`unclosed <!-- scale: --> fence opened at line ${openedAt}: template defect, file it in EOS_FEEDBACK.md`);
  }
  // Returns the pruned text plus a count, so the compile report's ancestry table
  // is generated from what actually happened rather than typed by hand.
  return { text: out.join("\n"), pruned };
}

/** Every {{SLOT}} in a template, in order, deduplicated. */
function slotsIn(text) {
  return [...new Set([...text.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map((m) => m[1]))];
}

function fill(text, values) {
  let filled = 0;
  const out = text.replace(/\{\{([A-Z0-9_]+)\}\}/g, (whole, slot) => {
    if (!(slot in values)) return whole;
    filled += 1;
    return values[slot];
  });
  return { out, filled };
}

/**
 * Compiled files drop `template: true` and `extracted_from`, and gain
 * `compiled_from`. Only the leading front-matter block is touched.
 */
function rewriteFrontMatter(text, templatePath) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return text;
  const body = m[1]
    .split(/\r?\n/)
    .filter((l) => !/^template:\s*true\s*$/.test(l) && !/^extracted_from:/.test(l))
    // COMPILE.md: compiled files "keep a summary, type and tags that read true for
    // the venture". A summary still describing the TEMPLATE is the commonest way a
    // compiled seed reads as boilerplate, so rewrite both rather than only
    // stripping the flags.
    .map((l) => {
      if (/^type:\s*template\s*$/.test(l)) return "type: venture";
      if (/^summary:/.test(l)) {
        return l
          .replace(/\btemplate\b/gi, "")
          .replace(/\s{2,}/g, " ")
          .replace(/summary:\s*/, `summary: ${VENTURE_NAME} `)
          .replace(/,\s*$/, "")
          .trimEnd();
      }
      return l;
    });
  body.push(`compiled_from: ${templatePath}`);
  return `---\n${body.join("\n")}\n---\n` + text.slice(m[0].length);
}

// ── Run ─────────────────────────────────────────────────────────────────────

const VALUES = JSON.parse(
  readFileSync(join(OUT, "org", "eos-session0", "fills.json"), "utf-8"),
);

VENTURE_NAME = VALUES.VENTURE_NAME || VENTURE_NAME;

const matrix = readMatrix();

// GUARD THE GUARD. readMatrix() returns [] whenever its row regex stops matching
// the matrix's shape, and an empty matrix makes this whole script a silent no-op
// that still prints "0 missing template(s), 0 unfilled slot(s)" and exits 0. That
// is indistinguishable from success, which is how it went unnoticed.
//
// It is unnoticed RIGHT NOW, and deliberately left unrepaired: the regex expects
// five columns (path, template, S, M, L) and SCALE_MATRIX.md has four
// (path, source, S, ORG), so nothing has matched since the matrix changed shape.
// `const SCALE = "M"` also names a column that no longer exists.
//
// The repair is NOT to make the regex match. Doing that would immediately
// regenerate 32 files from the sibling repo's templates, including AGENTS.md,
// CLAUDE.md, org/CONSTITUTION.md and org/START.md, discarding every hand
// correction in them, and would write docs/policy.json and docs/TASKS.md at
// paths this repo does not use (they live under org/). Since ADR-0010 there is
// a second way to lose: the matrix still names the seed's old homes for the
// lock-book, the venture brief and the EOS operators guide, which now live
// under org/, so a repaired compile would write a stale second copy of each
// back into docs/ and at the repository root. That is an operator decision
// about seed ancestry, not a lint fix.
//
// So: fail loudly instead of pretending. A tool that cannot fail is not a check.
if (matrix.length === 0) {
  console.error(
    `eos-compile: the matrix at ${join(EOS, "kernel", "SCALE_MATRIX.md")} parsed to ZERO rows.
` +
      `This script would do nothing while reporting success, so it refuses to run.
` +
      `Cause: readMatrix()'s row regex expects 5 columns and the matrix now has 4
` +
      `(path | source | S | ORG), and SCALE is "${SCALE}", which is not one of them.
` +
      `Repairing the parse REGENERATES 32 files from sibling-repo templates and
` +
      `overwrites hand-edited governance. See org/EOS_FEEDBACK.md before changing it.`,
  );
  process.exit(1);
}
const report = [];
let missingTemplates = 0;
let unfilled = 0;

for (const row of matrix) {
  if (/byte copy/i.test(row.template)) {
    report.push({ path: row.path, action: "byte copy", note: "gated by check-agent-files.mjs" });
    continue;
  }
  const tpl = join(EOS, row.template);
  if (!existsSync(tpl)) {
    report.push({ path: row.path, action: "TEMPLATE MISSING", note: row.template });
    missingTemplates++;
    continue;
  }
  // Files Session 0 wrote by hand are never regenerated. Checked BEFORE compiling
  // so --check reports the same outcome as a real run; doing it after made the
  // dry-run list slots that would never be filled because the file is not written.
  // The paths follow the files to org/ (ADR-0010). The matrix rows that name them
  // still say docs/, and moving those rows is the estate's to do, so the refusal
  // above is what stands between a repaired parse and a stale second copy.
  const HAND_WRITTEN = ["org/VENTURE_BRIEF.md", "org/EOS_FEEDBACK.md"];
  if (HAND_WRITTEN.includes(row.path) && existsSync(join(OUT, row.path))) {
    report.push({ path: row.path, action: "kept", note: "written by hand at Session 0" });
    continue;
  }

  const raw = readFileSync(tpl, "utf-8");
  const { text: prunedText, pruned } = prune(raw, SCALE);
  const { out, filled } = fill(prunedText, VALUES);
  const left = slotsIn(out);
  if (left.length) unfilled += left.length;

  const final = rewriteFrontMatter(out, row.template);
  const dest = join(OUT, row.path);

  if (!CHECK) {
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, final);
  }
  report.push({
    path: row.path,
    action: existsSync(dest) ? "compiled" : "compiled (new)",
    fills: filled,
    pruned,
    unfilled: left,
  });
}

// Empty directories the matrix lists for M.
const EMPTY_DIRS = ["org/decisions", "org/logs"];
for (const d of EMPTY_DIRS) {
  const p = join(OUT, d);
  if (!CHECK) mkdirSync(p, { recursive: true });
  report.push({ path: d + "/", action: "directory", note: "created empty per the matrix" });
}

console.log(`eos-compile: scale ${SCALE}, ${matrix.length} files in the matrix\n`);
for (const r of report) {
  const bits = [r.action];
  if (r.fills !== undefined) bits.push(`${r.fills} fills`);
  if (r.unfilled?.length) bits.push(`UNFILLED: ${r.unfilled.join(", ")}`);
  if (r.note) bits.push(r.note);
  console.log(`  ${r.path.padEnd(34)} ${bits.join(" · ")}`);
}
console.log(
  `\n${missingTemplates} missing template(s), ${unfilled} unfilled slot(s).` +
    (CHECK ? " (--check: nothing written)" : ""),
);
if (missingTemplates || unfilled) process.exitCode = 1;
