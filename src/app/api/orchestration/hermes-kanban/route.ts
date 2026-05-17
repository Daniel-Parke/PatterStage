import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import * as bridge from "@/lib/hermes-kanban-bridge";

function handleError(error: unknown, context: string) {
  logApiError("hermes-kanban", context, error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Request failed" },
    { status: 500 }
  );
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);

    // /stats
    if (url.pathname.endsWith("/stats")) {
      return NextResponse.json({ data: bridge.getBoardSummary() });
    }
    // /assignees
    if (url.pathname.endsWith("/assignees")) {
      return NextResponse.json({ data: bridge.getAssignees() });
    }
    // /:id
    const taskId = url.searchParams.get("id");
    if (taskId) {
      const task = bridge.getTask(taskId);
      if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
      return NextResponse.json({ data: task });
    }
    // / list
    const tasks = bridge.listTasks({
      assignee: url.searchParams.get("assignee") || undefined,
      status: url.searchParams.get("status") || undefined,
      tenant: url.searchParams.get("tenant") || undefined,
      include_archived: url.searchParams.get("include_archived") === "true",
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    });
    return NextResponse.json({ data: { tasks, total: tasks.length } });
  } catch (error) {
    return handleError(error, "GET");
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "create": {
        const result = bridge.createTask(body.title, {
          body: body.body,
          assignee: body.assignee,
          priority: body.priority,
          tenant: body.tenant,
          triage: body.triage,
          skills: body.skills,
          parent: body.parent,
        });
        return NextResponse.json({ data: result });
      }
      case "complete": {
        bridge.completeTask(body.taskId, body.summary, body.metadata);
        return NextResponse.json({ data: { ok: true } });
      }
      case "block": {
        bridge.blockTask(body.taskId, body.reason);
        return NextResponse.json({ data: { ok: true } });
      }
      case "unblock": {
        bridge.unblockTask(body.taskId);
        return NextResponse.json({ data: { ok: true } });
      }
      case "assign": {
        bridge.assignTask(body.taskId, body.assignee);
        return NextResponse.json({ data: { ok: true } });
      }
      case "comment": {
        bridge.addComment(body.taskId, body.text);
        return NextResponse.json({ data: { ok: true } });
      }
      case "link": {
        bridge.linkTasks(body.parentId, body.childId);
        return NextResponse.json({ data: { ok: true } });
      }
      case "archive": {
        bridge.archiveTask(body.taskId);
        return NextResponse.json({ data: { ok: true } });
      }
      case "dispatch": {
        bridge.dispatchNow(body.max);
        return NextResponse.json({ data: { ok: true } });
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return handleError(error, "POST");
  }
}
