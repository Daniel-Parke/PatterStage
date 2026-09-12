// ═══════════════════════════════════════════════════════════════
// /api/artifacts/[id] — read (with content) + delete one artifact
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";

import { ok, notFound } from "@/lib/api/api-response";
import { deleteArtifact, getArtifact } from "@/lib/runs/artifacts-repository";
import { recordEvent } from "@/lib/analytics/record-event";
import { route } from "@/lib/api/api-route";

interface Ctx {
  params: Promise<{ id: string }>;
}

export const GET = route("GET /api/artifacts/[id]", (p) => `id=${p.id}`, "Failed to read artifact", async (request: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const artifact = getArtifact(id);
  if (!artifact) return notFound("Artifact not found");
  // A read event, which is the exception rather than the rule in this ledger
  // (operator ruling, T-0111): the Artifacts sheet calls this handler when it
  // opens one, so this is where "the operator read their artifact" is
  // actually knowable. After the lookup, so a 404 leaves no trace.
  // recordEvent no-ops under PS_READ_ONLY and swallows its own failures.
  recordEvent("artifact.opened", { entityType: "artifact", entityId: id });
  return ok({ artifact });
});

export const DELETE = route("DELETE /api/artifacts/[id]", (p) => `id=${p.id}`, "Failed to delete artifact", async (request: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const deleted = deleteArtifact(id);
  if (!deleted) return notFound("Artifact not found");
  return ok({ deleted: true });
});
