import { z } from "zod";

export const TEMPLATE_PACK_SCHEMA_VERSION = "1.0.0" as const;

const accentSchema = z.enum(["cyan", "purple", "green", "pink", "orange"]);

export const templatePackEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  icon: z.string(),
  color: accentSchema,
  category: z.string(),
  profile: z.string(),
  description: z.string(),
  prompt: z.string(),
  goals: z.array(z.string()),
  suggestedSkills: z.array(z.string()),
  // defaultModel + defaultProvider are pre-fill hints for the mission
  // form. Both are optional — when omitted, the dispatch falls back to
  // Control Hub DB's `agent` default (see src/lib/models-repository.ts).
  defaultModel: z.string().optional(),
  defaultProvider: z.string().optional(),
  timeoutMinutes: z.number().int().min(1).max(120),
});

export const templatePackManifestSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    id: z.string().min(1),
    name: z.string(),
    version: z.string(),
    author: z.string().optional(),
    description: z.string().optional(),
    templates: z.array(templatePackEntrySchema).min(1),
    extensions: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type TemplatePackManifestV1 = z.infer<typeof templatePackManifestSchema>;

export function parseTemplatePackManifestV1(
  input: unknown
): { ok: true; data: TemplatePackManifestV1 } | { ok: false; error: z.ZodError } {
  const r = templatePackManifestSchema.safeParse(input);
  if (!r.success) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}
