// ═══════════════════════════════════════════════════════════════
// full-stack-smoke.mjs — end-to-end test of the new orchestration core
// against a running Control Hub + mock Hermes API Server.
//
// Drives the REAL HTTP surface: create mission → dispatch (HTTP run) →
// reconcile → assert completion; schedule create + immediate run; cancel.
// Zero dependencies (global fetch). Exits non-zero on any failed assertion.
//
// Env: CH_URL (default http://127.0.0.1:41234), HERMES_URL
// (default http://127.0.0.1:8642), API_SERVER_KEY (optional bearer).
// ═══════════════════════════════════════════════════════════════

const CH = process.env.CH_URL || "http://127.0.0.1:41234";
const HERMES = process.env.HERMES_URL || "http://127.0.0.1:8642";

let failures = 0;
function ok(msg) {
  console.log(`  ✓ ${msg}`);
}
function check(cond, msg) {
  if (cond) ok(msg);
  else {
    failures += 1;
    console.error(`  ✗ ${msg}`);
  }
}

async function req(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function pollUntil(fn, { tries = 20, delayMs = 500 } = {}) {
  for (let i = 0; i < tries; i++) {
    const value = await fn();
    if (value) return value;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

async function main() {
  console.log(`\nControl Hub: ${CH}\nMock Hermes: ${HERMES}\n`);

  // ── 0. Both services are up ───────────────────────────────
  console.log("0. Health");
  const hermesHealth = await req("GET", `${HERMES}/health`);
  check(hermesHealth.status === 200 && hermesHealth.data.status === "ok", "mock Hermes /health ok");
  const chHealth = await pollUntil(async () => {
    try {
      const r = await req("GET", `${CH}/api/status`);
      return r.status === 200 ? r : null;
    } catch {
      return null;
    }
  });
  check(Boolean(chHealth), "Control Hub /api/status reachable");

  // ── 1. Gateway reachability through Control Hub ───────────
  console.log("1. Gateway wiring");
  const gw = await req("GET", `${CH}/api/gateway/health`);
  check(gw.status === 200, "Control Hub /api/gateway/health responds");

  // ── 2. Create a draft mission (no spawn) ──────────────────
  console.log("2. Create mission draft");
  const create = await req("POST", `${CH}/api/missions`, {
    action: "dispatch",
    dispatchMode: "save",
    name: "Runtime smoke mission",
    instruction: "Say hello from the mock agent.",
  });
  const missionId = create.data?.data?.mission?.id;
  check(create.status === 201 && Boolean(missionId), `mission created (${missionId ?? "none"})`);
  if (!missionId) return finish();

  // ── 3. Dispatch via the runtime (HTTP run) ────────────────
  console.log("3. Dispatch mission as a run");
  const dispatch = await req("POST", `${CH}/api/missions/${missionId}/dispatch`);
  const runId = dispatch.data?.data?.runId;
  const backendRunId = dispatch.data?.data?.backendRunId;
  check(dispatch.status === 200 && Boolean(runId), `dispatch returned runId (${runId ?? "none"})`);
  check(Boolean(backendRunId) && String(backendRunId).startsWith("run_"), "backend run_id assigned by mock Hermes");

  // ── 4. Reconcile until terminal ───────────────────────────
  console.log("4. Reconcile run to completion");
  const completed = await pollUntil(async () => {
    await req("POST", `${CH}/api/runs/reconcile`);
    const r = await req("GET", `${CH}/api/runs/${runId}`);
    const status = r.data?.data?.run?.status;
    return status && status !== "started" ? r.data.data.run : null;
  });
  check(Boolean(completed), "run reached a terminal state");
  check(completed?.status === "completed", `run completed (status=${completed?.status})`);
  // Backend-agnostic: works against the fast mock-hermes AND a real Hermes
  // (real output is the mock-LLM reply; usage may legitimately be 0).
  check(typeof completed?.output === "string" && completed.output.length > 0, "run output captured");
  check(
    completed?.usage != null && typeof completed.usage.totalTokens === "number",
    "usage tokens mapped",
  );

  // ── 5. Schedule create + immediate run ────────────────────
  console.log("5. Schedules");
  const sched = await req("POST", `${CH}/api/schedules`, {
    missionId,
    name: "smoke schedule",
    schedule: "every 30m",
  });
  const scheduleId = sched.data?.data?.schedule?.id;
  check(sched.status === 201 && Boolean(scheduleId), `schedule created (${scheduleId ?? "none"})`);
  check(Boolean(sched.data?.data?.schedule?.nextRunAt), "schedule has a computed next_run_at");

  if (scheduleId) {
    const runNow = await req("POST", `${CH}/api/schedules/${scheduleId}/run`);
    check(runNow.status === 200 && Boolean(runNow.data?.data?.runId), "schedule immediate-run dispatched");
    const delete_ = await req("DELETE", `${CH}/api/schedules/${scheduleId}`);
    check(delete_.status === 200, "schedule deleted");
  }

  // ── 6. Cancel a fresh run ─────────────────────────────────
  console.log("6. Cancel");
  const cancelMission = await req("POST", `${CH}/api/missions`, {
    action: "dispatch",
    dispatchMode: "save",
    name: "cancel target",
    instruction: "long task",
  });
  const cancelMissionId = cancelMission.data?.data?.mission?.id;
  if (cancelMissionId) {
    await req("POST", `${CH}/api/missions/${cancelMissionId}/dispatch`);
    const cancel = await req("POST", `${CH}/api/missions/${cancelMissionId}/cancel`);
    check(cancel.status === 200 && cancel.data?.data?.cancelled === true, "mission cancel accepted");
  }

  // ── 7. Legacy god-route now-dispatch routes through the runtime ──
  console.log("7. God-route dispatch uses the runtime engine");
  const nowDispatch = await req("POST", `${CH}/api/missions`, {
    action: "dispatch",
    name: "god-route now mission",
    instruction: "hello now",
  });
  const nowMission = nowDispatch.data?.data?.mission;
  check(
    nowDispatch.status === 201 && nowMission?.status === "dispatched",
    `god-route immediate dispatch set status=dispatched (got ${nowMission?.status})`,
  );

  finish();
}

function finish() {
  console.log("");
  if (failures === 0) {
    console.log("SMOKE PASSED ✅");
    process.exit(0);
  } else {
    console.error(`SMOKE FAILED ❌ (${failures} assertion(s))`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("SMOKE ERROR:", err);
  process.exit(1);
});
