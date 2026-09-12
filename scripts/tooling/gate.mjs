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

import { execSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, mkdirSync, openSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { killByPort } from "./_platform.mjs";

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

const PORTS = [3000, 3477, 3577, 3939, 8642];

/**
 * The gate's verdict, kept separate from running it so it can be tested: red if
 * any step failed, and red too if the tree moved underneath, because a result
 * measured on a tree nobody committed describes nothing.
 */
export function verdict(results, treeMoved) {
  const red = results.filter((r) => r.code !== 0).map((r) => r.step);
  return { red, ok: red.length === 0 && !treeMoved };
}

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1] ?? null;
};

function stamp() {
  const run = (cmd) => execSync(cmd, { cwd: ROOT, maxBuffer: 512 * 1024 * 1024 }).toString();
  return createHash("sha256")
    .update(run("git rev-parse HEAD") + run("git status --porcelain") + run("git diff") + run("git diff --cached"))
    .digest("hex");
}

function freePorts() {
  for (const port of PORTS) {
    try {
      killByPort(port);
    } catch {
      // A port nothing holds is the normal case, and killByPort says so its own way.
    }
  }
  try {
    execSync("node -e \"require('node:fs').rmSync('.next/dev',{recursive:true,force:true})\"", { cwd: ROOT });
  } catch {
    // .next/dev is a cache; its absence is the desired state either way.
  }
}

function runStep(step, logDir) {
  const log = join(logDir, `${step.name}.log`);
  const fd = openSync(log, "w");
  const started = Date.now();
  const result = spawnSync(step.command, { cwd: ROOT, shell: true, stdio: ["ignore", fd, fd] });
  closeSync(fd);
  return { step: step.name, code: result.status ?? 1, seconds: Math.round((Date.now() - started) / 100) / 10, log };
}

function main() {
  if (args.includes("--list")) {
    for (const [i, s] of STEPS.entries()) console.log(`${i + 1}. ${s.command}  — ${s.why}`);
    return 0;
  }

  const logDir = flag("--log") ?? join(ROOT, ".gate");
  mkdirSync(logDir, { recursive: true });

  const alone = flag("--rerun-alone");
  if (alone) {
    // A spec that fails only under the full run's load is re-run on its own, and
    // both results go on the record. This is the second half of that.
    const command = `npx cross-env PORT=3000 playwright test ${alone}`;
    const result = runStep({ name: "rerun-alone", command }, logDir);
    console.log(`gate: ${alone} alone exit ${result.code} in ${result.seconds}s -> ${result.log}`);
    return result.code;
  }

  const only = flag("--only")?.split(",").map((s) => s.trim());
  const from = flag("--from");
  let started = !from;
  const planned = STEPS.filter((s) => {
    if (from && s.name === from) started = true;
    if (!started) return false;
    return !only || only.includes(s.name);
  });

  const before = stamp();
  freePorts();

  const results = [];
  for (const step of planned) {
    const result = runStep(step, logDir);
    results.push(result);
    console.log(`gate: ${result.step} exit ${result.code} in ${result.seconds}s -> ${result.log}`);
    if (result.code !== 0) {
      console.log(`gate: stopping at ${result.step}. Read the log, fix the thing, run the gate again.`);
      break;
    }
  }

  const moved = stamp() !== before;
  const { red, ok } = verdict(results, moved);

  writeFileSync(
    join(logDir, "summary.json"),
    JSON.stringify({ steps: results, red, treeMoved: moved, planned: planned.map((s) => s.name) }, null, 2),
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
