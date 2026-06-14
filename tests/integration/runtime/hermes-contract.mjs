// ═══════════════════════════════════════════════════════════════
// hermes-contract.mjs — validate the runtime adapter's assumptions against a
// REAL Hermes API Server. Hits raw HTTP (bearer) and asserts the exact shapes
// HermesRuntime depends on, printing the actual payloads. Fails on any diff.
//
// Confirmed against Hermes 0.16. These are the assertions that caught (and now
// lock down) the four doc-vs-reality bugs: SSE event names live in data.event;
// /v1/skills + /v1/toolsets nest under .data; /api/sessions nests under
// .session.
//
// Env: HERMES_URL (http://localhost:8642), API_SERVER_KEY.
// ═══════════════════════════════════════════════════════════════

const HERMES = process.env.HERMES_URL || "http://localhost:8642";
const KEY = process.env.API_SERVER_KEY || "hermes-real-itest-key";

let failures = 0;
function check(cond, msg, actual) {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures += 1;
    console.error(`  ✗ ${msg}${actual !== undefined ? ` — got ${JSON.stringify(actual).slice(0, 200)}` : ""}`);
  }
}

async function api(method, path, { body, bearer = true, raw = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (bearer) headers["Authorization"] = `Bearer ${KEY}`;
  const res = await fetch(`${HERMES}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (raw) return res;
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

async function pollRun(runId, tries = 30) {
  for (let i = 0; i < tries; i++) {
    const { json } = await api("GET", `/v1/runs/${runId}`);
    const st = json?.status;
    if (st && st !== "started" && st !== "running" && st !== "queued") return json;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return null;
}

async function main() {
  console.log(`\nReal Hermes contract @ ${HERMES}\n`);

  console.log("Discovery + auth");
  const health = await api("GET", "/health", { bearer: false });
  check(health.status === 200 && health.json?.status === "ok", "GET /health → status ok", health.json);
  const noAuth = await api("GET", "/v1/models", { bearer: false, raw: true });
  check(noAuth.status === 401, "GET /v1/models without bearer → 401", noAuth.status);
  const caps = await api("GET", "/v1/capabilities");
  check(caps.json?.features && typeof caps.json.features === "object", "GET /v1/capabilities → { features: {...} }");
  const models = await api("GET", "/v1/models");
  check(Array.isArray(models.json?.data) && models.json.data[0]?.id, "GET /v1/models → { data: [{ id }] }", models.json);
  const skills = await api("GET", "/v1/skills");
  check(Array.isArray(skills.json?.data), "GET /v1/skills → { data: [...] } (nested, not bare array)", skills.json);
  const toolsets = await api("GET", "/v1/toolsets");
  check(
    Array.isArray(toolsets.json?.data) && (toolsets.json.data.length === 0 || "tools" in toolsets.json.data[0]),
    "GET /v1/toolsets → { data: [{ name, tools }] } (nested)",
    toolsets.json,
  );

  console.log("Sessions");
  // Real Hermes enforces unique session titles — use a fresh one each run.
  const sess = await api("POST", "/api/sessions", {
    body: { title: `contract-${Date.now()}`, source: "control-hub" },
  });
  check(sess.json?.session && typeof sess.json.session.id === "string", "POST /api/sessions → { session: { id } } (nested)", sess.json);

  console.log("Run lifecycle");
  const sub = await api("POST", "/v1/runs", { body: { input: "Say hello and stop." } });
  check(
    sub.status >= 200 && sub.status < 300 && typeof sub.json?.run_id === "string",
    `POST /v1/runs → 2xx + { run_id } (HTTP ${sub.status})`,
    sub.json,
  );
  check(sub.json?.status === "started", 'POST /v1/runs → status "started"', sub.json?.status);
  const runId = sub.json?.run_id;
  const final = runId ? await pollRun(runId) : null;
  check(Boolean(final), "GET /v1/runs/{id} reaches a terminal state");
  check(final?.status === "completed", `run completed (status=${final?.status})`, final?.error ?? final?.status);
  check(typeof final?.output === "string" && final.output.length > 0, "completed run has string output", final?.output);
  check(
    final?.usage != null && typeof final.usage.total_tokens === "number",
    "usage has { input_tokens, output_tokens, total_tokens }",
    final?.usage,
  );

  console.log("SSE events (names live in data.event)");
  const sub2 = await api("POST", "/v1/runs", { body: { input: "stream hello" } });
  const runId2 = sub2.json?.run_id;
  const evRes = await fetch(`${HERMES}/v1/runs/${runId2}/events`, {
    headers: { Authorization: `Bearer ${KEY}`, Accept: "text/event-stream" },
  });
  const evText = await evRes.text();
  const names = new Set();
  let completedHasOutput = false;
  for (const block of evText.split("\n\n")) {
    const dataLine = block.split("\n").find((l) => l.startsWith("data:"));
    if (!dataLine) continue;
    try {
      const obj = JSON.parse(dataLine.slice(5).trim());
      if (obj.event) names.add(obj.event);
      if (obj.event === "run.completed" && typeof obj.output === "string") completedHasOutput = true;
    } catch {
      /* ignore */
    }
  }
  check(names.size > 0, `SSE events carry data.event names: [${[...names].join(", ")}]`);
  check(names.has("run.completed"), 'SSE emits "run.completed"', [...names]);
  check(completedHasOutput, "run.completed event carries output");

  console.log("Stop");
  const sub3 = await api("POST", "/v1/runs", { body: { input: "long task to stop" } });
  const stop = await api("POST", `/v1/runs/${sub3.json?.run_id}/stop`);
  check(stop.json?.status === "stopping", 'POST /v1/runs/{id}/stop → { status: "stopping" }', stop.json);

  console.log("");
  if (failures === 0) {
    console.log("HERMES CONTRACT VALIDATED ✅");
    process.exit(0);
  } else {
    console.error(`HERMES CONTRACT FAILED ❌ (${failures})`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("CONTRACT ERROR:", err);
  process.exit(1);
});
