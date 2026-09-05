// ═══════════════════════════════════════════════════════════════
// /api/memory/hindsight/route.ts — Hindsight memory via direct HTTP
//
// Replaces the python3 hindsight_bridge.py subprocess with direct
// fetch() calls to the Hindsight HTTP server on localhost:9177.
// This eliminates Python path resolution, subprocess spawning,
// and JSON serialization overhead on every request.
//
// This file is the transport shell: authenticate, read the action off
// the query string or body, dispatch, and shape the answer. The actions
// themselves live in src/lib/memory/:
//
//   hindsight-request.ts        provider transport + connection-error test
//   hindsight-read-actions.ts   list, recall, reflect, directives, models,
//                               health, count
//   hindsight-write-actions.ts  retain plus the directive/model mutations
//
// Authentication is enforced once in src/proxy.ts, and so is read-only mode,
// which refuses unsafe methods before any handler runs. This route carries
// neither check (T-0048).
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { logApiError } from "@/lib/api-logger";
import { messageFromError } from "@/lib/api-fetch";

import { badRequest, ok } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/parse-json-body";
import { recordEvent } from "@/lib/analytics/record-event";
import {
  defaultBank,
  isHindsightConnectionError,
} from "@/lib/memory/hindsight-request";
import {
  handleCount,
  handleDirectives,
  handleHealth,
  handleList,
  handleMentalModels,
  handleRecall,
  handleReflect,
} from "@/lib/memory/hindsight-read-actions";
import {
  handleCreateDirective,
  handleCreateMentalModel,
  handleDeleteDirective,
  handleDeleteMentalModel,
  handleRefreshMentalModel,
  handleRetain,
  handleUpdateDirective,
  handleUpdateMentalModel,
} from "@/lib/memory/hindsight-write-actions";
import { hindsightErrorFromCatch } from "@/lib/memory/hindsight-route-helpers";

// ── Routes ───────────────────────────────────────────────────

// GET — List memories, recall, reflect, health check
export async function GET(request: NextRequest) {
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
        recordEvent("memory.retained", { entityType: "memory", entityId: bank, metadata: { bank } });
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
