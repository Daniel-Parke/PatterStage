// ═══════════════════════════════════════════════════════════════
// /api/scripts/[name] — read / write / delete a host script's contents.
//   GET    → { name, content }
//   PUT    → upsert contents ({ content })  (create when new, else update)
//   DELETE → remove the script
// All path-validated under PS_DATA_DIR/scripts (scripts-manager). Writes are
// blocked in read-only mode. Powers the in-app script editor + examples gallery.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedHostWrites, isReadOnly } from "@/lib/api/api-auth";
import { ok, badRequest, notFound, serviceUnavailable } from "@/lib/api/api-response";
import { readOnlyMessage } from "@/lib/api/read-only";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import {
  readScriptContent,
  writeScriptContent,
  deleteScriptFile,
} from "@/lib/scripts/scripts-manager";
import { recordEvent } from "@/lib/analytics/record-event";
import { route } from "@/lib/api/api-route";

type Ctx = { params: Promise<{ name: string }> };

export const GET = route("GET /api/scripts/[name]", (p) => p.name, "Failed to read script", async (_request: NextRequest, ctx: Ctx) => {
  const { name } = await ctx.params;
  const content = readScriptContent(name);
  if (content === null) return notFound("Script not found");
  return ok({ name, content });
});

export const PUT = route("PUT /api/scripts/[name]", (p) => p.name, "Failed to save script", async (request: NextRequest, ctx: Ctx) => {
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
  const exists = readScriptContent(name) !== null;
  const result = writeScriptContent(name, content, exists ? "update" : "create");
  if (!result.ok) return badRequest(result.error ?? "Failed to save script");
  recordEvent("script.saved", { entityType: "script", entityId: name, metadata: { created: result.created === true } });
  return ok({ name, created: result.created === true });
});

export const DELETE = route("DELETE /api/scripts/[name]", (p) => p.name, "Failed to delete script", async (request: NextRequest, ctx: Ctx) => {
  const hostWrites = requireAuthenticatedHostWrites();
  if (hostWrites) return hostWrites;
  if (isReadOnly()) return serviceUnavailable(readOnlyMessage("scripts cannot be edited or deleted"));

  const { name } = await ctx.params;
  const deleted = deleteScriptFile(name);
  if (!deleted) return notFound("Script not found");
  return ok({ name, deleted: true });
});
