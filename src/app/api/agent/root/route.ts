import { NextRequest, NextResponse } from "next/server";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { parseJsonBody } from "@/lib/parse-json-body";
import { appendAuditLine } from "@/lib/audit-log";
import { ensureDb } from "@/lib/db";
import { getAgentRoot, updateAgentRoot } from "@/lib/agent-root-repository";
import { badRequest, ok, methodNotAllowed } from "@/lib/api-response";

const MAX_NAME = 60;
const MAX_DESCRIPTION = 400;

/**
 * Rename the root agent, and describe it.
 *
 * The root agent is not a row in agent_profiles, so PUT /api/agent/profiles/
 * [id] cannot reach it — it refuses the slug "default" outright, and the
 * create path used to tell the operator to "rename the root agent" on a page
 * that had no such control (T-0102, D24). This is that control's route.
 *
 * The name is PatterStage's own label. Nothing here writes a byte into the
 * agent's home: the files on disk are the agent's, the label is the
 * operator's, and keeping them apart is what makes the rename safe to offer.
 */
export async function PUT(request: NextRequest) {
  try {
    ensureDb();
    const bodyResult = await parseJsonBody(request);
    if (bodyResult instanceof NextResponse) return bodyResult;
    const { displayName, description } = bodyResult as {
      displayName?: unknown;
      description?: unknown;
    };

    const patch: Parameters<typeof updateAgentRoot>[0] = {};

    if (displayName !== undefined) {
      if (typeof displayName !== "string" || displayName.trim().length === 0) {
        return badRequest("Give the agent a name — an empty one leaves it unnamed everywhere it is shown.");
      }
      if (displayName.trim().length > MAX_NAME) {
        return badRequest(`Keep the name to ${MAX_NAME} characters or fewer.`);
      }
      patch.displayName = displayName.trim();
    }

    if (description !== undefined) {
      if (typeof description !== "string") {
        return badRequest("The description must be text.");
      }
      if (description.trim().length > MAX_DESCRIPTION) {
        return badRequest(`Keep the description to ${MAX_DESCRIPTION} characters or fewer.`);
      }
      patch.description = description.trim();
    }

    if (Object.keys(patch).length === 0) {
      return badRequest("Send a name or a description to change.");
    }

    const row = updateAgentRoot(patch);

    appendAuditLine({
      action: "agent.root.update",
      resource: "default",
      ok: true,
    });

    return ok({ success: true, displayName: row.displayName, description: row.description });
  } catch (error) {
    return serverErrorFromCatch(
      "PUT /api/agent/root",
      "renaming the root agent",
      error,
      "Failed to update the root agent",
    );
  }
}

export async function GET() {
  const row = getAgentRoot();
  return ok({ displayName: row.displayName, description: row.description });
}

export async function POST() {
  return methodNotAllowed(
    "The root agent already exists — send PUT to rename it", ["GET", "PUT"]);
}
