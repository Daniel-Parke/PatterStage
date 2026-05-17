// ═══════════════════════════════════════════════════════════════
// Hermes Kanban API — Main listing + creation endpoints
// ═══════════════════════════════════════════════════════════════
// GET  /api/orchestration/hermes-kanban        — list tasks
// POST /api/orchestration/hermes-kanban        — create task
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import * as bridge from "@/lib/hermes-kanban-bridge";

function handleError(error: unknown, context: string) {
  logApiError("hermes-kanban", context, error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Request failed" },
    { status: 500 },
  );
}

/** GET /api/orchestration/hermes-kanban — list tasks with optional filters. */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const tasks = bridge.listTasks({
      assignee: url.searchParams.get("assignee") || undefined,
      status: url.searchParams.get("status") || undefined,
      tenant: url.searchParams.get("tenant") || undefined,
      include_archived: url.searchParams.get("include_archived") === "true",
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    });
    return NextResponse.json({ data: { tasks, total: tasks.length } });
  } catch (error) {
    return handleError(error, "GET /api/orchestration/hermes-kanban");
  }
}

/** POST /api/orchestration/hermes-kanban — create a new task. */
export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const body = await request.json();
    const { title, ...options } = body;

    const result = await bridge.createTask(title, {
      body: options.body,
      assignee: options.assignee,
      priority: options.priority,
      tenant: options.tenant,
      triage: options.triage,
      skills: options.skills,
      parent: options.parent,
      workspace: options.workspace,
      maxRuntime: options.maxRuntime,
      idempotencyKey: options.idempotencyKey,
      maxRetries: options.maxRetries,
      createdBy: options.createdBy,
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    return handleError(error, "POST /api/orchestration/hermes-kanban");
  }
}
