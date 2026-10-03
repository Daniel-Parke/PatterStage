#!/usr/bin/env node
// Knip's widened test/harness scan has exact, release-gated findings. Compare
// every reported issue with its committed reason so a new issue cannot hide
// behind a global count, a broad ignore glob or a stale exception.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const BASELINE = join(ROOT, "scripts", "tooling", "knip-baseline.json");
const KNIP = join(ROOT, "node_modules", "knip", "bin", "knip.js");
const ARGUMENTS = [
  "--include", "files,dependencies,unlisted,unresolved,exports,types,duplicates,binaries",
  "--no-config-hints", "--reporter", "json", "--no-exit-code",
];

function key(kind, file, name) {
  return `${kind}\t${file}\t${name}`;
}

/** Return exact issue identities; line numbers move when unrelated text does. */
export function issueKeys(report) {
  if (!report || !Array.isArray(report.issues)) throw new Error("Knip did not return an issues array");
  const found = new Set();
  for (const row of report.issues) {
    if (!row || typeof row.file !== "string" || !row.file) throw new Error("Knip returned an issue without a file");
    for (const [kind, entries] of Object.entries(row)) {
      if (kind === "file" || kind === "owners") continue;
      if (!Array.isArray(entries)) throw new Error(`Knip returned a non-array ${kind} issue list`);
      for (const entry of entries) {
        if (!entry || typeof entry.name !== "string" || !entry.name) throw new Error(`Knip returned an unnamed ${kind} issue`);
        const identity = key(kind, row.file, entry.name);
        if (found.has(identity)) throw new Error(`Knip returned duplicate ${identity}`);
        found.add(identity);
      }
    }
  }
  return found;
}

export function compareKnipIssues(report, baseline) {
  if (!baseline || !Array.isArray(baseline.issues)) throw new Error("Knip baseline has no issues array");
  const actual = issueKeys(report);
  const allowed = new Set();
  for (const entry of baseline.issues) {
    if (!entry || !["kind", "file", "name", "reason"].every((field) => typeof entry[field] === "string" && entry[field].trim())) {
      throw new Error("Knip baseline has an incomplete entry");
    }
    if (entry.reason.trim().length < 12) throw new Error("Knip baseline reason is too short");
    const identity = key(entry.kind, entry.file, entry.name);
    if (allowed.has(identity)) throw new Error(`Knip baseline duplicates ${identity}`);
    allowed.add(identity);
  }
  return {
    newIssues: [...actual].filter((identity) => !allowed.has(identity)).sort(),
    resolvedIssues: [...allowed].filter((identity) => !actual.has(identity)).sort(),
    total: actual.size,
  };
}

function main() {
  const run = spawnSync(process.execPath, [KNIP, ...ARGUMENTS], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (run.error || run.status !== 0) {
    throw new Error(`Knip did not complete: ${run.error?.message ?? `exit ${run.status}`}\n${run.stderr ?? ""}`);
  }
  const report = JSON.parse(run.stdout);
  const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
  const result = compareKnipIssues(report, baseline);
  for (const identity of result.newIssues) console.error(`knip-ratchet: new ${identity}`);
  for (const identity of result.resolvedIssues) console.error(`knip-ratchet: resolved; reduce the committed baseline: ${identity}`);
  if (result.newIssues.length || result.resolvedIssues.length) return 1;
  console.log(`knip-ratchet: ${result.total} exact, reasoned findings; no new or stale issue`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`knip-ratchet: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
