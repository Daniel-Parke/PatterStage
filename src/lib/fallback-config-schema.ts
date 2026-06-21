import { z } from "zod";

/** Whitelisted fields for fallback behaviour config (SQLite + Hermes agent.*). */
export const fallbackConfigPutSchema = z.object({
  restorePrimaryOnFallback: z.boolean().optional(),
  fallbackNotification: z.boolean().optional(),
  apiMaxRetries: z.number().int().min(0).max(10).optional(),
});

/** Shared input schema for updating a fallback chain entry (PUT /[id]). */
export const fallbackEntryPutSchema = z.object({
  modelId: z.string().min(1).optional(),
  position: z.number().int().min(0).optional(),
  enabled: z.boolean().optional(),
  overrideBaseUrl: z.string().nullable().optional(),
});

// The former per-action schemas (fallbackInputSchema / fallbackToggleSchema /
// fallbackReorderSchema / customFallbackInputSchema / fallbackSyncPostSchema)
// were folded into the single `fallbackActionSchema` discriminated union
// below when the 5 POST sub-routes were consolidated into one action route.

/**
 * Consolidated POST body for /api/models/fallbacks. The five former
 * sub-routes (add/toggle/reorder/custom/import/sync) collapse into a
 * single `action`-discriminated union validated here.
 *
 * Two field names are fixed vs. the old per-route schemas to match what
 * the sole consumer (useModelsPage) actually sends — the old routes were
 * unreachable 400s:
 *   • toggle uses `entryId` (the old fallbackToggleSchema required `id`)
 *   • custom uses `name` + `baseUrl` (the old customFallbackInputSchema
 *     required `modelName` + `overrideBaseUrl`)
 */
export const fallbackActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    modelId: z.string().min(1),
    position: z.number().int().min(0).optional(),
    enabled: z.boolean().optional(),
    overrideBaseUrl: z.string().nullable().optional(),
  }),
  z.object({
    action: z.literal("toggle"),
    entryId: z.string().min(1),
    enabled: z.boolean(),
  }),
  z.object({
    action: z.literal("reorder"),
    entryId: z.string().min(1),
    direction: z.enum(["up", "down"]),
  }),
  z.object({
    action: z.literal("custom"),
    name: z.string().min(1),
    provider: z.string().min(1),
    modelIdString: z.string().min(1),
    position: z.number().int().min(0).optional(),
    enabled: z.boolean().optional(),
    baseUrl: z.string().nullable().optional(),
  }),
  z.object({
    action: z.literal("import"),
    overwrite: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("sync"),
    config: fallbackConfigPutSchema.optional(),
  }),
]);

export type FallbackConfigPutInput = z.infer<typeof fallbackConfigPutSchema>;
