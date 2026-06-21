// ═══════════════════════════════════════════════════════════════
// composer-smoke.mjs — end-to-end smoke for Composer + Deep Research against a
// running PatterStage + a Hermes API Server (the mock OR a real local Hermes).
//
// Cross-platform (pure Node, global fetch) — run it the same way on Linux,
// macOS, and Windows. It drives the REAL HTTP surface:
//   Composer:      start a workflow run → walk the auto stages (reconcile) →
//                  stop at the first HIL gate → approve → assert it advances.
//   Deep Research: start a query → poll to a completed, cited report.
//
// This is a MANUAL runner (not wired into CI) — point it at whatever stack you
// want to validate. Exits non-zero on any failed assertion.
//
// Env: PS_URL (default http://127.0.0.1:3000), API_SERVER_KEY (optional).
// Tip: run the PatterStage server with PS_SEARCH_PROVIDER=none for a fully
// offline Deep Research smoke (no live web search).
// ═══════════════════════════════════════════════════════════════

const PS = process.env.PS_URL || process.env.CH_URL || "http://127.0.0.1:3000";

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

async function pollUntil(fn, { tries = 120, delayMs = 1000 } = {}) {
  for (let i = 0; i < tries; i++) {
    const value = await fn();
    if (value) return value;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

async function main() {
  console.log(`\nPatterStage: ${PS}\n`);

  // ── 0. PatterStage is up ──────────────────────────────────
  console.log("0. Health");
  const health = await pollUntil(async () => {
    try {
      const r = await req("GET", `${PS}/api/status`);
      return r.status === 200 ? r : null;
    } catch {
      return null;
    }
  }, { tries: 30, delayMs: 1000 });
  check(Boolean(health), "PatterStage /api/status reachable");
  if (!health) return finish();

  // ── 1. Composer: dispatch → HIL gate → approve → advance ──
  console.log("1. Composer workflow (graph orchestrator)");
  const wfRes = await req("GET", `${PS}/api/composer/workflows`);
  if (wfRes.status === 503) {
    ok("Composer is disabled (PS_COMPOSER=0) — skipping Composer section");
  } else {
    const workflows = wfRes.data?.data?.workflows ?? [];
    check(wfRes.status === 200 && workflows.length >= 1, `composer workflows listed (${workflows.length})`);
    const wf = workflows.find((w) => w.key === "software-delivery-v1") ?? workflows[0];

    if (wf) {
      const startRun = await req("POST", `${PS}/api/composer/runs`, {
        workflowId: wf.id,
        input: "Add a dark-mode toggle to the settings page, persisted per user.",
      });
      const runId = startRun.data?.data?.run?.id;
      check(startRun.status === 201 && Boolean(runId), `composer run started (${runId ?? "none"})`);

      if (runId) {
        // Walk the auto stages (reconcile drives finalize→advance); stop at the
        // first HIL gate or a terminal state.
        const gated = await pollUntil(async () => {
          await req("POST", `${PS}/api/runs/reconcile`);
          const r = await req("GET", `${PS}/api/composer/runs/${runId}`);
          const run = r.data?.data?.run;
          if (!run) return null;
          return ["awaiting_approval", "completed", "failed"].includes(run.status) ? r.data.data : null;
        });

        check(gated?.run?.status === "awaiting_approval", `run reached a HIL gate (status=${gated?.run?.status})`);
        const passed = (gated?.nodeRuns ?? []).filter((nr) => nr.verdict?.pass === true);
        check(passed.length >= 1, `assessing stage(s) passed on a PASS verdict (${passed.length})`);

        const gateNodeId = gated?.run?.currentNodeId;
        if (gated?.run?.status === "awaiting_approval" && gateNodeId) {
          const approve = await req(
            "POST",
            `${PS}/api/composer/runs/${runId}/nodes/${gateNodeId}/approve`,
            { action: "accept" },
          );
          check(approve.status === 200, "HIL gate accepted");

          const advanced = await pollUntil(async () => {
            await req("POST", `${PS}/api/runs/reconcile`);
            const r = await req("GET", `${PS}/api/composer/runs/${runId}`);
            const run = r.data?.data?.run;
            if (!run) return null;
            // Past the gate = a different current node, or the run finished.
            return run.currentNodeId !== gateNodeId || run.status === "completed" ? run : null;
          }, { tries: 60, delayMs: 1000 });
          check(Boolean(advanced), `workflow advanced past the gate (status=${advanced?.status})`);
        }
      }
    }
  }

  // ── 2. Deep Research: query → cited report ────────────────
  console.log("2. Deep Research (native iterative research)");
  const startR = await req("POST", `${PS}/api/laboratory/research`, {
    query: "What are the tradeoffs of SQLite vs Postgres for a self-hosted app?",
  });
  const rRunId = startR.data?.data?.run?.id;
  check(startR.status === 201 && Boolean(rRunId), `research run started (${rRunId ?? "none"})`);
  if (rRunId) {
    const done = await pollUntil(async () => {
      const r = await req("GET", `${PS}/api/laboratory/research/${rRunId}`);
      const run = r.data?.data?.run;
      return run && ["completed", "failed"].includes(run.status) ? r.data.data : null;
    });
    check(done?.run?.status === "completed", `research run completed (status=${done?.run?.status})`);
    if (done?.run?.status === "completed") {
      check(typeof done?.run?.report === "string" && done.run.report.length > 0, "research produced a report");
      check(Array.isArray(done?.steps) && done.steps.length >= 1, `research recorded steps (${done?.steps?.length ?? 0})`);
    } else if (done?.run?.error) {
      console.error(`    research error: ${done.run.error}`);
    }
  }

  finish();
}

function finish() {
  console.log("");
  if (failures === 0) {
    console.log("COMPOSER SMOKE PASSED ✅");
    process.exit(0);
  } else {
    console.error(`COMPOSER SMOKE FAILED ❌ (${failures} assertion(s))`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("COMPOSER SMOKE ERROR:", err);
  process.exit(1);
});
