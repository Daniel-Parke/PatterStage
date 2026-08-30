// ═══════════════════════════════════════════════════════════════
// mock-hermes/server.mjs — a zero-dependency stand-in for the Hermes
// API Server (https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server)
//
// Implements just enough of the contract for PatterStage end-to-end tests
// without a real agent, models, or API keys:
//   GET  /health, /v1/health, /health/detailed
//   GET  /v1/capabilities, /v1/models, /v1/skills, /v1/toolsets
//   POST /v1/runs              (submit; honours Idempotency-Key)
//   GET  /v1/runs/:id          (poll; completes after RUN_DELAY_MS)
//   GET  /v1/runs/:id/events   (SSE)
//   POST /v1/runs/:id/stop     (cancel)
//   POST /v1/chat/completions  (OpenAI-shaped echo)
//   POST /api/sessions         (create)
//
// Config via env: API_SERVER_PORT (8642), API_SERVER_HOST (0.0.0.0),
// API_SERVER_KEY (when set, bearer auth is enforced), RUN_DELAY_MS (1200).
// ═══════════════════════════════════════════════════════════════

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

// MOCK_HERMES_PORT first, and that ordering is the fix. Reading the AGENT's
// API_SERVER_PORT to configure the MOCK is the original sin: it is exactly the
// variable a machine running the real Hermes gateway already has set, so
// `npm run mock-hermes` collided with the thing it impersonates and a QA pass
// lost time to it. 8642 stays the final default so every doc, compose file and
// smoke test keeps working untouched.
const PORT = Number(process.env.MOCK_HERMES_PORT || process.env.API_SERVER_PORT || 8642);
// Loopback by default, matching mock-hindsight. This is an UNAUTHENTICATED fake
// agent gateway that accepts run submissions; it has no business on the LAN of a
// dev machine. The compose stack is unaffected: mock-hermes/Dockerfile pins
// API_SERVER_HOST=0.0.0.0 explicitly.
const HOST = process.env.MOCK_HERMES_HOST || process.env.API_SERVER_HOST || "127.0.0.1";
const KEY = process.env.API_SERVER_KEY || "";
const RUN_DELAY_MS = Number(process.env.RUN_DELAY_MS || 1200);

/** @type {Map<string, any>} runId -> run record */
const runs = new Map();
/** @type {Map<string, string>} idempotencyKey -> runId */
const idempotency = new Map();

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": typeof body === "string" ? "text/plain" : "application/json",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  res.end(payload);
}

function authorized(req) {
  if (!KEY) return true; // auth disabled when no key configured
  const header = req.headers["authorization"] || "";
  return header === `Bearer ${KEY}`;
}

