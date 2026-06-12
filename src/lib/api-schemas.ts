// ═══════════════════════════════════════════════════════════════
// API schemas + validation helpers
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { z } from "zod";

import { HERMES_PROVIDERS, TASK_TYPES, type TaskType } from "./hermes-providers";

// ── Zod schemas for API request bodies ─────────────────────────

const nonEmpty = z.string().min(1);

/**
 * Build the `defaults` schema for the Models registry. Each entry is a
 * task slot (one of `TASK_TYPES`) → boolean (whether the model claims
 * that slot as a default). The shape used to be hand-listed with 12
 * `z.boolean().optional()` lines that drifted from the canonical
 * `TASK_TYPES` array in `hermes-providers.ts`. Deriving it from
 * `TASK_TYPES` makes the schema a single source of truth: adding a new
 * task slot is a one-line edit in `hermes-providers.ts`, and the
 * Models POST/PUT body shape tracks automatically.
 *
 * `.strict()` is preserved from the inline form so unknown task-slot
 * keys are still rejected (e.g. `defaults: { typo: true }` → 400).
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
 * src/lib/hermes-providers.ts. Adding a new provider is a single edit
 * to that file.
 *
 * Inferred as `HermesProvider` (a literal union) so consumers like
 * `parsed.data.provider` narrow automatically — no `as HermesProvider`
 * cast needed at call sites. Previously widened to `string` via
 * `as readonly [string, ...string[]]`, which forced 3+ call sites
 * to cast back to the narrow type. (Session 53 refactor.)
 */
export const providerSchema = z.enum(HERMES_PROVIDERS);

/**
 * Task slot (one of the 12 `TASK_TYPES`). Infers as `TaskType` literal
 * union so consumers get narrow typing without an `as TaskType` cast.
 * (Session 53 refactor.)
 */
export const taskTypeSchema = z.enum(TASK_TYPES);

const modelDefaultsSchema = buildModelDefaultsSchema();

export const credentialPostSchema = z.object({
  label: nonEmpty,
  provider: providerSchema,
  apiKey: nonEmpty,
});

export const credentialPutSchema = z
  .object({
    label: z.string().min(1).optional(),
    provider: providerSchema.optional(),
    apiKey: z.string().optional(),
  })
  .strict();

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

/** Hermes-style schedule object (minimal contract for tests and validation). */
export const hermesScheduleObjectSchema = z
  .object({
    kind: z.string(),
    minutes: z.number().optional(),
    expr: z.string().optional(),
    run_at: z.string().optional(),
    display: z.string().optional(),
  })
  .passthrough();

/** Single persisted cron job shape aligned with Hermes `jobs.json` entries. */
export const hermesCronJobRecordSchema = z
  .object({
    id: nonEmpty,
    name: nonEmpty,
    prompt: z.string(),
    skills: z.array(z.string()),
    model: z.string(),
    schedule: z.union([hermesScheduleObjectSchema, z.string()]),
    schedule_display: z.string().optional(),
    repeat: z.union([
      z.object({
        times: z.number().nullable(),
        completed: z.number(),
      }),
      z.boolean(),
    ]),
    enabled: z.boolean(),
    state: z.string().optional(),
    deliver: z.string().optional(),
    script: z.string().nullable().optional(),
    created_at: z.string().optional(),
    next_run_at: z.string().nullable().optional(),
    last_run_at: z.string().nullable().optional(),
    last_status: z.string().nullable().optional(),
    mission_id: z.string().optional(),
    provider: z.string().optional(),
    base_url: z.string().optional(),
    profile: z.string().optional(),
    timeout: z.number().optional(),
  })
  .passthrough();

export const hermesJobsFileSchema = z.object({
  jobs: z.array(hermesCronJobRecordSchema),
  updated_at: z.string().optional(),
});

export type HermesJobsFile = z.infer<typeof hermesJobsFileSchema>;

export const cronPostBodySchema = z.union([
  z.object({ action: z.literal("pauseAll") }),
  z.object({
    name: nonEmpty,
    schedule: nonEmpty,
    prompt: nonEmpty,
    deliver: z.string().optional(),
    model: z.string().optional(),
    repeat: z.boolean().optional(),
    skills: z.array(z.string()).optional(),
    script: z.union([z.string(), z.null()]).optional(),
  }),
]);

export type CronPostBody = z.infer<typeof cronPostBodySchema>;

export const cronPutBodySchema = z.object({
  id: nonEmpty,
  action: z.enum(["pause", "resume", "run"]).optional(),
  name: z.string().optional(),
  prompt: z.string().optional(),
  skills: z.array(z.string()).optional(),
  model: z.string().optional(),
  deliver: z.string().optional(),
  enabled: z.boolean().optional(),
  schedule: z.string().optional(),
  schedule_display: z.string().optional(),
});

export type CronPutBody = z.infer<typeof cronPutBodySchema>;

export const missionPostBodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    name: z.string().optional(),
    prompt: z.string().optional(),
    goals: z.array(z.string()).optional(),
    skills: z.array(z.string()).optional(),
    model: z.string().optional(),
    profile: z.string().optional(),
    missionTimeMinutes: z.number().optional(),
    timeoutMinutes: z.number().optional(),
    schedule: z.string().optional(),
    dispatchMode: z.enum(["save", "now", "cron"]).optional(),
    templateId: z.string().optional(),
    base_url: z.string().optional(),
  }),
  z.object({
    action: z.literal("delete"),
    missionId: nonEmpty,
  }),
  z.object({
    action: z.literal("cancel"),
    missionId: nonEmpty,
  }),
  z.object({
    action: z.literal("update"),
    missionId: nonEmpty,
    name: z.string().optional(),
    prompt: z.string().optional(),
    goals: z.array(z.string()).optional(),
    skills: z.array(z.string()).optional(),
    profile: z.string().optional(),
    missionTimeMinutes: z.number().optional(),
    timeoutMinutes: z.number().optional(),
    schedule: z.string().optional(),
  }),
]);

export type MissionPostBody = z.infer<typeof missionPostBodySchema>;

/**
 * POST /api/seed body shape. All four fields are optional; the
 * route applies defaults (`target: "all"`, `mode: "merge"`).
 *
 * The `id` key is a legacy alias for `templateId` — kept so old
 * clients / scripts that send `{ id: "..." }` (instead of the
 * modern `{ templateId: "..." }`) continue to work. The route's
 * pre-refactor inline form used `typeof body.id === "string" ? body.id`
 * to fold the alias back to `templateId`; the same logic is preserved
 * via zod's `.transform()` so the downstream `runCatalogSeed` still
 * receives a single `templateId` field.
 *
 * Pre-refactor the route did `body.target as SeedTarget["target"]`
 * with no validation, so a foreign value (e.g. `target: "xss"`)
 * would silently reach `runCatalogSeed` and surface as a less
 * actionable runtime error. With the schema in place, a 400 with
 * the `details: error.flatten()` payload is returned at the
 * request-validation layer — strict improvement, aligned with the
 * `parseAndValidateJsonBody` migration that swept the rest of the
 * Models/Config surface in sessions 121 + 122.
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

export type SeedPostBody = z.infer<typeof seedPostSchema>;

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

// Synchronous JSON body parser with Zod validation for NextRequest.
// Returns { ok, data } or { ok: false, error: NextResponse } — never throws.
// Callers that need the ZodError directly should use the pattern:
//   let raw: unknown; try { raw = await request.json(); } catch { return 400; }
//   const parsed = schema.safeParse(raw);
//   if (!parsed.success) return zodErrorResponse(parsed.error);
