// ═══════════════════════════════════════════════════════════════
// /api/artifacts/[id] — read (with content) + delete one artifact
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, notFound } from "@/lib/api-response";
import { deleteArtifact, getArtifact } from "@/lib/artifacts-repository";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const artifact = getArtifact(id);
    if (!artifact) return notFound("Artifact not found");
    return ok({ artifact });
  } catch (error) {
    return serverErrorFromCatch("GET /api/artifacts/[id]", `id=${id}`, error, "Failed to read artifact");
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const deleted = deleteArtifact(id);
    if (!deleted) return notFound("Artifact not found");
    return ok({ deleted: true });
  } catch (error) {
    return serverErrorFromCatch("DELETE /api/artifacts/[id]", `id=${id}`, error, "Failed to delete artifact");
  }
}
