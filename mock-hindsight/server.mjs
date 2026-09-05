// ═══════════════════════════════════════════════════════════════
// mock-hindsight/server.mjs — a zero-dependency stand-in for the Hindsight
// memory HTTP server (the real one is Python + Postgres/pgvector on :9177).
//
// Implements just enough of the contract that PatterStage's
// `/api/memory/hindsight` route calls, so the Memory page + tests work
// without Postgres, Python, or an LLM:
//   GET    /health
//   GET    /v1/default/banks/:bank/memories/list?limit=&search=
//   POST   /v1/default/banks/:bank/memories            { items:[{content,tags}] }
//   POST   /v1/default/banks/:bank/reflect             { query, budget }
//   GET    /v1/default/banks/:bank/directives
//   POST   /v1/default/banks/:bank/directives          { name, content, priority?, tags? }
//   PATCH  /v1/default/banks/:bank/directives/:id
//   DELETE /v1/default/banks/:bank/directives/:id
//   GET    /v1/default/banks/:bank/mental-models
//   POST   /v1/default/banks/:bank/mental-models       { name, source_query, tags? }
//   POST   /v1/default/banks/:bank/mental-models/:id/refresh
//   PATCH  /v1/default/banks/:bank/mental-models/:id
//   DELETE /v1/default/banks/:bank/mental-models/:id
//
// State is in-memory (lost on restart). Config via env:
//   HINDSIGHT_PORT (9177), HINDSIGHT_HOST (127.0.0.1), HINDSIGHT_SEED (1).
// ═══════════════════════════════════════════════════════════════

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.HINDSIGHT_PORT || 9177);
const HOST = process.env.HINDSIGHT_HOST || "127.0.0.1";
const SEED = process.env.HINDSIGHT_SEED !== "0";

/** @type {Map<string, { memories: any[]; directives: any[]; models: any[] }>} */
const banks = new Map();

function nowIso() {
  return new Date().toISOString();
}

function getBank(name) {
  let bank = banks.get(name);
  if (!bank) {
    bank = { memories: [], directives: [], models: [] };
    if (SEED && name === "hermes") seedBank(bank);
    banks.set(name, bank);
  }
  return bank;
}

function seedBank(bank) {
  bank.memories.push(
    {
      id: randomUUID(),
      text: "The operator prefers concise, technical answers over long prose.",
      fact_type: "preference",
      date: nowIso(),
      tags: ["style", "preferences"],
      entities: "operator",
      proof_count: 3,
    },
    {
      id: randomUUID(),
      text: "PatterStage talks to the Hermes agent over the gateway API on port 8642.",
      fact_type: "experience",
      date: nowIso(),
      tags: ["architecture"],
      entities: "patterstage,hermes",
      proof_count: 5,
    },
  );
  bank.directives.push({
    id: randomUUID(),
    name: "Cite sources",
    content: "When answering research questions, include a source for each claim.",
    priority: 2,
    is_active: true,
    tags: ["research"],
    created_at: nowIso(),
  });
  bank.models.push({
    id: randomUUID(),
    name: "Operator workflow",
    source_query: "How does the operator like to work?",
    content: "Iterative, test-driven, prefers small reviewable changes.",
    tags: ["operator"],
    created_at: nowIso(),
    last_refreshed_at: nowIso(),
  });
}

