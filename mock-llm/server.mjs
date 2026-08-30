// ═══════════════════════════════════════════════════════════════
// mock-llm/server.mjs — a zero-dependency OpenAI-compatible LLM stub
//
// Lets a REAL Hermes Agent (provider: custom, base_url -> here) complete agent
// runs deterministically with no API keys / cost. Hermes calls
// POST /v1/chat/completions; we return a single final assistant message with
// finish_reason "stop" (no tool calls) so the agent loop terminates a run.
//
// Config via env: MOCK_LLM_PORT (8000), MOCK_LLM_HOST (0.0.0.0),
// MOCK_LLM_REPLY (override the canned reply text).
// ═══════════════════════════════════════════════════════════════

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.MOCK_LLM_PORT || 8000);
// Loopback by default, matching mock-hermes and mock-hindsight. An
// unauthenticated completion stub has no business on a dev machine's LAN.
// The compose stack is unaffected: mock-llm/Dockerfile pins
// MOCK_LLM_HOST=0.0.0.0 explicitly, as mock-hermes/Dockerfile does.
const HOST = process.env.MOCK_LLM_HOST || "127.0.0.1";
const REPLY =
  process.env.MOCK_LLM_REPLY ||
  "MOCK_LLM_OK — task acknowledged and completed by the deterministic test model.";

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": typeof body === "string" ? "text/plain" : "application/json",
    ...headers,
  });
  res.end(payload);
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

function lastUserText(messages) {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && m.role === "user") {
      if (typeof m.content === "string") return m.content;
      if (Array.isArray(m.content)) {
        const t = m.content.find((p) => p && p.type === "text");
        return t?.text ?? "";
      }
    }
  }
  return "";
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method || "GET";

  if (method === "GET" && (path === "/health" || path === "/v1/health")) {
    return send(res, 200, { status: "ok" });
  }

  if (method === "GET" && path === "/v1/models") {
    return send(res, 200, {
      object: "list",
      data: [{ id: "mock-model", object: "model", owned_by: "mock-llm" }],
    });
  }

  if (method === "POST" && path === "/v1/embeddings") {
    const body = await readJson(req);
    const inputs = Array.isArray(body.input) ? body.input : [body.input ?? ""];
    return send(res, 200, {
      object: "list",
      model: body.model ?? "mock-embed",
      data: inputs.map((_, index) => ({
        object: "embedding",
        index,
        embedding: [0, 0, 0, 0, 0, 0, 0, 0],
      })),
      usage: { prompt_tokens: 1, total_tokens: 1 },
    });
  }

  if (method === "POST" && path === "/v1/chat/completions") {
    const body = await readJson(req);
    const model = body.model || "mock-model";
    const reply = `${REPLY} [ctx:${String(lastUserText(body.messages)).slice(0, 60)}]`;
    const id = `chatcmpl-${randomUUID()}`;
    const created = Math.floor(Date.now() / 1000);

    if (body.stream) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      const chunk = (delta, finish = null) =>
        res.write(
          `data: ${JSON.stringify({
            id,
            object: "chat.completion.chunk",
            created,
            model,
            choices: [{ index: 0, delta, finish_reason: finish }],
          })}\n\n`,
        );
      chunk({ role: "assistant" });
      chunk({ content: reply });
      chunk({}, "stop");
      res.write("data: [DONE]\n\n");
      return res.end();
    }

    return send(res, 200, {
      id,
      object: "chat.completion",
      created,
      model,
      choices: [
        { index: 0, message: { role: "assistant", content: reply }, finish_reason: "stop" },
      ],
      usage: { prompt_tokens: 20, completion_tokens: 12, total_tokens: 32 },
    });
  }

  return send(res, 404, { error: { message: `no mock-llm route for ${method} ${path}` } });
});

// Fail with a sentence, not a stack. This mock's default port is one the
// real thing may already hold, so EADDRINUSE is the LIKELY first-run
// outcome rather than an exotic one, and an unhandled 'error' event here
// prints a trace that says nothing about what to do.
server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(
      `[${"mock-llm"}] port ${PORT} is already in use. Another service may hold this port.
` +
      `Set MOCK_LLM_PORT to a free port, or stop whatever holds it.`,
    );
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, HOST, () => {
  console.log(`[mock-llm] OpenAI-compatible stub on http://${HOST}:${PORT}`);
});
