import { existsSync, readFileSync } from "fs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAgentWorkspace } from "@/lib/runtime/workspace";
import { writeHermesConfigFile } from "@/modules/hermes/lib/hermes-config-write";
import { loadHermesConfigFromString } from "@/modules/hermes/lib/hermes-config-read";
import { toError } from "@/lib/api-fetch";
import { logApiError, serverErrorFromCatch } from "@/lib/api-logger";

import { appendAuditLine } from "@/lib/audit-log";
import { conflict, forbidden, ok } from "@/lib/api-response";
import { readCachedConfigResult } from "@/lib/config-cache";
import { dumpYamlConfig } from "@/lib/yaml-config";
import { CONFIG_SECTIONS } from "@/lib/config-schema";
import { maskSecretsDeep } from "@/lib/secret-mask";
import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import { backupFile } from "@/lib/fs/fs-helpers";
import { deepMerge } from "@/lib/deep-merge";
import { recordEvent } from "@/lib/analytics/record-event";

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

// Mask sensitive values in config before returning to client.
//
// A walk over the whole document, not a list of shapes: the list here used to
// name `model.api_key` and `auxiliary.<task>.api_key`, and the key under
// `fallback_providers[].api_key` went to the browser in plaintext (T-0095, D74).
function maskConfigSecrets(config: Record<string, unknown>): Record<string, unknown> {
  return maskSecretsDeep(config);
}

// GET /api/config — return full config (with secrets masked)
export async function GET(_request: NextRequest) {
  // No auth or read-only check here, and that is deliberate: src/proxy.ts
  // authenticates every request and refuses unsafe methods under PS_READ_ONLY
  // before a handler runs. This comment used to describe a `requireAuth` call
  // sitting outside the try/catch; both the call and the function were deleted
  // in T-0048, and the comment outlived them.
  try {
    // Read the truth here rather than borrowing the monitor's config.yaml_error
    // stat: that source has a 60s staleness budget, so a gate built on it would
    // be up to a minute wrong in BOTH directions. An operator who has just
    // repaired the YAML would face a dead Save for a minute, and one who has
    // just broken it would get a live Save.
    const { config, error: configError } = readCachedConfigResult();
    return ok(maskConfigSecrets(config), configError ? { configError } : undefined);
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
    const paths = getAgentWorkspace();

    // Create backup (no-op when config.yaml doesn't exist) — single call
    // to the canonical backupFile() helper replaces the 4-line inline
    // `existsSync + ensureDir + backupTimestamp + writeFileSync` block.
    //
    // It stays HERE, ahead of the parse below, and the ordering is load-bearing.
    // It is the only reason the pre-T-0060 defect was recoverable rather than
    // terminal, it is the path the refusal names, and if the refusal itself ever
    // has a bug this is the net underneath it. Mirrors config-sync.ts:61.
    const backupPath = backupFile(paths.config, paths.backups);

    // Parse from disk, synchronously, and refuse if it will not parse.
    //
    // NOT readCachedConfig(): it degrades a YAML parse error to {} , which is
    // right for the GET above and catastrophic four lines above a write. Merging
    // into that {} and writing the result is how a config.yaml holding models,
    // providers, fallback chains and toolsets became 23 bytes while this route
    // answered 200 (T-0060). The cache is the second reason: within its 15s TTL
    // it holds the config as it was BEFORE the corruption, so a cache-based
    // check would see nothing wrong and silently replace the operator's broken
    // file with a stale snapshot, discarding whatever they were mid-way through
    // hand-editing.
    //
    // This is the shape src/modules/hermes/lib/config-sync.ts:69-80 has always
    // used on the same file. Two sites is not three: the shape is mirrored, not
    // extracted (see the Rule of Three in src/lib/api-response.ts).
    const raw = existsSync(paths.config) ? readFileSync(paths.config, "utf-8") : "";
    let config: Record<string, unknown>;
    try {
      config = loadHermesConfigFromString(raw) as Record<string, unknown>;
    } catch (err) {
      // FIRST LINE ONLY. The rest of a js-yaml message quotes the offending
      // lines of config.yaml, and this route masks api_key on the way out
      // (maskConfigSecrets) for exactly that reason. The whole message goes to
      // the server log, where config-sync.ts already puts it.
      const firstLine = toError(err).message.split("\n")[0];
      logApiError("PUT /api/config", "parsing config.yaml before merge", err);
      appendAuditLine({
        action: "config.put",
        resource: section,
        ok: false,
        detail: `refused: config.yaml did not parse (${firstLine})`,
      });
      return conflict(
        `config.yaml did not parse, so the '${section}' update was refused rather than ` +
          `written over it: ${firstLine}.` +
          (backupPath
            ? ` The file as found was copied to ${backupPath}. Repair the YAML and retry.`
            : ` Repair the YAML and retry.`),
      );
    }

    // Merge values into section — deep merge so a patch to a nested
    // object (e.g. `personalities.default`) preserves sibling keys.
    // The shallow `{...current, ...values}` form was a regression: any
    // PUT that touched a nested object wiped its siblings because the
    // spread replaced the whole nested object. See
    // `src/lib/deep-merge.ts` for the contract and tests.
    const current = (config[section] as Record<string, unknown>) || {};
    config[section] = deepMerge(current, values as Record<string, unknown>);

    // Write back through the one config.yaml writer. It drops the read
    // cache in the same call, so the next GET sees this change instead of
    // waiting out the 15s TTL. This route used to write with a raw
    // writeFileSync and then invalidate on the next line, which worked
    // right up until a writer forgot, and an enumerated list of writers is
    // how WO-0006's gap opened in the first place (WG-ARCH-003).
    const content = dumpYamlConfig(config);
    writeHermesConfigFile(paths.config, content);
    recordEvent("config.saved", { entityType: "config", entityId: section });

    appendAuditLine({
      action: "config.put",
      resource: section,
      ok: true,
    });

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
