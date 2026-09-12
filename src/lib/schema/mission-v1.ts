import { z } from "zod";

const missionStatusSchema = z.enum([
  "queued",
  "dispatched",
  "successful",
  "failed",
]);

const dispatchModeSchema = z.enum(["save", "now", "cron", "queue"]);

/**
 * Mission record as persisted under PS_DATA_DIR/missions/{id}.json.
 * Forward-compatible fields may appear under `extensions` and must be ignored by validators.
 */
export const missionV1Schema = z
  .object({
    schemaVersion: z.literal("1.0.0").optional(),
    id: z.string().min(1),
    name: z.string(),
    prompt: z.string(),
    goals: z.array(z.string()),
    skills: z.array(z.string()),
    model: z.string(),
    profile: z.string(),
    missionTimeMinutes: z.number().int().min(5).max(120),
    timeoutMinutes: z.number().int().min(1).max(120),
    schedule: z.string(),
    templateId: z.string().nullable(),
    status: missionStatusSchema,
    dispatchMode: dispatchModeSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
    results: z.string().nullable(),
    duration: z.number().nullable(),
    error: z.string().nullable(),
    cronJobId: z.string().optional(),
    cronJob: z
      .object({
        state: z.string(),
        enabled: z.boolean(),
        lastRun: z.string().nullable(),
        lastStatus: z.string().nullable(),
        schedule: z.string().optional(),
      })
      .optional(),
    extensions: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

