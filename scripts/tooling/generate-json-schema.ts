/**
 * Emit JSON Schema artifacts from Zod (single source of truth).
 * Run: npm run generate:schema-json
 *
 * This script is only the write half. The shapes and their exact serialisation
 * live in src/lib/schema/generate.ts, which tests/unit/schema-json-drift.test.ts
 * reads too, so the drift gate cannot pass against a different serialiser than
 * the one that produced the committed files.
 */
import { mkdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { buildSchemaJsonArtefacts } from "../../src/lib/schema/generate";

const HERE = dirname(fileURLToPath(import.meta.url));
const JSON_DIR = resolve(HERE, "../../src/lib/schema/json");

function main(): void {
  mkdirSync(JSON_DIR, { recursive: true });

  for (const [name, content] of Object.entries(buildSchemaJsonArtefacts())) {
    writeFileSync(resolve(JSON_DIR, name), content);
  }

  console.log(`Wrote JSON Schema to ${JSON_DIR}`);
}

main();
