import { z } from "zod";

/** Whitelisted fields for fallback behaviour config (SQLite + Hermes agent.*). */
export const fallbackConfigPutSchema = z.object({
  restorePrimaryOnFallback: z.boolean().optional(),
  fallbackNotification: z.boolean().optional(),
  apiMaxRetries: z.number().int().min(0).max(10).optional(),
});

export const fallbackSyncPostSchema = z.object({
  config: fallbackConfigPutSchema.optional(),
});

/** Shared input schema for creating a fallback chain entry. */
export const fallbackInputSchema = z.object({
  modelId: z.string().min(1),
  position: z.number().int().min(0).optional(),
  enabled: z.boolean().optional(),
  overrideBaseUrl: z.string().nullable().optional(),
});

/** Shared input schema for updating a fallback chain entry. */
export const fallbackEntryPutSchema = z.object({
  modelId: z.string().min(1).optional(),
  position: z.number().int().min(0).optional(),
  enabled: z.boolean().optional(),
  overrideBaseUrl: z.string().nullable().optional(),
});

/** Shared input schema for toggling a fallback entry. */
export const fallbackToggleSchema = z.object({
  id: z.string(),
  enabled: z.boolean(),
});

/** Shared input schema for reordering a fallback entry. */
export const fallbackReorderSchema = z.object({
  entryId: z.string().min(1),
  direction: z.enum(["up", "down"]),
});

/** Input schema for adding a custom (non-registry) fallback model. */
export const customFallbackInputSchema = z.object({
  modelName: z.string().min(1),
  provider: z.string().min(1),
  modelIdString: z.string().min(1),
  position: z.number().int().min(0).optional(),
  enabled: z.boolean().optional(),
  overrideBaseUrl: z.string().nullable().optional(),
});

export type FallbackConfigPutInput = z.infer<typeof fallbackConfigPutSchema>;
export type FallbackInput = z.infer<typeof fallbackInputSchema>;
export type FallbackEntryPut = z.infer<typeof fallbackEntryPutSchema>;
export type FallbackToggle = z.infer<typeof fallbackToggleSchema>;
