// scripts/tooling/gate.mjs — the whole gate, by exit code, in one command.
//
//   npm run gate                     the nine steps, in order, stopping at the first red
//   npm run gate -- --only lint,tsc  a subset, by step name
//   npm run gate -- --from build     skip ahead, for a re-run after a fix
//   npm run gate -- --rerun-alone e2e/composer.spec.ts   one spec, on its own
//   npm run gate -- --list           the step list, which is also what the docs quote
//
// Why this exists. The gate was a list in a handover note, retyped by hand
// every batch, and three written copies of it disagreed (CONTRIBUTING.md's
// seven commands, the PR template's six, HANDOVER's nine). Worse, a gate read
// by eye is a gate that can be reported green while a step is red: that is
// exactly what happened for six days across about fifty task records, because
// nothing read an exit code and nothing read CI at all.
//
// So: one ordered list, each step to its own log, the exit code recorded, and
// the tree stamped before and after. A gate whose tree moved underneath it did
// not measure the tree that gets committed, and says so.
//
// This runner does NOT read CI. The gate runs before the commit exists; the
// pushed commit's CI is the step after it, in the landing procedure.

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, lstatSync, mkdirSync, openSync, readFileSync, readlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

/**
 * The gate, in order. Everything that reads this list — the docs, the PR
 * template, a batch record — quotes it from here rather than restating it.
 */
export const STEPS = [
  { name: "lint", command: "npm run lint", why: "the twelve checks, from agent files to eslint" },
  { name: "tsc", command: "npx tsc --noEmit", why: "the app's own program" },
  { name: "jest", command: "npm run test:coverage", why: "the unit corpus with the coverage floors CI enforces" },
  { name: "knip", command: "npm run lint:knip", why: "files, exports and dependencies nothing reaches" },
  { name: "canary", command: "npm run canary:check", why: "the output surfaces that must not move unnoticed" },
  { name: "build", command: "npm run build", why: "the production build" },
  { name: "e2e", command: "npm run test:e2e", why: "Playwright, both projects" },
  { name: "census", command: "npm run census", why: "the design census against its baseline" },
  { name: "census-lines", command: "npm run census:lines", why: "the line census, shrink-only" },
];

/**
 * The gate's verdict, kept separate from running it so it can be tested: red if
 * any step failed, and red too if the tree moved underneath, because a result
 * measured on a tree nobody committed describes nothing.
 */
export function verdict(results, treeMoved) {
  const red = results.filter((r) => r.code !== 0).map((r) => r.step);
  return { red, ok: red.length === 0 && !treeMoved };
}

function git(root, args) {
  return execFileSync("git", args, { cwd: root, maxBuffer: 512 * 1024 * 1024 });
}

/** Stamp the actual files, including content hidden behind an unchanged untracked status line. */
export function stampTree(root = ROOT) {
  const tracked = git(root, ["ls-files", "-z", "--stage"]).toString("utf8").split("\0").filter(Boolean);
  const untracked = git(root, ["ls-files", "-z", "--others", "--exclude-standard"]).toString("utf8").split("\0").filter(Boolean);
  const entries = [];
  for (const row of tracked) {
    const match = /^(\d+) ([0-9a-f]+) (\d)\t([\s\S]+)$/.exec(row);
    if (!match || match[3] !== "0") throw new Error(`gate: unresolved Git index entry: ${row}`);
    entries.push({ path: match[4], indexMode: match[1], indexObject: match[2] });
  }
  for (const path of untracked) entries.push({ path, indexMode: "untracked" });
  entries.sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));

  const hash = createHash("sha256");
  const field = (value) => {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
    hash.update(String(bytes.length));
    hash.update(":");
    hash.update(bytes);
  };
  field(git(root, ["rev-parse", "HEAD"]));
  for (const entry of entries) {
    field(entry.path);
    field(entry.indexMode);
    field(entry.indexObject ?? "untracked");
    let stat;
    try {
      stat = lstatSync(join(root, entry.path));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      field("missing");
      continue;
    }
    field(stat.isSymbolicLink() ? "link" : stat.isFile() ? "file" : "other");
    field(stat.mode & 0o777);
    if (stat.isSymbolicLink()) field(readlinkSync(join(root, entry.path)));
    else if (stat.isFile()) field(readFileSync(join(root, entry.path)));
  }
  return hash.digest("hex");
}

