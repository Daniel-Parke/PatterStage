// Explicit closing check. The baseline is the first commit that added the
// measure contract, never the current working copy or a rolling census.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const measurePath = "org/plans/2026-09-refactor-measures.json";
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).trim();
const node = (path, ...args) => execFileSync(process.execPath, [join(root, path), ...args], {
  cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
});

export function evaluate(rows, current) {
  return rows.map((row) => {
    const final = current[row.key];
    if (!Number.isInteger(final)) throw new Error(`missing current count for ${row.key}`);
    return {
      key: row.key, baseline: row.baseline, target: row.target,
      final, delta: final - row.baseline, passed: final <= row.target,
    };
  });
}

export function auditDispositions(expected, actual) {
  const counts = {};
  for (const group of ["findings", "operatorDispositions", "coverage"]) {
    const wanted = expected[group];
    const rows = actual[group];
    if (!Array.isArray(wanted) || !Array.isArray(rows)) throw new Error(`${group} disposition list missing`);
    const expectedIds = [...wanted].sort();
    const actualIds = rows.map((row) => row.id).sort();
    const missing = expectedIds.filter((id) => !actualIds.includes(id));
    const extra = actualIds.filter((id) => !expectedIds.includes(id));
    if (missing.length || extra.length || new Set(actualIds).size !== actualIds.length) {
      throw new Error(`${group} missing ${missing.join(",") || "none"}; extra or duplicate ${extra.join(",") || "none"}`);
    }
    for (const row of rows) {
      if (!["done", "ruled-out", "deferred"].includes(row.status)) throw new Error(`${group} ${row.id}: invalid final status`);
      if (typeof row.reason !== "string" || row.reason.trim().length < 12) throw new Error(`${group} ${row.id}: missing reason`);
      if (typeof row.evidence !== "string" || row.evidence.trim().length < 5) throw new Error(`${group} ${row.id}: missing evidence`);
      if (typeof row.owner !== "string" || row.owner.trim() === "") throw new Error(`${group} ${row.id}: missing owner`);
    }
    counts[group] = rows.length;
  }
  return counts;
}

const jsonLines = (content) => content.trim().split("\n").map((line) => JSON.parse(line));

function main() {
  if (process.argv.length !== 2) throw new Error("closing oracle accepts no selectors or baseline overrides");
  if (git("status", "--porcelain") !== "") throw new Error("closing oracle requires a clean tree");
  const firstAdditions = git("log", "--diff-filter=A", "--format=%H", "--", measurePath).split("\n").filter(Boolean);
  if (firstAdditions.length !== 1) throw new Error(`expected one committed baseline creation, found ${firstAdditions.length}`);
  const baselineCommit = firstAdditions[0];
  const measures = JSON.parse(git("show", `${baselineCommit}:${measurePath}`));
  const line = JSON.parse(node("scripts/tooling/line-census.mjs", "--report"));
  const scope = JSON.parse(node("org/reviews/2026-09-t0164-scope-census.mjs", "HEAD"));
  const current = Object.fromEntries(measures.rows.map((row) => [row.key,
    row.scope === "line" ? line.counts[row.key] : scope.scopes[row.key]?.lines]));
  const results = evaluate(measures.rows, current);
  console.log(`refactor closing baseline commit ${baselineCommit}; final revision ${git("rev-parse", "HEAD")}`);
  for (const row of results) {
    console.log(`${row.passed ? "PASS" : "MISS"} ${row.key}: baseline ${row.baseline}, target <= ${row.target}, final ${row.final}, delta ${row.delta >= 0 ? "+" : ""}${row.delta}`);
  }
  console.log("Historical original five commitments remain in the measure file and require separate closing commentary.");
  let dispositionsValid = false;
  try {
    const findingRows = jsonLines(git("show", "HEAD:org/reviews/2026-09-t0164-findings.jsonl"));
    const coverageRows = jsonLines(git("show", "HEAD:org/reviews/2026-09-t0164-coverage.jsonl"));
    const expected = {
      findings: findingRows.map((row) => row.id),
      operatorDispositions: findingRows.flatMap((row) => (row.operatorDispositions ?? []).map((item) => item.id)),
      coverage: coverageRows.map((row) => row.id),
    };
    const final = JSON.parse(git("show", "HEAD:org/plans/2026-09-refactor-final-dispositions.json"));
    const counts = auditDispositions(expected, final);
    console.log(`PASS final dispositions: ${counts.findings} findings, ${counts.operatorDispositions} split decisions, ${counts.coverage} atomic proofs`);
    dispositionsValid = true;
  } catch (error) {
    console.error(`MISS final dispositions: ${error.message}`);
  }
  if (results.some((row) => !row.passed) || !dispositionsValid) {
    console.error("Every MISS needs its own measured number and written reason in the plan closing section.");
    return 1;
  }
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try { process.exitCode = main(); }
  catch (error) { console.error(`refactor-closing-oracle: ${error.message}`); process.exitCode = 2; }
}
