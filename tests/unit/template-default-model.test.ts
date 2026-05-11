/**
 * Asserts built-in mission templates defer to the models registry agent default
 * when no explicit defaultModel is set, and that the v1 template-pack schema
 * accepts entries where these fields are optional.
 */

import { TEMPLATES, USE_REGISTRY_DEFAULT } from "@/lib/mission-helpers";
import {
  templatePackEntrySchema,
  parseTemplatePackManifestV1,
  TEMPLATE_PACK_SCHEMA_VERSION,
} from "@/lib/schema/template-pack-v1";

describe("template defaults", () => {
  it("every built-in template omits explicit defaultModel (defers to registry agent default)", () => {
    expect(TEMPLATES.length).toBe(3);
    for (const t of TEMPLATES) {
      // Templates must not hardcode a specific model — they defer to the registry agent default.
      // defaultModel may be undefined, null, or USE_REGISTRY_DEFAULT.
      const hasNoHardcodedModel =
        t.defaultModel == null || t.defaultModel === USE_REGISTRY_DEFAULT;
      expect(hasNoHardcodedModel).toBe(true);
      // defaultProvider must similarly be absent when defaultModel is absent.
      const hasNoProvider =
        (t.defaultModel == null && t.defaultProvider == null) ||
        (t.defaultModel === USE_REGISTRY_DEFAULT && t.defaultProvider == null);
      expect(hasNoProvider).toBe(true);
    }
  });
});

describe("template-pack-v1 schema", () => {
  it("defaultModel and defaultProvider are optional on entries", () => {
    const entry = {
      id: "no-model",
      name: "Bare",
      icon: "Bug",
      color: "cyan" as const,
      category: "x",
      profile: "y",
      description: "",
      prompt: "do a thing",
      goals: [],
      suggestedSkills: [],
      timeoutMinutes: 30,
    };
    const r = templatePackEntrySchema.safeParse(entry);
    expect(r.success).toBe(true);
  });

  it("accepts entries with defaultModel + defaultProvider", () => {
    const entry = {
      id: "with-model",
      name: "Set",
      icon: "Bug",
      color: "cyan" as const,
      category: "x",
      profile: "y",
      description: "",
      prompt: "do a thing",
      goals: [],
      suggestedSkills: [],
      defaultModel: "anthropic/claude-sonnet-4",
      defaultProvider: "anthropic",
      timeoutMinutes: 30,
    };
    const r = templatePackEntrySchema.safeParse(entry);
    expect(r.success).toBe(true);
  });

  it("parseTemplatePackManifestV1 round-trips a built-in template through the schema", () => {
    const sample = TEMPLATES[0];
    const manifest = {
      schemaVersion: TEMPLATE_PACK_SCHEMA_VERSION,
      id: "builtin-test-pack",
      name: "Test pack",
      version: "0.0.1",
      templates: [
        {
          id: sample.id,
          name: sample.name,
          icon: sample.icon,
          color: sample.color,
          category: sample.category,
          profile: sample.profile,
          description: sample.description,
          prompt: sample.instruction,
          goals: sample.goals,
          suggestedSkills: sample.suggestedSkills,
          // Built-in templates no longer carry defaultModel/defaultProvider.
          defaultModel: undefined,
          defaultProvider: undefined,
          timeoutMinutes: 30,
        },
      ],
    };
    const result = parseTemplatePackManifestV1(manifest);
    expect(result.ok).toBe(true);
  });
});