export function parseGateArgs(args) {
  const values = new Map();
  const valid = new Set(["--only", "--from", "--log", "--rerun-alone", "--list"]);
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i];
    if (!valid.has(key) || values.has(key)) throw new Error(`unknown or repeated gate option: ${key}`);
    if (key === "--list") values.set(key, true);
    else {
      const value = args[++i];
      if (!value || value.startsWith("--")) throw new Error(`missing value for ${key}`);
      values.set(key, value);
    }
  }
  if (values.has("--list")) {
    if (values.size !== 1) throw new Error("--list cannot be combined with a run selector");
    return { kind: "list", planned: [], evidenceFile: "" };
  }
  if (values.has("--rerun-alone")) {
    if (values.has("--only") || values.has("--from")) throw new Error("--rerun-alone cannot be combined with step selectors");
    const spec = values.get("--rerun-alone");
    if (!/^tests\/e2e\/[\w./-]+\.spec\.ts$/.test(spec) || spec.includes("..")) throw new Error("--rerun-alone requires a tests/e2e/*.spec.ts path");
    return { kind: "rerun", planned: [{ name: "rerun-alone", spec }], evidenceFile: "summary.rerun.json", logBase: values.get("--log") };
  }
  const all = STEPS.map((step) => step.name);
  let only = null;
  if (values.has("--only")) {
    only = values.get("--only").split(",").map((s) => s.trim());
    if (only.some((name) => !name || !all.includes(name))) throw new Error("--only contains an unknown or empty step");
  }
  const from = values.get("--from");
  if (from && !all.includes(from)) throw new Error(`unknown --from step: ${from}`);
  const planned = STEPS.filter((step) => (!from || all.indexOf(step.name) >= all.indexOf(from)) && (!only || only.includes(step.name)));
  if (planned.length === 0) throw new Error("gate selection is empty");
  const kind = values.has("--only") || values.has("--from") ? "partial" : "full";
  return { kind, planned, evidenceFile: kind === "full" ? "summary.json" : "summary.partial.json", logBase: values.get("--log") };
}

function runStep(step, logDir) {
  const log = join(logDir, `${step.name}.log`);
  const fd = openSync(log, "w");
  const started = Date.now();
  const result = step.spec
    ? spawnSync(process.execPath, [join(ROOT, "node_modules", "@playwright", "test", "cli.js"), "test", step.spec], { cwd: ROOT, stdio: ["ignore", fd, fd], env: { ...process.env, PORT: "3000", PS_GATE_OWN_SERVER: "1" } })
    : spawnSync(step.command, { cwd: ROOT, shell: true, stdio: ["ignore", fd, fd], env: step.name === "e2e" ? { ...process.env, PS_GATE_OWN_SERVER: "1" } : process.env });
  closeSync(fd);
  return { step: step.name, code: result.status ?? 1, seconds: Math.round((Date.now() - started) / 100) / 10, log, ...(result.error ? { launchError: result.error.message } : {}) };
}

function main() {
  let plan;
  try {
    plan = parseGateArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`gate: ${error.message}`);
    return 2;
  }
  if (plan.kind === "list") {
    for (const [i, s] of STEPS.entries()) console.log(`${i + 1}. ${s.command}  — ${s.why}`);
    return 0;
  }
  const base = plan.logBase ?? join(ROOT, ".gate");
  const logDir = plan.kind === "full" ? base : join(base, plan.kind);
  mkdirSync(logDir, { recursive: true });
  const before = stampTree();

  const results = [];
  for (const step of plan.planned) {
    const result = runStep(step, logDir);
    results.push(result);
    console.log(`gate: ${result.step} exit ${result.code} in ${result.seconds}s -> ${result.log}`);
    if (result.code !== 0) {
      console.log(`gate: stopping at ${result.step}. Read the log, fix the thing, run the gate again.`);
      break;
    }
  }

  const after = stampTree();
  const moved = after !== before;
  const { red, ok } = verdict(results, moved);

  writeFileSync(
    join(logDir, plan.evidenceFile),
    JSON.stringify({ kind: plan.kind, steps: results, red, treeMoved: moved, treeBefore: before, treeAfter: after, planned: plan.planned.map((s) => s.name), complete: plan.kind === "full" && results.length === STEPS.length && ok }, null, 2),
  );

  if (moved) console.log("gate: the tree moved while the gate ran, so this result describes no finished tree. Run it again on a still tree.");
  const line = results.map((r) => `${r.step} ${r.code}`).join(", ");
  console.log(`gate: ${line}`);
  return ok ? 0 : 1;
}

// Importing this module must not run the gate: the oracle reads STEPS and
// verdict() from here.
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) process.exitCode = main();