function readJson(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

/** Resolve a run's current status lazily based on the simulated delay. */
function viewRun(run) {
  if (run.status === "started" && Date.now() >= run.completeAt) {
    run.status = "completed";
    run.output = `Mock Hermes completed run for input: ${String(run.input).slice(0, 80)}`;
    // Composer assessing stages instruct the agent to end with a structured
    // verdict (see stage-prompt.ts). Emit a PASS so on_pass routing exercises
    // deterministically in the Composer smoke; ordinary runs are unaffected.
    if (String(run.input).toUpperCase().includes("VERDICT")) {
      run.output += "\n\nVERDICT: PASS\nREASONS: mock stage passed";
    }
    run.usage = { input_tokens: 42, output_tokens: 84, total_tokens: 126 };
  }
  return {
    object: "hermes.run",
    run_id: run.run_id,
    status: run.status,
    session_id: run.session_id,
    model: "hermes-agent",
    output: run.output ?? "",
    usage: run.usage ?? { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
  };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method || "GET";

  // Health is unauthenticated (matches Hermes).
  if (method === "GET" && (path === "/health" || path === "/v1/health")) {
    return send(res, 200, { status: "ok" });
  }
  if (method === "GET" && path === "/health/detailed") {
    return send(res, 200, { status: "ok", active_sessions: runs.size, running_agents: 0 });
  }

  if (!authorized(req)) {
    return send(res, 401, { error: "missing or invalid bearer token" });
  }

  // ── Discovery ──────────────────────────────────────────────
  if (method === "GET" && path === "/v1/capabilities") {
    return send(res, 200, {
      object: "hermes.api_server.capabilities",
      platform: "hermes-agent",
      auth: { type: "bearer", required: Boolean(KEY) },
      features: {
        chat_completions: true,
        responses_api: true,
        run_submission: true,
        run_status: true,
        run_events_sse: true,
        run_stop: true,
      },
    });
  }
  if (method === "GET" && path === "/v1/models") {
    return send(res, 200, { object: "list", data: [{ id: "hermes-agent", object: "model" }] });
  }
  if (method === "GET" && path === "/v1/skills") {
    return send(res, 200, [
      { name: "mock-skill", description: "A mock skill", category: "demo" },
    ]);
  }
  if (method === "GET" && path === "/v1/toolsets") {
    return send(res, 200, [{ name: "core", tools: ["terminal", "read_file", "write_file"] }]);
  }

  // ── Runs ───────────────────────────────────────────────────
  if (method === "POST" && path === "/v1/runs") {
    const body = await readJson(req);
    const idemKey = req.headers["idempotency-key"];
    if (idemKey && idempotency.has(idemKey)) {
      const existing = runs.get(idempotency.get(idemKey));
      return send(res, 200, { run_id: existing.run_id, status: existing.status, session_id: existing.session_id });
    }
    const runId = `run_${randomUUID()}`;
    const sessionId = body.session_id || `sess_${randomUUID()}`;
    const run = {
      run_id: runId,
      session_id: sessionId,
      status: "started",
      input: body.input ?? "",
      completeAt: Date.now() + RUN_DELAY_MS,
      output: "",
      usage: null,
    };
    runs.set(runId, run);
    if (idemKey) idempotency.set(idemKey, runId);
    return send(res, 200, { run_id: runId, status: "started", session_id: sessionId });
  }

  const runMatch = path.match(/^\/v1\/runs\/([^/]+)(\/events|\/stop)?$/);
  if (runMatch) {
    const run = runs.get(runMatch[1]);
    if (!run) return send(res, 404, { error: "run not found" });
    const sub = runMatch[2];

    if (method === "POST" && sub === "/stop") {
      run.status = "cancelled";
      run.completeAt = Date.now();
      return send(res, 200, { status: "stopping" });
    }
    if (method === "GET" && sub === "/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      // Match real Hermes (0.16): data:-only lines, event name inside the JSON.
      const emit = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);
      const timer = setInterval(() => {
        const v = viewRun(run);
        if (v.status === "completed") {
          emit({ event: "message.delta", run_id: run.run_id, delta: v.output });
          emit({ event: "run.completed", run_id: run.run_id, output: v.output, usage: v.usage });
          clearInterval(timer);
          res.end();
        } else if (v.status === "failed" || v.status === "cancelled") {
          emit({ event: v.status === "failed" ? "run.failed" : "run.cancelled", run_id: run.run_id, error: "mock terminal" });
          clearInterval(timer);
          res.end();
        } else {
          emit({ event: "message.delta", run_id: run.run_id, delta: "." });
        }
      }, 250);
      req.on("close", () => clearInterval(timer));
      return;
    }
    if (method === "GET") {
      return send(res, 200, viewRun(run));
    }
  }

  // ── Chat Completions (OpenAI-shaped echo) ──────────────────
  if (method === "POST" && path === "/v1/chat/completions") {
    const body = await readJson(req);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const last = messages[messages.length - 1];
    const content = `Mock Hermes reply to: ${typeof last?.content === "string" ? last.content.slice(0, 120) : ""}`;
    return send(res, 200, {
      id: `chatcmpl-${randomUUID()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: "hermes-agent",
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
      usage: { prompt_tokens: 20, completion_tokens: 30, total_tokens: 50 },
    });
  }

  // ── Sessions ───────────────────────────────────────────────
  if (method === "POST" && path === "/api/sessions") {
    const body = await readJson(req);
    return send(res, 200, {
      id: `sess_${randomUUID()}`,
      title: body.title ?? null,
      source: body.source ?? "api",
    });
  }

  return send(res, 404, { error: `no mock route for ${method} ${path}` });
});

// Fail with a sentence, not a stack. This mock's default port is one the
// real thing may already hold, so EADDRINUSE is the LIKELY first-run
// outcome rather than an exotic one, and an unhandled 'error' event here
// prints a trace that says nothing about what to do.
server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(
      `[${"mock-hermes"}] port ${PORT} is already in use. The real Hermes gateway listens on 8642.
` +
      `Set MOCK_HERMES_PORT to a free port, or stop whatever holds it.`,
    );
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, HOST, () => {
  console.log(
    `[mock-hermes] listening on http://${HOST}:${PORT} (auth ${KEY ? "ON" : "OFF"}, run delay ${RUN_DELAY_MS}ms)`,
  );
});
