// ═══════════════════════════════════════════════════════════════
// full-stack-smoke.mjs — end-to-end test of the new orchestration core
// against a running PatterStage + mock Hermes API Server.
//
// Drives the REAL HTTP surface: create mission → dispatch (HTTP run) →
// reconcile → assert completion; schedule create + immediate run; cancel.
// Zero dependencies (global fetch). Exits non-zero on any failed assertion.
//
// Env: PS_URL (default http://127.0.0.1:41234; CH_URL still honoured for
// back-compat), HERMES_URL (default http://127.0.0.1:8642), API_SERVER_KEY
// (optional bearer), PS_AUTH_TOKEN (PatterStage operator token — required
// unless the target runs with auth disabled; sent as a Bearer header).
// ═══════════════════════════════════════════════════════════════

const CH = process.env.PS_URL || process.env.CH_URL || "http://127.0.0.1:41234";
const HERMES = process.env.HERMES_URL || "http://127.0.0.1:8642";
const PS_TOKEN = process.env.PS_AUTH_TOKEN || "";

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
  // Only PatterStage gets the operator token — Hermes has its own key, and a
  // mismatched bearer must not leak across services.
  const headers = { "Content-Type": "application/json" };
  if (PS_TOKEN && url.startsWith(CH)) headers.Authorization = `Bearer ${PS_TOKEN}`;
  const res = await fetch(url, {
    method,
    headers,
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
  console.log(`\nPatterStage: ${CH}\nMock Hermes: ${HERMES}\n`);

  // ── 0. Both services are up ───────────────────────────────
  console.log("0. Health");
  const hermesHealth = await req("GET", `${HERMES}/health`);
  check(hermesHealth.status === 200 && hermesHealth.data.status === "ok", "mock Hermes /health ok");
  const chHealth = await pollUntil(async () => {
    try {
      const r = await req("GET", `${CH}/api/health`);
      return r.status === 200 ? r : null;
    } catch {
      return null;
    }
  });
  check(Boolean(chHealth), "PatterStage /api/health reachable");

  // ── 1. Gateway reachability through PatterStage ───────────
  console.log("1. Gateway wiring");
  const gw = await req("GET", `${CH}/api/gateway/health`);
  check(gw.status === 200, "PatterStage /api/gateway/health responds");

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

  // ── 8. Analytics pipeline + derived achievements (Phase Q3) ──
  // The actions above emit recordEvent() at the real action points; assert the
  // analytics_events log + /api/analytics + the derived achievements reflect
  // them — i.e. the whole pipeline works against the real Hermes runtime.
  console.log("8. Analytics events + achievements");
  const analytics = await req("GET", `${CH}/api/analytics`);
  const totals = analytics.data?.data?.analytics?.totals ?? {};
  check(analytics.status === 200, "/api/analytics responds");
  check((totals["mission.dispatched"] ?? 0) >= 1, `mission.dispatched recorded (${totals["mission.dispatched"] ?? 0})`);
  check((totals["mission.completed"] ?? 0) >= 1, `mission.completed recorded (${totals["mission.completed"] ?? 0})`);
  check((totals["session.started"] ?? 0) >= 1, `session.started recorded (${totals["session.started"] ?? 0})`);
  check((totals["schedule.created"] ?? 0) >= 1, `schedule.created recorded (${totals["schedule.created"] ?? 0})`);

  const ts = await req("GET", `${CH}/api/analytics/timeseries?type=mission.dispatched&days=7`);
  check(
    ts.status === 200 && Array.isArray(ts.data?.data?.timeseries) && ts.data.data.timeseries.length === 7,
    "timeseries returns a gap-filled 7-day series",
  );
  const badQuery = await req("GET", `${CH}/api/analytics/timeseries?days=9999`);
  check(badQuery.status === 400, "timeseries rejects an out-of-range days param (400)");

  const stats = await req("GET", `${CH}/api/stats`);
  const achievements = stats.data?.data?.stats?.achievements ?? [];
  const firstContact = achievements.find((a) => a.id === "first-contact");
  check(achievements.length >= 36, `expanded achievement catalogue present (${achievements.length})`);
  check(Boolean(firstContact?.unlocked), "first-contact achievement unlocked after a completed mission");

  // ── 9. Agent chat over the runtime (Phase S5) ─────────────
  // A chat conversation is mapped to a Hermes session; a user turn becomes a
  // real run. Drive the full surface: create → send → reconcile → load, and
  // assert the assistant turn finalizes (self-heals) from the run output.
  console.log("9. Agent chat over the runtime");
  const conv = await req("POST", `${CH}/api/chat`, { title: "Smoke chat" });
  const conversationId = conv.data?.data?.conversation?.id;
  check(conv.status === 201 && Boolean(conversationId), `chat conversation created (${conversationId ?? "none"})`);
  if (conversationId) {
    check(
      typeof conv.data?.data?.conversation?.sessionId === "string" && conv.data.data.conversation.sessionId.length > 0,
      "conversation mapped to a Hermes session",
    );
    const sendMsg = await req("POST", `${CH}/api/chat/${conversationId}/messages`, {
      content: "Hello agent",
      mode: "agent",
    });
    const chatRunId = sendMsg.data?.data?.runId;
    check(sendMsg.status === 200 && Boolean(chatRunId), `chat turn dispatched a run (${chatRunId ?? "none"})`);

    const chatDone = await pollUntil(async () => {
      await req("POST", `${CH}/api/runs/reconcile`);
      const r = await req("GET", `${CH}/api/runs/${chatRunId}`);
      const status = r.data?.data?.run?.status;
      return status && status !== "started" ? r.data.data.run : null;
    });
    check(chatDone?.status === "completed", `chat run completed (status=${chatDone?.status})`);

    // GET self-heals any still-streaming assistant turn from the run row.
    const loaded = await req("GET", `${CH}/api/chat/${conversationId}`);
    const msgs = loaded.data?.data?.messages ?? [];
    const userMsg = msgs.find((m) => m.role === "user");
    const assistantMsg = msgs.find((m) => m.role === "assistant");
    check(userMsg?.content === "Hello agent", "user message persisted");
    check(
      assistantMsg?.status === "complete" && typeof assistantMsg?.content === "string" && assistantMsg.content.length > 0,
      `assistant turn finalized from the run (status=${assistantMsg?.status})`,
    );

    const chatAnalytics = await req("GET", `${CH}/api/analytics`);
    const chatTotals = chatAnalytics.data?.data?.analytics?.totals ?? {};
    check((chatTotals["chat.message_sent"] ?? 0) >= 1, `chat.message_sent recorded (${chatTotals["chat.message_sent"] ?? 0})`);

    // The conversation must appear in the list, and delete must cascade.
    const list = await req("GET", `${CH}/api/chat`);
    check(
      Array.isArray(list.data?.data?.conversations) && list.data.data.conversations.some((c) => c.id === conversationId),
      "conversation appears in the list",
    );
    const del = await req("DELETE", `${CH}/api/chat/${conversationId}`);
    check(del.status === 200 && del.data?.data?.deleted === true, "conversation deleted");
  }

  // Section 10 (benchmark engine over the runtime) was deleted here on
  // 2026-08-22. Commit 4935ac31 removed the benchmark subsystem entirely on the
  // operator's ruling and amended ADR-0004 to say so, taking its 135 unit tests
  // with it, but missed this smoke: the job is push-only (ci.yml), so it never
  // ran on that pull request. /api/benchmarks/* now 404s, so these assertions
  // tested a surface that no longer exists by decision.

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
