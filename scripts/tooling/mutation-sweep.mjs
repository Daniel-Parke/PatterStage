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

import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, lstatSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
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

function treeIsDirty(root) {
  return execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: root, maxBuffer: 64 * 1024 * 1024 }).toString().trim() !== "";
}

function localPath(root, path) {
  if (typeof path !== "string" || !path || isAbsolute(path)) throw new Error("mutation-sweep: path must be relative to the repository");
  const full = resolve(root, path);
  const back = relative(root, full);
  if (!back || back === ".." || back.startsWith(`..${sep}`)) throw new Error("mutation-sweep: path escapes the repository");
  const physicalRoot = realpathSync(root);
  const physicalExpected = resolve(physicalRoot, path);
  const normalise = (value) => process.platform === "win32" ? value.toLowerCase() : value;
  if (lstatSync(full).isSymbolicLink() || normalise(realpathSync(full)) !== normalise(physicalExpected)) throw new Error("mutation-sweep: symlinked path is not a safe mutation target");
  return full;
}

export function selectMutants(manifest, onlyId = null) {
  if (!manifest || !Array.isArray(manifest.mutants)) throw new Error("mutation-sweep: manifest has no mutants array");
  const ids = new Set();
  for (const mutant of manifest.mutants) {
    if (!mutant || typeof mutant.id !== "string" || !mutant.id || ids.has(mutant.id) || typeof mutant.file !== "string" || typeof mutant.anchor !== "string" || !mutant.anchor || typeof mutant.replacement !== "string" || !Array.isArray(mutant.tests) || mutant.tests.length === 0 || mutant.tests.some((test) => typeof test !== "string" || !test)) {
      throw new Error("mutation-sweep: invalid mutant entry");
    }
    ids.add(mutant.id);
  }
  const selected = manifest.mutants.filter((mutant) => onlyId == null || mutant.id === onlyId);
  if (selected.length === 0) throw new Error("mutation-sweep: selected no mutants");
  return selected;
}