function send(res, status, body) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": typeof body === "string" ? "text/plain" : "application/json",
    "X-Content-Type-Options": "nosniff",
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

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const method = req.method || "GET";
  const segs = url.pathname.split("/").filter(Boolean);

  // GET /health
  if (method === "GET" && url.pathname === "/health") {
    return send(res, 200, { ok: true, status: "healthy" });
  }

  // /v1/default/banks/:bank/:resource[/...]
  if (segs[0] === "v1" && segs[1] === "default" && segs[2] === "banks") {
    const bankName = segs[3];
    const resource = segs[4];
    const rest = segs.slice(5); // e.g. ["list"] | [id] | [id,"refresh"]
    const bank = getBank(bankName);

    // ── Memories ──────────────────────────────────────────────
    if (resource === "memories") {
      if (method === "GET" && rest[0] === "list") {
        const limit = Number(url.searchParams.get("limit") || 100);
        const search = (url.searchParams.get("search") || "").toLowerCase();
        let items = bank.memories;
        if (search) items = items.filter((m) => String(m.text).toLowerCase().includes(search));
        return send(res, 200, { items: items.slice(0, limit), total: items.length });
      }
      if (method === "POST" && rest.length === 0) {
        const body = await readJson(req);
        const incoming = Array.isArray(body.items) ? body.items : [];
        for (const it of incoming) {
          bank.memories.unshift({
            id: randomUUID(),
            text: String(it.content ?? ""),
            fact_type: "experience",
            date: nowIso(),
            tags: Array.isArray(it.tags) ? it.tags : [],
            entities: "",
            proof_count: 1,
          });
        }
        return send(res, 200, { success: true, operation_id: randomUUID() });
      }
    }

    // ── Reflect ───────────────────────────────────────────────
    if (resource === "reflect" && method === "POST") {
      const body = await readJson(req);
      const q = String(body.query ?? "").toLowerCase();
      const facts = bank.memories.filter((m) => !q || String(m.text).toLowerCase().includes(q));
      return send(res, 200, {
        response: `Reflecting on "${body.query ?? ""}": ${facts.length} relevant memories found.`,
        facts: facts.map((m) => m.text),
      });
    }

    // ── Directives ────────────────────────────────────────────
    if (resource === "directives") {
      if (method === "GET" && rest.length === 0) {
        return send(res, 200, { items: bank.directives });
      }
      if (method === "POST" && rest.length === 0) {
        const body = await readJson(req);
        const directive = {
          id: randomUUID(),
          name: String(body.name ?? ""),
          content: String(body.content ?? ""),
          priority: typeof body.priority === "number" ? body.priority : 0,
          is_active: true,
          tags: Array.isArray(body.tags) ? body.tags : [],
          created_at: nowIso(),
        };
        bank.directives.unshift(directive);
        return send(res, 200, directive);
      }
      if (method === "PATCH" && rest[0]) {
        const body = await readJson(req);
        const d = bank.directives.find((x) => x.id === rest[0]);
        if (!d) return send(res, 404, { error: "directive not found" });
        Object.assign(d, body);
        return send(res, 200, d);
      }
      if (method === "DELETE" && rest[0]) {
        bank.directives = bank.directives.filter((x) => x.id !== rest[0]);
        return send(res, 200, { success: true });
      }
    }

    // ── Mental models ─────────────────────────────────────────
    if (resource === "mental-models") {
      if (method === "GET" && rest.length === 0) {
        return send(res, 200, { items: bank.models });
      }
      if (method === "POST" && rest.length === 0) {
        const body = await readJson(req);
        const model = {
          id: randomUUID(),
          name: String(body.name ?? ""),
          source_query: String(body.source_query ?? ""),
          content: "",
          tags: Array.isArray(body.tags) ? body.tags : [],
          created_at: nowIso(),
          last_refreshed_at: nowIso(),
        };
        bank.models.unshift(model);
        return send(res, 200, { mental_model_id: model.id, operation_id: randomUUID() });
      }
      if (method === "POST" && rest[1] === "refresh") {
        const m = bank.models.find((x) => x.id === rest[0]);
        if (m) m.last_refreshed_at = nowIso();
        return send(res, 200, { operation_id: randomUUID() });
      }
      if (method === "PATCH" && rest[0]) {
        const body = await readJson(req);
        const m = bank.models.find((x) => x.id === rest[0]);
        if (!m) return send(res, 404, { error: "mental model not found" });
        Object.assign(m, body);
        return send(res, 200, m);
      }
      if (method === "DELETE" && rest[0]) {
        bank.models = bank.models.filter((x) => x.id !== rest[0]);
        return send(res, 200, { success: true });
      }
    }
  }

  return send(res, 404, { error: `no mock route for ${method} ${url.pathname}` });
});

// Fail with a sentence, not a stack. This mock's default port is one the
// real thing may already hold, so EADDRINUSE is the LIKELY first-run
// outcome rather than an exotic one, and an unhandled 'error' event here
// prints a trace that says nothing about what to do.
server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(
      `[${"mock-hindsight"}] port ${PORT} is already in use. Another Hindsight may be running.
` +
      `Set HINDSIGHT_PORT to a free port, or stop whatever holds it.`,
    );
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, HOST, () => {
  console.log(
    `[mock-hindsight] listening on http://${HOST}:${PORT} (seed ${SEED ? "ON" : "OFF"})`,
  );
});
