#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// restart-recovery.mjs — the regression test this codebase did not have
//
// A fourth QA pass recommended a test for "restart under load", and it was the
// strongest recommendation in the report. It cannot be a Playwright spec:
// Playwright runs against an ALREADY-STARTED server and has no way to kill and
// re-start the process under it. Process control is what this test is about, so
// it lives beside the other runtime smokes and uses the same primitives
// tests/scripts/boot-smoke.mjs does — detachedSpawn + killPid from
// scripts/tooling/_platform.mjs (T-0072).
//
// ── WHAT IS ACTUALLY BEING TESTED ──────────────────────────────
//
// Not dispatch. BOOT RECOVERY: the three sweeps that run when a PatterStage
// process starts and finds work its predecessor left mid-flight.
//
//   BackgroundScheduler  → reconcileRunsOnBoot()      runs with no backend id
//   instrumentation      → failStuckResearchRuns()    research left 'running'
//   instrumentation      → failStuckChatMessages()    turns left 'streaming'
//
// Each exists because a crash leaves a row that nothing else will ever move: a
// fire-and-forget job has no in-process resume, so without these the Deep
// Research page spins forever and a chat bubble stays mid-reply for the life of
// the database.
//
// ── WHY THE IN-FLIGHT STATE IS SEEDED, AND WHY THAT IS HONEST ──
//
// The rows are written directly rather than produced by a real agent run. What
// is under test is what happens to a row a crash left behind, and seeding the
// exact state a crash leaves is a faithful reproduction that does not need a
// live Hermes, a gateway, or a model. The KILL is real: the server is spawned
// detached and terminated with killPid({tree:true}) — not a graceful shutdown —
// so the second process genuinely inherits an uncleaned database.
//
// ── THE TWO NON-OBVIOUS FACTS THIS ENCODES ─────────────────────
//
// 1. BOTH SWEEPS HAVE A 30-MINUTE CUTOFF. failStuckResearchRuns(maxMinutes=30)
//    and failStuckChatMessages(maxMinutes=30) are called at boot with their
//    defaults, so a row created a second before the crash is deliberately NOT
//    swept — the next boot might be a fast restart of a job still legitimately
//    in flight. The seeds are backdated for that reason, and a naive version of
//    this test would have passed for the wrong reason or failed for one.
//
// 2. A RUN THAT REACHED THE BACKEND IS LEFT ALONE. reconcileRunsOnBoot only
//    fails runs with NO backend runId; one that was submitted is left for the
//    live reconcile tick, because the backend may still be executing it and
//    failing it here would report a running job as dead. That is the control
//    below, and it is the assertion most likely to catch a well-meant widening.
//
// ── PROVED TO GO RED ───────────────────────────────────────────
//
// Five mutations, five caught. Worth recording one of them: removing
// reconcileRunsOnBoot ENTIRELY still leaves the run `failed`, because the live
// reconcile tick reaches it too -- with a different message ("run was never
// submitted to the backend" rather than "PatterStage restarted before the run
// was submitted"). So the status assertion alone would have passed on a build
// with the boot sweep deleted, and it is the REASON assertions that carry the
// weight. Two sweeps agreeing on an outcome and disagreeing on the explanation
// is exactly the kind of thing a status-only test cannot see.
//
// The others: deleting either instrumentation sweep leaves its row untouched;
// widening reconcileRunsOnBoot to fail every active run trips the control; and
// dropping the isPidAlive check from claimOwnership leaves the lease with the
// killed pid.
//
// Env: none required. Uses a throwaway HERMES_HOME under the OS temp dir and a
// port of its own. Exits non-zero on any failed assertion.
// ═══════════════════════════════════════════════════════════════

