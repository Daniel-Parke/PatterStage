// ═══════════════════════════════════════════════════════════════
// bench-gateway-e2e.mjs — proves the benchmark gateway manager (BD1) works
// in-app, against the combined CH+Hermes image (docker-compose.bench-gateway).
//
// Unlike the brain-only smoke, this drives an AGENTIC run with augmentation ON,
// which makes PatterStage spawn a dedicated `hermes gateway` for the ephemeral
// fair-test profile and route the run there. We assert:
//   1. the run records exec_mode = agentic,
//   2. it completes (the spawned gateway actually served it),
//   3. summary.togglesApplied = true (a dedicated gateway WAS spawned — not the
//      shared-default fallback), and
//   4. no __bench_* profile is left behind (teardown ran).
//
// Env: CH_URL (default http://127.0.0.1:42070).
// ═══════════════════════════════════════════════════════════════

const CH = process.env.CH_URL || "http://127.0.0.1:42070";

let failures = 0;
function check(cond, msg, extra) {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures += 1;
    console.error(`  ✗ ${msg}${extra !== undefined ? ` — ${JSON.stringify(extra).slice(0, 240)}` : ""}`);
  }
}

async function req(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

async function pollUntil(fn, { tries = 240, delayMs = 1000 } = {}) {
  for (let i = 0; i < tries; i++) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

async function main() {
  console.log(`\nBench-gateway e2e @ ${CH}\n`);

  // Wait for CH to be serving.
  const up = await pollUntil(async () => {
    try {
      const r = await fetch(`${CH}/api/benchmarks/suites`);
      return r.status === 200 ? r : null;
    } catch {
      return null;
    }
  }, { tries: 90, delayMs: 2000 });
  check(Boolean(up), "PatterStage is up and serving the benchmarks API");
  if (!up) return finish();

  const suitesRes = await req("GET", `${CH}/api/benchmarks/suites`);
  const suites = suitesRes.data?.data?.suites ?? [];
  check(suites.length >= 1, `benchmark suites listed (${suites.length})`);
  // Smallest suite keeps the agentic run (one Hermes run per item) quick.
  const suite = [...suites].sort((a, b) => (a.itemCount ?? 99) - (b.itemCount ?? 99))[0];

  const profilesRes = await req("GET", `${CH}/api/agent/profiles`);
  const benchProfile = profilesRes.data?.data?.profiles?.[0]?.id;
  check(Boolean(benchProfile), `agent profile available (${benchProfile ?? "none"})`);
  if (!suite || !benchProfile) return finish();

  // Agentic: at least one augmentation layer ON forces the agentic path, which
  // assembles an ephemeral __bench_ profile AND spawns its own gateway.
  console.log(`Starting agentic run: suite=${suite.key} profile=${benchProfile}`);
  const start = await req("POST", `${CH}/api/benchmarks/runs`, {
    suiteKey: suite.key,
    mode: "single",
    targetKind: "agent",
    targetRef: benchProfile,
    augmentation: { skills: true, tools: false, memory: false },
    repeats: 1,
  });
  const runId = start.data?.data?.run?.id;
  check(start.status === 201 && Boolean(runId), `agentic run started (${runId ?? "none"})`, start.data);
  check(start.data?.data?.run?.execMode === "agentic", `run records exec_mode=agentic`, start.data?.data?.run?.execMode);
  if (!runId) return finish();

  const done = await pollUntil(async () => {
    const r = await req("GET", `${CH}/api/benchmarks/runs/${runId}`);
    const st = r.data?.data?.run?.status;
    return st && st !== "pending" && st !== "running" ? r.data.data : null;
  }, { tries: 240, delayMs: 2000 });

  check(done?.run?.status === "completed", `agentic run completed (status=${done?.run?.status})`, done?.run?.error);
  // THE proof: a dedicated gateway was spawned + routed to (not the fallback).
  check(done?.run?.summary?.togglesApplied === true, `dedicated bench gateway spawned (togglesApplied)`, done?.run?.summary?.togglesApplied);
  check((done?.run?.summary?.itemsRun ?? 0) >= 1, `items ran through the spawned gateway (${done?.run?.summary?.itemsRun ?? 0})`);

  // Teardown: no ephemeral __bench_ profile should remain.
  const after = await req("GET", `${CH}/api/agent/profiles`);
  const leftovers = (after.data?.data?.profiles ?? []).filter((p) => String(p.id).startsWith("__bench_"));
  check(leftovers.length === 0, `ephemeral bench profile torn down (${leftovers.length} leftover)`, leftovers.map((p) => p.id));

  finish();
}

function finish() {
  console.log("");
  if (failures === 0) {
    console.log("BENCH-GATEWAY E2E PASSED ✅");
    process.exit(0);
  } else {
    console.error(`BENCH-GATEWAY E2E FAILED ❌ (${failures})`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("E2E ERROR:", err);
  process.exit(1);
});
