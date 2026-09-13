// Live proof of the benchmark fixes against the bench-gateway stack.
// 1) the new suites are registered, 2) a brain-only COMPARE (both runs are
// targetKind:"agent" — the exact scenario the old UI couldn't classify) now
// yields a findable agent AND baseline with summaries.
const CH = process.env.CH_URL || "http://127.0.0.1:42070";
let fails = 0;
const check = (c, m, x) => { if (c) console.log("  ✓", m); else { fails++; console.error("  ✗", m, x !== undefined ? JSON.stringify(x).slice(0, 220) : ""); } };
async function req(method, url, body) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  let d; try { d = await r.json(); } catch { d = null; }
  return { status: r.status, data: d };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollUntil(fn, { tries = 120, delay = 2000 } = {}) { for (let i = 0; i < tries; i++) { const v = await fn(); if (v) return v; await sleep(delay); } return null; }

async function main() {
  console.log(`\nBaseline-fix verify @ ${CH}\n`);
  const up = await pollUntil(async () => { try { const r = await fetch(`${CH}/api/benchmarks/suites`); return r.status === 200 ? r : null; } catch { return null; } }, { tries: 90, delay: 2000 });
  check(Boolean(up), "PatterStage up");
  if (!up) return finish();

  const suites = (await req("GET", `${CH}/api/benchmarks/suites`)).data?.data?.suites ?? [];
  check(suites.length >= 4, `suites registered (${suites.map((s) => s.key).join(", ")})`);
  check(suites.some((s) => s.key === "applied-capabilities"), "B2: applied-capabilities suite present");
  check(suites.some((s) => s.key === "judgement"), "B3: judgement (LLM-judge) suite present");

  const det = suites.filter((s) => s.key !== "judgement").sort((a, b) => a.itemCount - b.itemCount)[0];
  console.log(`\nA1 baseline fix — brain-only compare on '${det.key}' (both runs are targetKind:agent):`);
  const start = await req("POST", `${CH}/api/benchmarks/runs`, { suiteKey: det.key, mode: "compare", agentProfile: "default", augmentation: { skills: false, tools: false, memory: false }, repeats: 1 });
  const pairId = start.data?.data?.pairId;
  check(start.status === 201 && Boolean(pairId), `compare started (pair ${pairId ?? "none"})`, start.data);
  if (!pairId) return finish();

  const done = await pollUntil(async () => {
    const runs = (await req("GET", `${CH}/api/benchmarks/runs?pairId=${pairId}`)).data?.data?.runs ?? [];
    return runs.length >= 2 && runs.every((r) => r.status !== "pending" && r.status !== "running") ? runs : null;
  }, { tries: 150, delay: 2000 });
  check(Boolean(done), "both pair runs reached a terminal state");
  if (!done) return finish();

  const agent = done.find((r) => r.config?.pairRole === "agent");
  const baseline = done.find((r) => r.config?.pairRole === "baseline");
  check(Boolean(agent), "agent run carries pairRole=agent");
  check(Boolean(baseline), "baseline run carries pairRole=baseline (THE FIX — was unfindable, showed '—')");
  check(Boolean(baseline?.summary), `baseline computed a summary (rating=${baseline?.summary?.overallRating}, status=${baseline?.status})`);
  check(Boolean(agent?.summary), `agent computed a summary (rating=${agent?.summary?.overallRating}, status=${agent?.status})`);
  check(agent && baseline && agent.id !== baseline.id, "agent and baseline are distinct runs");
  finish();
}
function finish() { console.log(""); if (fails === 0) { console.log("BASELINE-FIX VERIFY PASSED ✅"); process.exit(0); } else { console.error(`FAILED ❌ (${fails})`); process.exit(1); } }
main().catch((e) => { console.error("ERR", e); process.exit(1); });
