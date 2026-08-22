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
import { messageFromError } from "@/lib/api-fetch";
import { requireAuth } from "@/lib/api-auth";
import { badRequest, ok } from "@/lib/api-response";
import { getActiveMemoryProvider, getActiveMemoryConfig } from "@/lib/memory/memory-providers";
import { parseJsonBody } from "@/lib/parse-json-body";
import {
  mapMemoryItem,
  mapDirectiveItem,
  mapMentalModelItem,
  normalizeTags,
} from "@/lib/memory/hindsight-bridge";
import {
  buildPartialUpdateBody,
  DIRECTIVE_UPDATE_FIELDS,
  extractListItems,
  hindsightErrorFromCatch,
  MENTAL_MODEL_UPDATE_FIELDS,
} from "@/lib/memory/hindsight-route-helpers";

// ── Connection-error detection ─────────────────────────────────

/**
 * Heuristic for "is this a connection-level failure?" — used to
 * downgrade the catch-branch response status from 500 to 503 (the
 * Hindsight server isn't responding, so it's not really a code bug).
 * The original `requestWithTimeout` error message already includes
 * the upstream status + body, so the match must look at substrings
 * of `error.message`, not at `error.name` or a typed `code` field.
 */
export function isHindsightConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  return (
    msg.includes("connect") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("refused") ||
    msg.includes("timed out")
  );
}

// ── DB-owned endpoint/bank ───────────────────────────────────
// Host/port/bank come from the active provider config (see /config/memory) —
// no more hardcoded localhost:9177 / "hermes". The provider's request()
// preserves the error-message shape isHindsightConnectionError matches.

/** The configured default bank (overridable per request via ?bank=). */
function defaultBank(): string {
  return getActiveMemoryConfig().config.bank;
}

interface ApiOptions {
  method?: string;
  body?: Record<string, unknown>;
  timeoutMs?: number;
}

async function requestWithTimeout<T = Record<string, unknown>>(
  path: string,
  opts: ApiOptions = {},
): Promise<T> {
  return getActiveMemoryProvider().request<T>(path, opts);
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
    const facts = listResult.memories.map((m) => m.content);
    return { response: `Found ${facts.length} relevant memories.`, facts };
  }
}

async function handleDirectives(bank: string) {
  const result = await requestWithTimeout(
    `/v1/default/banks/${bank}/directives`,
  );
  const items = extractListItems(result);
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
  const body: Record<string, unknown> = buildPartialUpdateBody(
    updates,
    DIRECTIVE_UPDATE_FIELDS,
  );
  if (updates.tags !== undefined) body.tags = normalizeTags(updates.tags);
  const result = await requestWithTimeout(`/v1/default/banks/${bank}/directives/${id}`, { method: "PATCH", body });
  return { success: true, directive: result };
}

async function handleMentalModels(bank: string) {
  const result = await requestWithTimeout(
    `/v1/default/banks/${bank}/mental-models`,
  );
  const items = extractListItems(result);
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
  // The wire field for `query` is `source_query`; remap the
  // field-builder so the helper writes to the right key.
  const fields = {
    ...MENTAL_MODEL_UPDATE_FIELDS,
    query: (raw: unknown): [string, unknown] => ["source_query", raw],
  };
  const body: Record<string, unknown> = buildPartialUpdateBody(updates, fields);
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
      error: messageFromError(e, "Connection refused"),
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
      error: messageFromError(e, "Unknown error"),
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
  const bank = request.nextUrl.searchParams.get("bank") || defaultBank();
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
          return badRequest("query is required for recall");
        }
        result = await handleRecall(bank, query);
        break;
      case "reflect":
        if (!query) {
          return badRequest("query is required for reflect");
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
        return badRequest(`Unknown action: ${action}`);
    }

    return ok(result);
  } catch (error) {
    logApiError("GET /api/memory/hindsight", `action=${action}`, error);
    return NextResponse.json(
      {
        data: {
          available: false,
          error: messageFromError(error, "Hindsight error"),
          memories: [],
        },
      },
      { status: isHindsightConnectionError(error) ? 503 : 500 },
    );
  }
}

// POST — Retain memory, create directive, create mental model
export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;
  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;

  // Narrow the unknown body to the structural shape we expect from the
  // client. parseJsonBody returns Record<string, unknown>; this cast
  // is the documented pattern in src/lib/parse-json-body.ts.
  const body = bodyResult as {
    action?: string;
    bank?: string;
    content?: string;
    tags?: string[];
    name?: string;
    priority?: number;
    query?: string;
    id?: string;
    is_active?: string | boolean;
  };

  try {
    const action = body.action || "retain";
    const bank = body.bank || defaultBank();

    let result: Record<string, unknown>;

    switch (action) {
      case "retain": {
        const { content, tags } = body;
        if (!content || typeof content !== "string" || content.trim().length === 0) {
          return badRequest("Content is required");
        }
        result = await handleRetain(bank, content.trim(), tags);
        break;
      }
      case "create-directive": {
        const { name, content: dirContent, priority, tags } = body;
        if (!name || !dirContent) {
          return badRequest("name and content are required");
        }
        result = await handleCreateDirective(bank, name, dirContent, priority, tags);
        break;
      }
      case "create-model": {
        const { name, query: mQuery, tags } = body;
        if (!name || !mQuery) {
          return badRequest("name and query are required");
        }
        result = await handleCreateMentalModel(bank, name, mQuery, tags);
        break;
      }
      case "update-directive": {
        const { id, name, content: uContent, priority, is_active, tags } = body;
        if (!id) {
          return badRequest("id is required");
        }
        result = await handleUpdateDirective(bank, id, { name, content: uContent, priority, is_active, tags });
        break;
      }
      case "update-model": {
        const { id, name, query: umQuery, tags } = body;
        if (!id) {
          return badRequest("id is required");
        }
        result = await handleUpdateMentalModel(bank, id, { name, query: umQuery, tags });
        break;
      }
      case "refresh-model": {
        const { id } = body;
        if (!id) {
          return badRequest("id is required");
        }
        result = await handleRefreshMentalModel(bank, id);
        break;
      }
      default:
        return badRequest(`Unknown action: ${action}`);
    }

    return ok(result);
  } catch (error) {
    return hindsightErrorFromCatch("POST /api/memory/hindsight", "action", error);
  }
}

// DELETE — Remove directive or mental model
export async function DELETE(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;
  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;
  const body = bodyResult;

  try {
    const { type, id, bank = defaultBank() } = body as {
      type?: string;
      id?: string;
      bank?: string;
    };

    if (!id || !type) {
      return badRequest("type and id are required");
    }

    let result: Record<string, unknown>;
    if (type === "directive") {
      result = await handleDeleteDirective(bank, id);
    } else {
      result = await handleDeleteMentalModel(bank, id);
    }

    return ok(result);
  } catch (error) {
    return hindsightErrorFromCatch("DELETE /api/memory/hindsight", "delete", error);
  }
}
