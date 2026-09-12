// ═══════════════════════════════════════════════════════════════
// API schemas + validation helpers
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { z } from "zod";

// The last core->module edge in the repo, and it is deliberate.
//
// The obvious "fix" is to move the provider list into core as PatterStage's own
// supported-provider registry. That would be WORSE. The list's own comment says
// its first fourteen entries must stay in lock-step with the agent CLI's
// --provider choices, so the coupling is real; moving the list would keep the
// coupling and make it invisible, which is the failure mode this whole boundary
// exists to prevent.
//
// The other reviewed option was widening providerSchema to z.string().min(1) and
// relocating the guard into one route. That weakens validation on every other
// caller to buy a boundary, which is a product change nobody asked for.
//
// So the edge stays, visible and gated. See org/decisions/ADR-0005-product-modules.md.
// design-lint-disable-next-line core-imports-no-module -- the provider list is genuinely the agent CLI's; moving it to core would hide the coupling rather than remove it
import { HERMES_PROVIDERS } from "@/modules/hermes/lib/providers";
import { TASK_TYPES, type TaskType } from "../models/task-types";
import { ANALYTICS_EVENT_TYPES } from "../analytics/event-types";

// ── Zod schemas for API request bodies ─────────────────────────

const nonEmpty = z.string().min(1);

/**
 * Query schema for GET /api/analytics/timeseries. `days` is clamped 1–365 to
 * bound the `datetime('now','-N days')` interpolation in the repository (the
 * only place a request value reaches a SQL interval), and `bucket` is a
 * forward-compatible enum (only "day" today).
 */
export const analyticsTimeseriesQuerySchema = z
  .object({
    type: z.enum(ANALYTICS_EVENT_TYPES).optional(),
    days: z.coerce.number().int().min(1).max(365).default(30),
    bucket: z.enum(["day"]).default("day"),
  })
  .strict();

/**
 * The `defaults` schema for the Models registry: task slot (one of
 * `TASK_TYPES`) → boolean. Derived from `TASK_TYPES` rather than hand-listed,
 * because a hand-listed copy drifted from it; adding a task slot is a one-line
 * edit in `@/lib/models/task-types`.
 *
 * `.strict()` so unknown task-slot keys are rejected
 * (e.g. `defaults: { typo: true }` → 400).
 */
function buildModelDefaultsSchema(): z.ZodType<Partial<Record<TaskType, boolean>>> {
  const shape: Record<TaskType, z.ZodOptional<z.ZodBoolean>> = {} as Record<
    TaskType,
    z.ZodOptional<z.ZodBoolean>
  >;
  for (const taskType of TASK_TYPES) {
    shape[taskType] = z.boolean().optional();
  }
  return z.object(shape).strict();
}

// ── Models registry ────────────────────────────────────────────

/**
 * Provider name validated against the canonical list in
 * src/modules/hermes/lib/providers.ts. Adding a new provider is a single edit
 * to that file. Inferred as `HermesProvider` (a literal union) so consumers
 * narrow without a cast.
 */
export const providerSchema = z.enum(HERMES_PROVIDERS);

/** Task slot (one of the 12 `TASK_TYPES`), inferred as the `TaskType` literal union. */
export const taskTypeSchema = z.enum(TASK_TYPES);

const modelDefaultsSchema = buildModelDefaultsSchema();

export const credentialPostSchema = z.object({
  label: nonEmpty,
  provider: providerSchema,
  apiKey: nonEmpty,
});

export const modelPostSchema = z.object({
  name: nonEmpty,
  provider: providerSchema,
  modelId: nonEmpty,
  
  baseUrl: z.string().optional().nullable(),
  contextLength: z.number().int().min(1000).max(2_000_000).optional().nullable(),
  credentialsId: z.string().optional().nullable(),
  defaults: modelDefaultsSchema.optional(),
}).strict();

export const modelPutSchema = z
  .object({
    name: z.string().min(1).optional(),
    provider: providerSchema.optional(),
    modelId: z.string().min(1).optional(),
    
    baseUrl: z.string().optional().nullable(),
    contextLength: z.number().int().min(1000).max(2_000_000).optional().nullable(),
    credentialsId: z.string().optional().nullable(),
    defaults: modelDefaultsSchema.optional(),
  })
  .strict();

export const setDefaultPutSchema = z
  .object({
    taskType: taskTypeSchema,
    modelId: z.string().nullable(),
  })
  .strict();

/**
 * POST /api/seed body shape. All four fields are optional; the
 * route applies defaults (`target: "all"`, `mode: "merge"`).
 *
 * The `id` key is a legacy alias for `templateId` — kept so old
 * clients / scripts that send `{ id: "..." }` continue to work; the
 * `.transform()` folds it back so `runCatalogSeed` receives a single
 * `templateId` field. Validating `target` here turns a foreign value
 * into a 400 with `details` instead of a less actionable runtime error
 * inside `runCatalogSeed`.
 */
export const seedPostSchema = z
  .object({
    target: z
      .enum(["all", "root", "profiles", "templates", "categories"])
      .optional(),
    mode: z.enum(["merge", "replace"]).optional(),
    slug: z.string().min(1).optional(),
    templateId: z.string().min(1).optional(),
    // Legacy alias — folded back to `templateId` by the .transform below.
    id: z.string().min(1).optional(),
  })
  .transform((value) => {
    const { id, templateId, ...rest } = value;
    return { ...rest, templateId: templateId ?? id };
  });

// ── Helper ─────────────────────────────────────────────────────

export function zodErrorResponse(error: z.ZodError): NextResponse {
  return NextResponse.json(
    {
      error: "Invalid request body",
      details: error.flatten(),
    },
    { status: 400 }
  );
}
