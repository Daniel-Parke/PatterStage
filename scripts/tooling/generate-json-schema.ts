/**
 * Emit JSON Schema artifacts from Zod (single source of truth).
 * Run: npm run generate:schema-json
 */
import { mkdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { toJSONSchema } from "zod";
import { missionV1Schema } from "../../src/lib/schema/mission-v1";
import { templatePackManifestSchema } from "../../src/lib/schema/template-pack-v1";

const HERE = dirname(fileURLToPath(import.meta.url));
const JSON_DIR = resolve(HERE, "../../src/lib/schema/json");

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

function main(): void {
  mkdirSync(JSON_DIR, { recursive: true });

  const mission = stripZodMeta(toJSONSchema(missionV1Schema)) as Record<string, unknown>;
  writeFileSync(
    resolve(JSON_DIR, "mission-v1.schema.json"),
    JSON.stringify(
      {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        title: "MissionV1",
        description:
          "Mission record under PS_DATA_DIR/missions/{id}.json. Generated from missionV1Schema (Zod).",
        ...mission,
      },
      null,
      2
    ) + "\n"
  );

  const pack = stripZodMeta(toJSONSchema(templatePackManifestSchema)) as Record<string, unknown>;
  writeFileSync(
    resolve(JSON_DIR, "template-pack-v1.schema.json"),
    JSON.stringify(
      {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        title: "TemplatePackManifestV1",
        description:
          "Template pack manifest for marketplace imports. Generated from templatePackManifestSchema (Zod).",
        ...pack,
      },
      null,
      2
    ) + "\n"
  );

  console.log(`Wrote JSON Schema to ${JSON_DIR}`);
}

main();