/** Only an executed, failing Jest assertion can count as a kill. */
export function assessJestRun(run, expected) {
  const report = run?.report;
  if (run?.launchError || !report || !Number.isInteger(report.numTotalTests) || report.numTotalTests < 1 || !Array.isArray(report.testResults)) return "infrastructure";
  const names = new Set(expected.map((name) => name.replaceAll("\\", "/").toLowerCase()));
  const found = report.testResults.filter((suite) => names.has(String(suite.name).replaceAll("\\", "/").toLowerCase()));
  if (found.length !== names.size || found.some((suite) => !Array.isArray(suite.assertionResults) || suite.assertionResults.length === 0 || suite.testExecError)) return "infrastructure";
  const assertions = found.flatMap((suite) => suite.assertionResults);
  const failed = assertions.filter((test) => test.status === "failed" && Array.isArray(test.failureDetails) && Array.isArray(test.failureMessages) && test.failureDetails.some((detail) => {
    const matcher = detail?.matcherResult;
    if (typeof matcher?.message !== "string" || !matcher.message || typeof matcher.pass !== "boolean") return false;
    const clean = (value) => value.replace(/\x1b\[[0-9;]*m/g, "");
    const message = clean(matcher.message);
    const invocation = /^expect\([^\n]*\)\.(not\.)?([A-Za-z]\w*)\(/.exec(message.split("\n", 1)[0]);
    if (!invocation || matcher.pass !== Boolean(invocation[1]) || (matcher.name != null && matcher.name !== invocation[2])) return false;
    const prefix = `Error: ${message}`;
    const frame = new RegExp(`(?:^|\\n)\\s+at (?:Object\\.)?${invocation[2]} \\(`);
    return test.failureMessages.some((message) => typeof message === "string" && clean(message).startsWith(prefix) && frame.test(clean(message).slice(prefix.length)));
  }));
  if (run.status === 0 && report.numFailedTests === 0 && assertions.every((test) => test.status === "passed")) return "passed";
  if (Number.isInteger(run.status) && run.status > 0 && failed.length > 0 && report.numFailedTests > 0) return "assertion-failed";
  return "infrastructure";
}

function runTestsAtRoot(root, tests) {
  const temp = mkdtempSync(join(tmpdir(), "patterstage-sweep-"));
  const output = join(temp, "jest.json");
  try {
    const result = spawnSync(process.execPath, [join(root, "node_modules", "jest", "bin", "jest.js"), "--runTestsByPath", ...tests, "--runInBand", "--json", "--outputFile", output, "--silent"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    let report;
    try { report = JSON.parse(readFileSync(output, "utf8")); } catch { /* launch and configuration errors need no fake report */ }
    return { status: result.status, report, ...(result.error ? { launchError: result.error.message } : {}) };
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function runControl(root, tests, runner) {
  try {
    return assessJestRun(runner(tests), tests.map((test) => localPath(root, test)));
  } catch {
    return "infrastructure";
  }
}

function runMutant(root, mutant, runner) {
  const file = localPath(root, mutant.file);
  const original = readFileSync(file);
  const mode = lstatSync(file).mode & 0o777;
  let result;
  let restored = false;
  try {
    writeFileSync(file, original.toString("utf8").replace(mutant.anchor, mutant.replacement));
    result = runner(mutant.tests);
  } catch (error) {
    result = { status: null, launchError: error.message };
  } finally {
    writeFileSync(file, original);
    chmodSync(file, mode);
    restored = readFileSync(file).equals(original) && (lstatSync(file).mode & 0o777) === mode;
  }
  if (!restored) return { outcome: "ERROR", note: "file restoration failed" };
  const assessment = assessJestRun(result, mutant.tests.map((test) => localPath(root, test)));
  return { outcome: assessment === "assertion-failed" ? "KILLED" : assessment === "passed" ? "SURVIVED" : "ERROR", note: assessment };
}

export function sweepAtRoot(root, manifestPath, onlyId = null, runner = (tests) => runTestsAtRoot(root, tests)) {
  try {
    if (treeIsDirty(root)) throw new Error("tree is dirty; commit before the sweep");
    const manifest = JSON.parse(readFileSync(localPath(root, manifestPath), "utf8"));
    const mutants = selectMutants(manifest, onlyId);
    for (const mutant of mutants) {
      localPath(root, mutant.file);
      for (const test of mutant.tests) localPath(root, test);
    }
    const controls = [...new Set(mutants.flatMap((mutant) => mutant.tests))];
    if (runControl(root, controls, runner) !== "passed") throw new Error("unmodified control did not pass");
    const at = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    console.log(`mutation-sweep: ${manifest.task}, ${mutants.length} mutant(s), against ${at}`);
    const rows = [];
    let finalControl;
    try {
      for (const mutant of mutants) {
        const source = readFileSync(localPath(root, mutant.file), "utf8");
        const early = classifyMutant(source, mutant);
        rows.push({ id: mutant.id, why: mutant.why, ...(early ?? runMutant(root, mutant, runner)) });
      }
    } finally {
      finalControl = runControl(root, controls, runner);
    }
    for (const row of rows) console.log(`  ${row.outcome.padEnd(11)} ${row.id}  (${row.note})  ${row.why ?? ""}`);
    if (treeIsDirty(root)) throw new Error("tree changed after restoration");
    if (finalControl !== "passed") throw new Error("restored control did not pass");
    const bad = rows.filter((row) => row.outcome !== "KILLED");
    console.log(`mutation-sweep: ${rows.length - bad.length} killed, ${bad.length} not (${bad.map((row) => `${row.id} ${row.outcome}`).join("; ") || "none"})`);
    return bad.some((row) => row.outcome === "ERROR") ? 2 : bad.length ? 1 : 0;
  } catch (error) {
    console.error(`mutation-sweep: ${error.message}`);
    return 2;
  }
}

export function sweep(manifestPath, onlyId) {
  return sweepAtRoot(ROOT, manifestPath, onlyId);
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  const args = process.argv.slice(2);
  if (args.length === 1 && !args[0].startsWith("--")) process.exitCode = sweep(args[0], null);
  else if (args.length === 3 && args[1] === "--only" && args[2]) process.exitCode = sweep(args[0], args[2]);
  else {
    console.error("mutation-sweep: name a mutants file, optionally followed by --only <id>");
    process.exitCode = 2;
  }
}
