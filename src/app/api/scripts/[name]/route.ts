// ═══════════════════════════════════════════════════════════════
// /api/scripts/[name] — read / write / delete a host script's contents.
//   GET    → { name, content }
//   PUT    → upsert contents ({ content })  (create when new, else update)
//   DELETE → remove the script
// All path-validated under PS_DATA_DIR/scripts (scripts-manager). Writes are
// blocked in read-only mode. Powers the in-app script editor + examples gallery.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedHostWrites, isReadOnly } from "@/lib/api-auth";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, badRequest, notFound, serviceUnavailable } from "@/lib/api-response";
import { readOnlyMessage } from "@/lib/read-only";
import { parseJsonBody } from "@/lib/parse-json-body";
import {
  readScriptContent,
  writeScriptContent,
  deleteScriptFile,
} from "@/lib/scripts-manager";
import { recordEvent } from "@/lib/analytics/record-event";

type Ctx = { params: Promise<{ name: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  const { name } = await ctx.params;
  try {
    const content = readScriptContent(name);
    if (content === null) return notFound("Script not found");
    return ok({ name, content });
  } catch (error) {
    return serverErrorFromCatch("GET /api/scripts/[name]", name, error, "Failed to read script");
  }
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  // Written content is executed later by /api/scripts/run and by cron, so this
  // route must never be reachable without authentication.
  const hostWrites = requireAuthenticatedHostWrites();
  if (hostWrites) return hostWrites;
  if (isReadOnly()) return serviceUnavailable(readOnlyMessage("scripts cannot be edited or deleted"));

  const { name } = await ctx.params;
  const body = await parseJsonBody(request);
  if (body instanceof NextResponse) return body;
  const content = (body as { content?: unknown }).content;
  if (typeof content !== "string") return badRequest("content (string) is required");

  try {
    const exists = readScriptContent(name) !== null;
    const result = writeScriptContent(name, content, exists ? "update" : "create");
    if (!result.ok) return badRequest(result.error ?? "Failed to save script");
    recordEvent("script.saved", { entityType: "script", entityId: name, metadata: { created: result.created === true } });
    return ok({ name, created: result.created === true });
  } catch (error) {
    return serverErrorFromCatch("PUT /api/scripts/[name]", name, error, "Failed to save script");
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const hostWrites = requireAuthenticatedHostWrites();
  if (hostWrites) return hostWrites;
  if (isReadOnly()) return serviceUnavailable(readOnlyMessage("scripts cannot be edited or deleted"));

  const { name } = await ctx.params;
  try {
    const deleted = deleteScriptFile(name);
    if (!deleted) return notFound("Script not found");
    return ok({ name, deleted: true });
  } catch (error) {
    return serverErrorFromCatch("DELETE /api/scripts/[name]", name, error, "Failed to delete script");
  }
}
