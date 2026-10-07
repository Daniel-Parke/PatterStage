// Reproduce the identities and source anchors of the September review.
// The ledger carries current verdicts separately: this extractor cannot
// establish that a historical finding still holds on today's tree.

import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const INDEX = "org/reviews/2026-09-codebase-review.md";
const EVIDENCE = "org/reviews/2026-09-codebase-review-evidence.md";
const REGISTER = "org/reviews/2026-09-decision-register.md";
const LEDGER = "org/reviews/2026-09-evidence-ledger.jsonl";
const read = (path) => readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");

function lines(path) {
  return read(path).split("\n");
}

function matching(linesToScan, pattern) {
  const matches = [];
  for (const [index, line] of linesToScan.entries()) {
    const result = pattern.exec(line);
    if (result) matches.push({ line: index + 1, text: line, captures: result.slice(1) });
  }
  return matches;
}

function originalGaps(evidenceLines) {
  const gaps = [];
  let dimension = "";
  let inList = false;
  for (const [index, line] of evidenceLines.entries()) {
    const heading = /^## Dimension: (.+)$/.exec(line);
    if (heading) dimension = heading[1];
    if (line === "### Not examined") {
      inList = true;
      continue;
    }
    if (/^#{1,3} /.test(line)) inList = false;
    if (inList && line.startsWith("- ")) {
      gaps.push({ line: index + 1, text: line.slice(2), dimension });
    }
  }
  return gaps;
}

function decisionLocation(id, registerHeadings, freeBand) {
  const headings = registerHeadings.filter((heading) => {
    const candidate = heading.captures[0];
    return candidate === id || new RegExp(`^${id}[a-h]$`).test(candidate);
  });
  const free = freeBand.filter((row) =>
    row.captures[0] === id || new RegExp(`^${id}[a-h]$`).test(row.captures[0]),
  );
  return {
    ...(headings.length ? { decisionRecord: `${REGISTER}:${headings.map((row) => row.line).join(",")}` } : {}),
    ...(free.length ? { freeBandReason: `${REGISTER}:${free.map((row) => row.line).join(",")}` } : {}),
    operatorDispositions: [
      ...headings.map((row) => ({ id: row.captures[0], kind: "ruled", record: `${REGISTER}:${row.line}` })),
      ...free.map((row) => ({ id: row.captures[0], kind: "free-band", record: `${REGISTER}:${row.line}` })),
    ],
  };
}

export function sourceInventory() {
  const indexLines = lines(INDEX);
  const evidenceLines = lines(EVIDENCE);
  const registerLines = lines(REGISTER);
  const indexed = matching(indexLines, /^- `([a-z-]+-\d+)`(.*)$/);
  const refuted = matching(evidenceLines, /^- \*\*([a-z-]+-\d+) ·/);
  const headings = matching(evidenceLines, /^#### ([a-z-]+-\d+) ·/);
  const registerHeadings = matching(registerLines, /^#### ([a-z-]+-\d+[a-h]?) ·/);
  const freeBandStart = registerLines.findIndex((line) => line.startsWith("## Decisions the executor takes"));
  if (freeBandStart < 0) throw new Error("executor-decision section not found");
  const freeBand = matching(registerLines.slice(freeBandStart + 1), /^- \*\*([a-z-]+-\d+[a-h]?)\*\*/).map(
    (row) => ({ ...row, line: row.line + freeBandStart + 1 }),
  );
  const evidenceById = new Map(headings.map((row) => [row.captures[0], row.line]));
  if (indexed.length !== 257 || refuted.length !== 8 || headings.length !== 257) {
    throw new Error(`source populations changed: ${indexed.length} surviving, ${refuted.length} refuted, ${headings.length} evidence headings`);
  }
  const findings = indexed.map((row) => {
    const id = row.captures[0];
    const evidenceLine = evidenceById.get(id);
    if (!evidenceLine) throw new Error(`${id} has no evidence heading`);
    const operatorDecision = row.text.includes("**OP**");
    return {
      kind: "finding",
      id,
      source: { file: INDEX, line: row.line },
      evidence: `${EVIDENCE}:${evidenceLine}`,
      historicalVerdict: "survived",
      currentVerdict: "unverified",
      status: "pending-current-review",
      operatorDecision,
      ...(operatorDecision ? decisionLocation(id, registerHeadings, freeBand) : {}),
      owningTask: null,
      netEstimate: null,
    };
  });
  findings.push(...refuted.map((row) => ({
    kind: "finding",
    id: row.captures[0],
    source: { file: EVIDENCE, line: row.line },
    evidence: `${EVIDENCE}:${row.line}`,
    historicalVerdict: "refuted",
    currentVerdict: "not-reproposed",
    status: "ruled-out",
    operatorDecision: false,
    owningTask: null,
    netEstimate: null,
  })));
  const gaps = originalGaps(evidenceLines).map((gap, index) => ({
    kind: "gap",
    id: `gap-${String(index + 1).padStart(3, "0")}`,
    source: { file: EVIDENCE, line: gap.line },
    text: gap.text,
    dimension: gap.dimension,
    evidence: `${EVIDENCE}:${gap.line} (historical open question only)`,
    status: "pending-decomposition",
    atomicObligations: [],
    currentVerdict: "unverified",
    owningTask: "T-0164",
    netEstimate: null,
  }));
  if (gaps.length !== 107 || findings.filter((row) => row.operatorDecision).length !== 110) {
    throw new Error(`source populations changed: ${gaps.length} gaps, ${findings.filter((row) => row.operatorDecision).length} OP findings`);
  }
  const undecided = findings.filter((row) => row.operatorDecision && !row.decisionRecord && !row.freeBandReason);
  if (undecided.length) throw new Error(`OP findings without a decision location: ${undecided.map((row) => row.id).join(", ")}`);
  const dispositions = findings.filter((row) => row.operatorDecision).flatMap((row) => row.operatorDispositions);
  if (dispositions.length !== 163 || new Set(dispositions.map((row) => row.id)).size !== 163) {
    throw new Error(`expected 163 distinct OP dispositions, found ${dispositions.length} entries`);
  }
  return [...findings, ...gaps];
}

export function checkLedger(rows = sourceInventory()) {
  const expected = new Map(rows.map((row) => [row.id, row]));
  const actual = read(LEDGER).trim().split("\n").map((line) => JSON.parse(line));
  const failures = [];
  if (actual.length !== rows.length) failures.push(`expected ${rows.length} rows, found ${actual.length}`);
  for (const row of actual) {
    const source = expected.get(row.id);
    if (!source) {
      failures.push(`unknown id ${row.id}`);
      continue;
    }
    expected.delete(row.id);
    for (const key of ["kind", "source", "text", "operatorDecision", "operatorDispositions"]) {
      if (JSON.stringify(row[key]) !== JSON.stringify(source[key])) failures.push(`${row.id}: ${key} disagrees with the review`);
    }
    if (!row.status || !row.evidence || !row.currentVerdict) failures.push(`${row.id}: missing disposition or evidence`);
    if (row.kind === "finding" && row.operatorDecision && !row.decisionRecord && !row.freeBandReason) {
      failures.push(`${row.id}: no operator disposition`);
    }
    if (row.kind === "gap" && !Array.isArray(row.atomicObligations)) failures.push(`${row.id}: no atomic-obligation field`);
    if (["done", "deferred", "ruled-out"].includes(row.status) && row.historicalVerdict !== "refuted" && !row.currentEvidence) {
      failures.push(`${row.id}: final disposition lacks current evidence and reason`);
    }
  }
  for (const id of expected.keys()) failures.push(`missing ${id}`);
  const register = read(REGISTER);
  if (/\*\*Ruling:\*\* _pending_/.test(register)) failures.push("decision register still has a pending ruling");
  const addendum = read("org/reviews/2026-09-refactor-addendum.md");
  if (!addendum.includes("Q-025 | **Select and Picker remain separate**") ||
      !addendum.includes("This supersedes the contrary")) {
    failures.push("Q-025's Select/Picker correction is missing or contradicts the older components-02 detail");
  }
  return failures;
}

const direct = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (direct) {
  try {
    const rows = sourceInventory();
    if (process.argv.includes("--write")) {
      const output = join(ROOT, LEDGER);
      const temporary = `${output}.tmp`;
      writeFileSync(temporary, rows.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");
      renameSync(temporary, output);
      console.log(`review ledger: wrote ${rows.length} source-linked rows`);
    } else if (process.argv.includes("--report")) {
      const dispositions = rows.filter((row) => row.operatorDecision).flatMap((row) => row.operatorDispositions);
      console.log(`review ledger: ${rows.filter((row) => row.kind === "finding").length} findings, ${dispositions.length} OP dispositions, ${rows.filter((row) => row.kind === "gap").length} historical coverage bullets`);
    } else {
      const failures = checkLedger(rows);
      if (failures.length) {
        for (const failure of failures) console.error(`review ledger: ${failure}`);
        process.exitCode = 1;
      } else {
        console.log(`review ledger: all ${rows.length} source identities and dispositions accounted for`);
      }
    }
  } catch (error) {
    console.error(`review ledger: ${error.message}`);
    process.exitCode = 1;
  }
}
