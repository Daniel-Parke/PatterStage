// ═══════════════════════════════════════════════════════════════
// /api/memory/hindsight/route.ts — Hindsight memory via direct HTTP
//
// Replaces the python3 hindsight_bridge.py subprocess with direct
// fetch() calls to the Hindsight HTTP server on localhost:9177.
// This eliminates Python path resolution, subprocess spawning,
// and JSON serialization overhead on every request.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { logApiError } from "@/lib/api-logger";
import { requireAuth } from "@/lib/api-auth";
import type { ApiResponse } from "@/types/hermes";

// ── Tags normalization ───────────────────────────────────────

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return [...new Set(
    tags
      .filter((t): t is string => typeof t === "string" && t.trim() !== "")
      .map(t => t.trim().toLowerCase())
  )];
}

// ── Constants ────────────────────────────────────────────────

const HINDSIGHT_BASE_URL = "http://localhost:9177";
const DEFAULT_BANK = "hermes";
const DEFAULT_TIMEOUT_MS = 15_000;

// ── Direct HTTP helpers ──────────────────────────────────────

interface ApiOptions {
  method?: string;
  body?: Record<string, unknown>;
  timeoutMs?: number;
}

async function requestWithTimeout<T = Record<string, unknown>>(
  path: string,
  { method = "GET", body, timeoutMs = DEFAULT_TIMEOUT_MS }: ApiOptions = {},
): Promise<T> {
  const url = `${HINDSIGHT_BASE_URL}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const init: RequestInit = { method, signal: controller.signal };
  if (body) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(url, init);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Hindsight ${method} ${path}: ${res.status} ${text}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

// ── Response shaping helpers ─────────────────────────────────

function mapMemoryItem(item: Record<string, unknown>) {
  return {
    id: item.id,
    content: item.text || item.content || "",
    type: item.fact_type || "experience",
    created_at: item.date || item.created_at || "",
    tags: item.tags || [],
    entities: item.entities || "",
    score: item.proof_count || 0,
  };
}

function mapDirectiveItem(d: Record<string, unknown>) {
  return {
    id: d.id || "",
    name: d.name || "",
    content: d.content || "",
    priority: d.priority || 0,
    is_active: d.is_active ?? true,
    tags: d.tags || [],
    created_at: d.created_at || "",
  };
}

function mapMentalModelItem(m: Record<string, unknown>) {
  return {
    id: m.id || "",
    name: m.name || "",
    source_query: m.source_query || "",
    content: m.content || "",
    tags: m.tags || [],
    created_at: m.created_at || "",
    last_refreshed_at: m.last_refreshed_at || "",
  };
}

// ── Action handlers ──────────────────────────────────────────

async function handleList(bank: string, search?: string, limit?: number) {
  let params = `?limit=${limit || 100}`;
  if (search) params += `&search=${encodeURIComponent(search)}`;
  const result = await requestWithTimeout<{ items?: Record<string, unknown>[]; total?: number }>(
    `/v1/default/banks/${bank}/memories/list${params}`,
  );
  const memories = (result.items || []).map(mapMemoryItem);
  return { memories, count: memories.length, total: result.total || 0 };
}

async function handleRetain(bank: string, content: string, tags?: string[]) {
  const result = await requestWithTimeout<{ success?: boolean; operation_id?: string }>(
    `/v1/default/banks/${bank}/memories`,
    { method: "POST", body: { items: [{ content, tags: tags || [] }] }, timeoutMs: 30_000 },
  );
  return { success: result.success || false, operation_id: result.operation_id };
}

async function handleRecall(bank: string, query: string) {
  const result = await requestWithTimeout<{ items?: Record<string, unknown>[] }>(
    `/v1/default/banks/${bank}/memories/list?limit=20&search=${encodeURIComponent(query)}`,
  );
  const memories = (result.items || []).map(mapMemoryItem);
  return { memories, count: memories.length };
}

async function handleReflect(bank: string, query: string, budget?: string) {
  try {
    const result = await requestWithTimeout<{ response?: string; facts?: unknown[] }>(
      `/v1/default/banks/${bank}/reflect`,
      { method: "POST", body: { query, budget: budget || "mid" }, timeoutMs: 60_000 },
    );
    return { response: result.response || String(result), facts: result.facts || [] };
  } catch {
    // Fallback: search
    const listResult = await handleRecall(bank, query);
    const facts = listResult.memories.map((m: Record<string, unknown>) => m.content);
    return { response: `Found ${facts.length} relevant memories.`, facts };
  }
}

async function handleDirectives(bank: string) {
  const result = await requestWithTimeout<Record<string, unknown>[] | { items?: Record<string, unknown>[] }>(
    `/v1/default/banks/${bank}/directives`,
  );
  const items = Array.isArray(result) ? result : (result.items || []);
  const directives = items.map(mapDirectiveItem);
  return { directives, count: directives.length };
}

async function handleCreateDirective(
  bank: string,
  name: string,
  content: string,
  priority?: number,
  tags?: string[],
) {
  const body: Record<string, unknown> = { name, content };
  if (priority !== undefined) body.priority = priority;
  if (tags) body.tags = tags;
  const result = await requestWithTimeout(`/v1/default/banks/${bank}/directives`, { method: "POST", body });
  return { success: true, directive: result };
}

async function handleDeleteDirective(bank: string, id: string) {
  await requestWithTimeout(`/v1/default/banks/${bank}/directives/${id}`, { method: "DELETE" });
  return { success: true, id };
}

async function handleUpdateDirective(
  bank: string,
  id: string,
  updates: Record<string, unknown>,
) {
  const body: Record<string, unknown> = {};
  if (updates.name !== undefined) body.name = updates.name;
  if (updates.content !== undefined) body.content = updates.content;
  if (updates.priority !== undefined) body.priority = updates.priority;
  if (updates.is_active !== undefined) body.is_active = String(updates.is_active) === "true";
  if (updates.tags !== undefined) body.tags = normalizeTags(updates.tags);
  const result = await requestWithTimeout(`/v1/default/banks/${bank}/directives/${id}`, { method: "PATCH", body });
  return { success: true, directive: result };
}

async function handleMentalModels(bank: string) {
  const result = await requestWithTimeout<Record<string, unknown>[] | { items?: Record<string, unknown>[] }>(
    `/v1/default/banks/${bank}/mental-models`,
  );
  const items = Array.isArray(result) ? result : (result.items || []);
  const models = items.map(mapMentalModelItem);
  return { models, count: models.length };
}

async function handleCreateMentalModel(
  bank: string,
  name: string,
  query: string,
  tags?: string[],
) {
  const body: Record<string, unknown> = { name, source_query: query };
  if (tags) body.tags = tags;
  const result = await requestWithTimeout<{ mental_model_id?: string; operation_id?: string }>(
    `/v1/default/banks/${bank}/mental-models`,
    { method: "POST", body },
  );
  return { success: true, mental_model_id: result.mental_model_id, operation_id: result.operation_id };
}

async function handleDeleteMentalModel(bank: string, id: string) {
  await requestWithTimeout(`/v1/default/banks/${bank}/mental-models/${id}`, { method: "DELETE" });
  return { success: true, id };
}

async function handleRefreshMentalModel(bank: string, id: string) {
  const result = await requestWithTimeout<{ operation_id?: string }>(
    `/v1/default/banks/${bank}/mental-models/${id}/refresh`,
    { method: "POST", body: {} },
  );
  return { success: true, operation_id: result.operation_id };
}

async function handleUpdateMentalModel(
  bank: string,
  id: string,
  updates: Record<string, unknown>,
) {
  const body: Record<string, unknown> = {};
  if (updates.name !== undefined) body.name = updates.name;
  if (updates.query !== undefined) body.source_query = updates.query;
  if (updates.tags !== undefined) body.tags = normalizeTags(updates.tags);
  const result = await requestWithTimeout(`/v1/default/banks/${bank}/mental-models/${id}`, { method: "PATCH", body });
  return { success: true, model: result };
}

async function handleHealth() {
  try {
    const result = await requestWithTimeout<{ ok?: boolean; status?: string }>("/health", { timeoutMs: 3000 });
    return { available: true, mode: "external", status: result.status ?? "healthy" };
  } catch (e) {
    return {
      available: false,
      error: e instanceof Error ? e.message : "Connection refused",
    };
  }
}

async function handleCount(bank: string) {
  try {
    const result = await requestWithTimeout<{ total?: number }>(
      `/v1/default/banks/${bank}/memories/list?limit=1`,
    );
    return { count: result.total || 0, bank };
  } catch (e) {
    return {
      count: 0,
      bank,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

// ── Routes ───────────────────────────────────────────────────

// GET — List memories, recall, reflect, health check
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;
  const action = request.nextUrl.searchParams.get("action") || "list";
  const query = request.nextUrl.searchParams.get("query") || undefined;
  const budget = request.nextUrl.searchParams.get("budget") || undefined;
  const bank = request.nextUrl.searchParams.get("bank") || DEFAULT_BANK;
  const limitStr = request.nextUrl.searchParams.get("limit") || undefined;
  const limit = limitStr ? parseInt(limitStr, 10) : undefined;

  try {
    let result: Record<string, unknown>;

    switch (action) {
      case "list":
        result = await handleList(bank, query, limit);
        break;
      case "recall":
        if (!query) {
          return NextResponse.json({ error: "query is required for recall" }, { status: 400 });
        }
        result = await handleRecall(bank, query);
        break;
      case "reflect":
        if (!query) {
          return NextResponse.json({ error: "query is required for reflect" }, { status: 400 });
        }
        result = await handleReflect(bank, query, budget);
        break;
      case "directives":
        result = await handleDirectives(bank);
        break;
      case "mental-models":
        result = await handleMentalModels(bank);
        break;
      case "health":
        result = await handleHealth();
        break;
      case "count":
        result = await handleCount(bank);
        break;
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json<ApiResponse<Record<string, unknown>>>({ data: result });
  } catch (error) {
    logApiError("GET /api/memory/hindsight", `action=${action}`, error);
    const isConnectionError =
      error instanceof Error &&
      (error.message.includes("connect") ||
       error.message.includes("ECONNREFUSED") ||
       error.message.includes("refused") ||
       error.message.includes("timed out"));
    return NextResponse.json(
      {
        data: {
          available: false,
          error: error instanceof Error ? error.message : "Hindsight error",
          memories: [],
        },
      },
      { status: isConnectionError ? 503 : 500 },
    );
  }
}

// POST — Retain memory, create directive, create mental model
export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;
  try {
    const body = await request.json();
    const action = body.action || "retain";
    const bank = body.bank || DEFAULT_BANK;

    let result: Record<string, unknown>;

    switch (action) {
      case "retain": {
        const { content, tags } = body;
        if (!content || typeof content !== "string" || content.trim().length === 0) {
          return NextResponse.json({ error: "Content is required" }, { status: 400 });
        }
        result = await handleRetain(bank, content.trim(), tags);
        break;
      }
      case "create-directive": {
        const { name, content: dirContent, priority, tags } = body;
        if (!name || !dirContent) {
          return NextResponse.json({ error: "name and content are required" }, { status: 400 });
        }
        result = await handleCreateDirective(bank, name, dirContent, priority, tags);
        break;
      }
      case "create-model": {
        const { name, query: mQuery, tags } = body;
        if (!name || !mQuery) {
          return NextResponse.json({ error: "name and query are required" }, { status: 400 });
        }
        result = await handleCreateMentalModel(bank, name, mQuery, tags);
        break;
      }
      case "update-directive": {
        const { id, name, content: uContent, priority, is_active, tags } = body;
        if (!id) {
          return NextResponse.json({ error: "id is required" }, { status: 400 });
        }
        result = await handleUpdateDirective(bank, id, { name, content: uContent, priority, is_active, tags });
        break;
      }
      case "update-model": {
        const { id, name, query: umQuery, tags } = body;
        if (!id) {
          return NextResponse.json({ error: "id is required" }, { status: 400 });
        }
        result = await handleUpdateMentalModel(bank, id, { name, query: umQuery, tags });
        break;
      }
      case "refresh-model": {
        const { id } = body;
        if (!id) {
          return NextResponse.json({ error: "id is required" }, { status: 400 });
        }
        result = await handleRefreshMentalModel(bank, id);
        break;
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json<ApiResponse<Record<string, unknown>>>({ data: result });
  } catch (error) {
    logApiError("POST /api/memory/hindsight", "action", error);
    return NextResponse.json(
      {
        data: {
          available: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 },
    );
  }
}

// DELETE — Remove directive or mental model
export async function DELETE(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;
  try {
    const body = await request.json();
    const { type, id, bank = DEFAULT_BANK } = body;

    if (!id || !type) {
      return NextResponse.json({ error: "type and id are required" }, { status: 400 });
    }

    let result: Record<string, unknown>;
    if (type === "directive") {
      result = await handleDeleteDirective(bank, id);
    } else {
      result = await handleDeleteMentalModel(bank, id);
    }

    return NextResponse.json<ApiResponse<Record<string, unknown>>>({ data: result });
  } catch (error) {
    logApiError("DELETE /api/memory/hindsight", "delete", error);
    return NextResponse.json(
      {
        data: {
          available: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 },
    );
  }
}
