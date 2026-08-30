// ═══════════════════════════════════════════════════════════════
// /api/artifacts — list + manually create artifacts (the registry)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok } from "@/lib/api-response";
import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import {
  createArtifact,
  listArtifacts,
  type ArtifactSourceKind,
} from "@/lib/artifacts-repository";

const SOURCE_KINDS = ["research", "composer", "mission", "chat", "manual"] as const;

const createSchema = z
  .object({
    sourceKind: z.enum(SOURCE_KINDS).default("manual"),
    sourceRunId: z.string().max(200).optional(),
    sourceNodeId: z.string().max(200).optional(),
    name: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    mimeType: z.string().max(100).optional(),
    content: z.string().min(1).max(2_000_000),
    tags: z.array(z.string().max(50)).max(20).optional(),
  })
  .strict();

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const kindParam = sp.get("kind");
    const kind = (SOURCE_KINDS as readonly string[]).includes(kindParam ?? "")
      ? (kindParam as ArtifactSourceKind)
      : undefined;
    const artifacts = listArtifacts({
      sourceKind: kind,
      sourceRunId: sp.get("runId") ?? undefined,
    });
    return ok({ artifacts });
  } catch (error) {
    return serverErrorFromCatch("GET /api/artifacts", "listing artifacts", error, "Failed to list artifacts");
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseAndValidateJsonBody(request, createSchema);
  if (parsed instanceof NextResponse) return parsed;
  try {
    const artifact = createArtifact({
      sourceKind: parsed.sourceKind,
      sourceRunId: parsed.sourceRunId ?? null,
      sourceNodeId: parsed.sourceNodeId ?? null,
      name: parsed.name,
      description: parsed.description ?? null,
      mimeType: parsed.mimeType,
      content: parsed.content,
      tags: parsed.tags,
    });
    return ok({ artifact });
  } catch (error) {
    return serverErrorFromCatch("POST /api/artifacts", "creating artifact", error, "Failed to save artifact");
  }
}
