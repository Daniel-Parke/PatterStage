// scripts/tooling/mutation-sweep.mjs — does the batch's oracle actually hold?
//
//   npm run sweep -- tests/fixtures/mutants/T-0147.json
//   npm run sweep -- tests/fixtures/mutants/T-0147.json --only m2
//
// A green gate says the tests passed. It does not say the tests would have
// failed had the code been wrong. This breaks the code on purpose, one anchored
// edit at a time, and requires the named tests to go red.
//
// Four outcomes, and the last two are the ones a hand-run sweep used to hide:
//
//   KILLED       the mutant applied and the named tests failed. What we want.
//   SURVIVED     the mutant applied and the tests still passed. The oracle has a
//                hole; write the test it asks for as its own commit, then re-run.
//   NOT-APPLIED  the anchor was not found, or was found more than once, so the
//                mutant proved nothing. Reporting that as killed is a lie.
//   INEFFECTIVE  the anchor sits only in a comment (pass `force` when that is
//                the point), or the replacement equals the anchor.
//
// It refuses a dirty tree, because it restores files with `git checkout --` and
// would otherwise throw away uncommitted work. That has happened here: a
// sharpened oracle was left uncommitted, the restore put the old source back
// underneath it, and the mutant reported killed for the wrong reason. Commit the
// oracle first, then sweep the committed tree.

import { execFileSync, execSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

/**
 * Every line the anchor sits on is a comment, so the code is untouched by it.
 *
 * `#` opens a comment in shell and Python and a HEADING in markdown, where it is
 * content. The first sweep run here reported INEFFECTIVE for a register heading
 * that was exactly the thing under test, so the hash form counts only outside
 * markdown.
 */
export function anchorIsCommentOnly(source, anchor, file = "") {
  const markdown = /\.mdx?$/i.test(file);
  const isComment = markdown ? /^\s*(\/\/|\/\*|\*)/ : /^\s*(\/\/|\/\*|\*|#)/;
  const lines = source.split("\n").filter((line) => line.includes(anchor));
  return lines.length > 0 && lines.every((line) => isComment.test(line));
}

export function occurrences(haystack, needle) {
  let count = 0;
  let at = haystack.indexOf(needle);
  while (at !== -1) {
    count += 1;
    at = haystack.indexOf(needle, at + needle.length);
  }
  return count;
}

/**
 * Everything the sweep can decide before running a test, so the decision is
 * testable without a git tree. null means "apply it and see"; anything else is
 * the outcome already.
 */
export function classifyMutant(source, mutant) {
  const hits = occurrences(source, mutant.anchor);
  if (hits !== 1) {
    return { outcome: "NOT-APPLIED", note: hits === 0 ? "anchor not found" : `anchor found ${hits} times` };
  }
  if (mutant.replacement === mutant.anchor) {
    return { outcome: "INEFFECTIVE", note: "replacement equals anchor" };
  }
  if (!mutant.force && anchorIsCommentOnly(source, mutant.anchor, mutant.file ?? "")) {
    return { outcome: "INEFFECTIVE", note: "anchor sits only in a comment; pass force if that is the point" };
  }
  return null;
}

function treeIsDirty() {
  return execSync("git status --porcelain", { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString().trim() !== "";
}

function runTests(tests) {
  const result = spawnSync(`npx jest ${tests.join(" ")} --silent`, { cwd: ROOT, shell: true, stdio: "pipe" });
  return result.status ?? 1;
}

export function sweep(manifestPath, onlyId) {
  const manifest = JSON.parse(readFileSync(join(ROOT, manifestPath), "utf-8"));
  const mutants = manifest.mutants.filter((m) => !onlyId || m.id === onlyId);

  if (treeIsDirty()) {
    console.error("mutation-sweep: the tree is dirty. Commit or stash first; this restores files with `git checkout --` and would take uncommitted work with it.");
    return 2;
  }

  const at = execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim();
  console.log(`mutation-sweep: ${manifest.task}, ${mutants.length} mutant(s), against ${at}`);

  const rows = [];
  for (const mutant of mutants) {
    const source = readFileSync(join(ROOT, mutant.file), "utf-8");
    const early = classifyMutant(source, mutant);
    if (early) {
      rows.push({ id: mutant.id, ...early, why: mutant.why });
      continue;
    }

    writeFileSync(join(ROOT, mutant.file), source.replace(mutant.anchor, mutant.replacement), "utf-8");
    let code;
    try {
      code = runTests(mutant.tests);
    } finally {
      execFileSync("git", ["checkout", "--", mutant.file], { cwd: ROOT });
    }
    rows.push({
      id: mutant.id,
      outcome: code === 0 ? "SURVIVED" : "KILLED",
      note: `${mutant.tests.join(" ")} exited ${code}`,
      why: mutant.why,
    });
  }

  for (const row of rows) console.log(`  ${row.outcome.padEnd(11)} ${row.id}  (${row.note})  ${row.why ?? ""}`);

  if (treeIsDirty()) {
    console.error("mutation-sweep: the tree is dirty AFTER the sweep, so a restore failed. Read `git status` before committing anything.");
    return 2;
  }

  const bad = rows.filter((r) => r.outcome !== "KILLED");
  console.log(`mutation-sweep: ${rows.length - bad.length} killed, ${bad.length} not (${bad.map((b) => `${b.id} ${b.outcome}`).join("; ") || "none"})`);
  return bad.length > 0 ? 1 : 0;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const manifestPath = args.find((a) => !a.startsWith("--"));
  const onlyAt = args.indexOf("--only");
  const onlyId = onlyAt === -1 ? null : args[onlyAt + 1];

  if (!manifestPath) {
    console.error("mutation-sweep: name a mutants file, e.g. tests/fixtures/mutants/T-0147.json");
    process.exitCode = 2;
  } else {
    process.exitCode = sweep(manifestPath, onlyId);
  }
}
