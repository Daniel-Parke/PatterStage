import { NextRequest, NextResponse } from "next/server";
import { writeFileSync } from "fs";
import { z } from "zod";

import { getActiveHermesPaths } from "@/modules/hermes/lib/agent-runtime";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { requireAuth } from "@/lib/api-auth";
import { appendAuditLine } from "@/lib/audit-log";
import { forbidden, ok } from "@/lib/api-response";
import { readCachedConfig, invalidateConfigCache } from "@/lib/config-cache";
import { dumpYamlConfig } from "@/lib/yaml-config";
import { CONFIG_SECTIONS } from "@/lib/config-schema";
import { maskApiKey } from "@/lib/secret-mask";
import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import { backupFile } from "@/lib/fs/fs-helpers";
import { deepMerge } from "@/lib/deep-merge";

// Dynamically derive writable sections from the schema
// Only YAML sections with editable fields are writable
const WRITABLE_SECTIONS = new Set(
  Object.entries(CONFIG_SECTIONS)
    .filter(([, def]) => def.type !== "file" && def.fields.length > 0)
    .map(([id]) => id)
);

// PUT body shape: a whitelisted section name + an object of values to
// merge in. `values` is `Record<string, unknown>` (free-form) because
// the per-section field validation lives in `config-schema.ts` (the
// client sends the typed section schema and the server just trusts the
// shape). `.strict()` rejects unknown top-level keys, matching the
// pre-refactor manual cast + `badRequest("Missing 'section' or 'values'")`.
// The section whitelist check is kept as a separate `forbidden()` branch
// below so the 403 message format is preserved (zod refine would lose
// the human-readable section list).
const configPutSchema = z
  .object({
    section: z.string().min(1),
    values: z.record(z.string(), z.unknown()),
  })
  .strict();

// Mask sensitive values in config before returning to client
function maskConfigSecrets(config: Record<string, unknown>): Record<string, unknown> {
  const clone = structuredClone(config);
  // Mask model.api_key
  if (clone.model && typeof clone.model === "object") {
    maskApiKeyField(clone.model as Record<string, unknown>, "api_key");
  }
  // Mask auxiliary.<task>.api_key — every task entry can carry a key
  if (clone.auxiliary && typeof clone.auxiliary === "object") {
    const aux = clone.auxiliary as Record<string, Record<string, unknown>>;
    for (const task of Object.keys(aux)) {
      maskApiKeyField(aux[task], "api_key");
    }
  }
  return clone;
}

/**
 * In-place replace `record[key]` with its masked form, but only if it's a
 * non-empty string. Centralises the `typeof === "string" && length > 0`
 * guard that the two model/auxiliary branches used to repeat.
 */
function maskApiKeyField(record: Record<string, unknown>, key: string): void {
  const value = record[key];
  if (typeof value === "string" && value.length > 0) {
    record[key] = maskApiKey(value);
  }
}

// GET /api/config — return full config (with secrets masked)
export async function GET(request: NextRequest) {
  // Auth check outside the main try/catch so it matches the PUT pattern
  // and so any future throw inside requireAuth would be classified as an
  // auth failure rather than a "reading config.yaml" error in the log.
  const auth = requireAuth(request);
  if (auth) return auth;
  try {
    const config = readCachedConfig();
    return ok(maskConfigSecrets(config));
  } catch (error) {
    return serverErrorFromCatch(
      "GET /api/config",
      "reading config.yaml",
      error,
      "Failed to read config.yaml",
    );
  }
}

// PUT /api/config — update specific section
export async function PUT(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const parsed = await parseAndValidateJsonBody(request, configPutSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { section, values } = parsed;

  // Non-writable section → 403 (zod refine surfaces the failure as
  // { message: "section_not_writable" } in zodErrorResponse, but we
  // need the custom `forbidden()` body with the section list to match
  // the pre-refactor message format).
  if (!WRITABLE_SECTIONS.has(section)) {
    return forbidden(
      `Section '${section}' is not writable. Allowed: ${[...WRITABLE_SECTIONS].join(", ")}`
    );
  }

  try {
    const paths = getActiveHermesPaths();

    // Create backup (no-op when config.yaml doesn't exist) — single call
    // to the canonical backupFile() helper replaces the 4-line inline
    // `existsSync + ensureDir + backupTimestamp + writeFileSync` block.
    backupFile(paths.config, paths.backups);

    const config = readCachedConfig();

    // Merge values into section — deep merge so a patch to a nested
    // object (e.g. `personalities.default`) preserves sibling keys.
    // The shallow `{...current, ...values}` form was a regression: any
    // PUT that touched a nested object wiped its siblings because the
    // spread replaced the whole nested object. See
    // `src/lib/deep-merge.ts` for the contract and tests.
    const current = (config[section] as Record<string, unknown>) || {};
    config[section] = deepMerge(current, values as Record<string, unknown>);

    // Write back
    const content = dumpYamlConfig(config);
    writeFileSync(paths.config, content, "utf-8");

    appendAuditLine({
      action: "config.put",
      resource: section,
      ok: true,
    });

    // Invalidate cache so next read picks up the change
    invalidateConfigCache();

    return ok({ success: true, section, values });
  } catch (error) {
    return serverErrorFromCatch(
      "PUT /api/config",
      "updating config",
      error,
      "Failed to update config",
    );
  }
}
