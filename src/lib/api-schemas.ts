// ═══════════════════════════════════════════════════════════════
// API schemas + validation helpers
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { z } from "zod";

import { HERMES_PROVIDERS, TASK_TYPES } from "./hermes-providers";

// ── Zod schemas for API request bodies ─────────────────────────

const nonEmpty = z.string().min(1);

// ── Models registry ────────────────────────────────────────────

/**
 * Provider name validated against the canonical list in
 * src/lib/hermes-providers.ts. Adding a new provider is a single edit
 * to that file.
 */
export const providerSchema = z.enum(HERMES_PROVIDERS as readonly [string, ...string[]]);

export const taskTypeSchema = z.enum(TASK_TYPES as readonly [string, ...string[]]);

const modelDefaultsSchema = z
  .object({
    agent: z.boolean().optional(),
    hindsight: z.boolean().optional(),
    compression: z.boolean().optional(),
    vision: z.boolean().optional(),
    web_extract: z.boolean().optional(),
    session_search: z.boolean().optional(),
    title_generation: z.boolean().optional(),
    skills_hub: z.boolean().optional(),
    mcp: z.boolean().optional(),
    triage_specifier: z.boolean().optional(),
    approval: z.boolean().optional(),
    delegation: z.boolean().optional(),
  })
  .strict();

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
