// ═══════════════════════════════════════════════════════════════
// schema/generate.ts: the one place the committed JSON Schemas are built
//
// src/lib/schema/json/*.schema.json are contracts that LEAVE the repository:
// ADR-0002 decision 1 publishes them as the versioned shape that TypeScript
// and Python each implement. They are generated from the Zod sources and then
// committed, which only holds if generation and verification agree byte for
// byte.
//
// So both halves read this module and neither owns a serialiser of its own:
// scripts/tooling/generate-json-schema.ts writes what this returns, and
// tests/unit/schema-json-drift.test.ts fails the build when the committed
// files differ from it. A second copy of the serialisation would let the gate
// pass while agreeing only with itself.
// ═══════════════════════════════════════════════════════════════

import { toJSONSchema } from "zod";

import { missionV1Schema } from "./mission-v1";
import { templatePackManifestSchema } from "./template-pack-v1";

/**
 * Zod hangs a `~standard` marker off the schemas it emits. It is validator
 * bookkeeping, not part of the published contract, so it never reaches the file.
 */
function stripZodMeta(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stripZodMeta);
  const o = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (k === "~standard") continue;
    out[k] = stripZodMeta(v);
  }
  return out;
}

/** Exact file text: two-space JSON with the trailing newline the files carry. */
function serialise(title: string, description: string, schema: unknown): string {
  const body = stripZodMeta(schema) as Record<string, unknown>;
  return (
    JSON.stringify(
      {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        title,
        description,
        ...body,
      },
      null,
      2,
    ) + "\n"
  );
}

/**
 * Bare file name → the exact content that file must hold in
 * src/lib/schema/json/. Keyed by name rather than path because the directory
 * is the caller's business; the canary keys its generatedArtefacts surface the
 * same way, so relocating the directory stays neutral.
 */
export function buildSchemaJsonArtefacts(): Record<string, string> {
  return {
    "mission-v1.schema.json": serialise(
      "MissionV1",
      "Mission record under PS_DATA_DIR/missions/{id}.json. Generated from missionV1Schema (Zod).",
      toJSONSchema(missionV1Schema),
    ),
    "template-pack-v1.schema.json": serialise(
      "TemplatePackManifestV1",
      "Template pack manifest for marketplace imports. Generated from templatePackManifestSchema (Zod).",
      toJSONSchema(templatePackManifestSchema),
    ),
  };
}