import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { detachedSpawn, isPidAlive, killPid } from "../../../scripts/tooling/_platform.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const PORT = Number(process.env.RESTART_SMOKE_PORT || 3993);
const BASE = `http://127.0.0.1:${PORT}`;
const HOME = mkdtempSync(join(tmpdir(), "ps-restart-"));
const DB_PATH = join(HOME, "patterstage.db");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function check(name, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || detail === undefined ? "" : `  (${detail})`}`);
  if (!ok) failures += 1;
}

/** An ISO timestamp `minutes` in the past — both boot sweeps ignore anything newer than 30. */
const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();

function startServer() {
  return detachedSpawn(
    process.execPath,
    [join(REPO, "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(PORT)],
    {
      cwd: REPO,
      env: {
        ...process.env,
        HERMES_HOME: HOME,
        PS_DATA_DIR: HOME,
        PS_AUTH_MODE: "none",
        PS_SEARCH_PROVIDER: "none",
        // Pin the gateway at a port nothing can be listening on.
        //
        // WITHOUT THIS THE HARNESS IS MACHINE-DEPENDENT, and it failed exactly
        // that way on a reviewer's box. The default gateway is 8642 -- the
        // mock's own port -- and this file inherits `process.env`, so a
        // developer running mock-hermes (or a real Hermes) gets a live answer
        // for the seeded `backend-abc`: `404 run not found`. reconcile treats a
        // 404 as authoritative, and the CONTROL below then fails on the first
        // tick, taking the mission-result assertion with it. A dead port yields
        // ECONNREFUSED, which is deadline-gated, which is the branch the
        // control's comment has always described.
        HERMES_GATEWAY_URL: "http://127.0.0.1:9",
      },
    },
  );
}

async function waitForHealth(tries = 120) {
  for (let i = 0; i < tries; i += 1) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return true;
    } catch {
      /* not up yet */
    }
    await sleep(1000);
  }
  return false;
}

/** Poll until `read()` satisfies `done`, or give up. Boot sweeps are not instant. */
async function until(read, done, tries = 30, delayMs = 500) {
  let last;
  for (let i = 0; i < tries; i += 1) {
    last = read();
    if (done(last)) return last;
    await sleep(delayMs);
  }
  return last;
}

const open = (readonly = false) => new Database(DB_PATH, { readonly });
const one = (sql, ...args) => {
  const db = open(true);
  try {
    return db.prepare(sql).get(...args);
  } finally {
    db.close();
  }
};

async function main() {
  console.log(`restart-recovery on ${process.platform} (node ${process.version})`);
  console.log(`  HERMES_HOME ${HOME}`);

  // ── First boot: create the schema and a mission to hang runs off ──
  let pid = startServer();
  check("first server started", typeof pid === "number" && pid > 0);
  if (!(await waitForHealth())) {
    check("first server became healthy", false, "never answered /api/health");
    return;
  }
  check("first server became healthy", true);

  const created = await fetch(`${BASE}/api/missions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "dispatch",
      name: "restart-recovery",
      instruction: "a mission whose run will be interrupted",
      dispatchMode: "save",
    }),
  });
  const missionId = (await created.json())?.data?.mission?.id;
  check("mission created over HTTP", typeof missionId === "string", `status ${created.status}`);

  // ── Seed four things mid-flight, as a crash would leave them ──
  // `seededAt` is hoisted so the CONTROL below can prove the row was not
  // written, rather than merely that it still reads `started`.
  const seededAt = new Date().toISOString();
  {
    const db = open();
    const now = seededAt;

    // 1. A run that never reached the backend. reconcileRunsOnBoot's subject.
    db.prepare(
      "INSERT INTO runs (id, run_id, mission_id, status, submitted_at, updated_at) VALUES (?,NULL,?,'started',?,?)",
    ).run("run-unsubmitted", missionId, now, now);

    // 2. CONTROL: a run that DID reach the backend. Must survive the restart —
    //    the backend may still be executing it.
    db.prepare(
      "INSERT INTO runs (id, run_id, mission_id, status, submitted_at, updated_at) VALUES (?,?,?,'started',?,?)",
    ).run("run-submitted", "backend-abc", missionId, now, now);

    db.prepare("UPDATE missions SET status='dispatched' WHERE id=?").run(missionId);

    // 3. A research run left 'running'. Backdated past the 30-minute cutoff.
    db.prepare(
      "INSERT INTO research_runs (id, query, status, created_at) VALUES (?,?,'running',?)",
    ).run("res-stuck", "what happens on restart", minutesAgo(45));

    // 4. A chat turn left mid-stream, likewise backdated.
    db.prepare("INSERT INTO chat_conversations (id, title) VALUES ('conv-1','Interrupted')").run();
    db.prepare(
      "INSERT INTO chat_messages (id, conversation_id, role, content, status, created_at, updated_at) " +
        "VALUES (?, 'conv-1', 'assistant', 'half a rep', 'streaming', ?, ?)",
    ).run("msg-stuck", minutesAgo(45), minutesAgo(45));

    db.close();
  }
  check("four in-flight rows seeded", one("SELECT count(*) c FROM runs").c === 2);

  // ── The crash. Not a graceful shutdown. ──
  killPid(pid, { tree: true });
  await sleep(1500);
  check("server is gone after killPid", !isPidAlive(pid));

  // ── Second boot: the recovery sweeps run ──
  pid = startServer();
  if (!(await waitForHealth())) {
    check("second server became healthy", false, "never answered /api/health");
    return;
  }
  check("second server became healthy", true);

  // 1. The unsubmitted run is failed, and says why.
  const run1 = await until(
    () => one("SELECT status, error FROM runs WHERE id='run-unsubmitted'"),
    (r) => r?.status === "failed",
  );
  check("an unsubmitted run is failed on boot", run1?.status === "failed", `status ${run1?.status}`);
  check(
    "…and the reason names the restart, not a generic failure",
    /restart/i.test(run1?.error ?? ""),
    run1?.error,
  );

  // …and the mission it belongs to is finalised with it, or the board shows a
  // mission running forever behind a run that ended.
  const mission = one("SELECT status, result FROM missions WHERE id=?", missionId);
  check("…and its mission is finalised too", mission?.status === "failed", `status ${mission?.status}`);
  check("…with the interruption as the result", /interrupt/i.test(mission?.result ?? ""), mission?.result);

  // 2. CONTROL: the submitted run is untouched — by ANY writer.
  //
  // Asserting only `status === 'started'` was too weak, and this file's own
  // header says why: two writers can agree on a status and disagree about the
  // explanation. Every writer that touches a run here signs its work in
  // `error` ("PatterStage restarted before the run was submitted", "backend no
  // longer has this run (404)", "backend unreachable past the run deadline"),
  // and any writer at all moves `updated_at`. So the control asserts the row
  // was NOT WRITTEN, rather than that it happens to still read `started`.
  const run2 = one("SELECT status, error, updated_at FROM runs WHERE id='run-submitted'");
  check(
    "CONTROL: a run that reached the backend is NOT failed on boot",
    run2?.status === "started",
    `status ${run2?.status} — boot recovery must not report a job the backend may still be running as dead`,
  );
  check(
    "…and no writer touched it at all",
    run2?.error === null && run2?.updated_at === seededAt,
    `error ${JSON.stringify(run2?.error)}, updated_at ${run2?.updated_at} vs seeded ${seededAt}`,
  );

  // 3. The stuck research run is failed.
  const res = await until(
    () => one("SELECT status, error FROM research_runs WHERE id='res-stuck'"),
    (r) => r?.status === "failed",
  );
  check("a research run left running is failed on boot", res?.status === "failed", `status ${res?.status}`);
  check(
    "…and says it was interrupted rather than that it finished",
    /interrupt|maximum runtime/i.test(res?.error ?? ""),
    res?.error,
  );

  // 4. The stuck chat turn is failed.
  const msg = await until(
    () => one("SELECT status, error FROM chat_messages WHERE id='msg-stuck'"),
    (m) => m?.status === "failed",
  );
  check("a chat turn left streaming is failed on boot", msg?.status === "failed", `status ${msg?.status}`);
  check(
    "…and the bubble explains itself to the reader",
    /interrupted|did not finish/i.test(msg?.error ?? ""),
    msg?.error,
  );

  // 5. The scheduler lease is taken over rather than deferred to a dead pid.
  //    After a hard kill the heartbeat row still names the OLD process. A new
  //    process that respected it would never dispatch a schedule again, and the
  //    only signal an operator gets is the pill that compares these two fields
  //    (T-0071).
  const monitor = await (await fetch(`${BASE}/api/monitor`)).json();
  const scheduler = monitor?.data?.scheduler;
  check("the new process reports its own pid", scheduler?.selfPid === pid, `selfPid ${scheduler?.selfPid} vs pid ${pid}`);
  check(
    "…and owns the scheduler lease rather than deferring to the killed one",
    scheduler?.ownerPid === pid,
    `ownerPid ${scheduler?.ownerPid} — a lease still held by the dead process means schedules never fire`,
  );

  killPid(pid, { tree: true });
  await sleep(1000);
}

try {
  await main();
} catch (err) {
  check("harness ran to completion", false, String(err?.stack ?? err));
} finally {
  try {
    rmSync(HOME, { recursive: true, force: true });
  } catch {
    /* the OS can have it */
  }
}

console.log(failures === 0 ? "\nrestart-recovery: OK" : `\nrestart-recovery: ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
