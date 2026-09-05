// ═══════════════════════════════════════════════════════════════
// /api/credentials — list + create provider credentials
// ═══════════════════════════════════════════════════════════════
//
// `apiKey` is NEVER returned in any response. List/get exposes
// `keyHint` only.
import { NextRequest, NextResponse } from "next/server";

import { listCredentials, createCredential, deleteCredential } from "@/lib/credentials-repository";
import { logApiError, serverErrorFromCatch } from "@/lib/api-logger";

import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import { appendAuditLine } from "@/lib/audit-log";
import { credentialPostSchema } from "@/lib/api-schemas";
import { badRequest, created, ok } from "@/lib/api-response";
import { syncCredentialToHermesEnv } from "@/modules/hermes/lib/hermes-env-sync";
import { envVarForProvider } from "@/modules/hermes/lib/providers";
import { recordEvent } from "@/lib/analytics/record-event";

export async function GET(_request: NextRequest) {
  try {
    return ok({ credentials: listCredentials() });
  } catch (error) {
    return serverErrorFromCatch(
      "GET /api/credentials",
      "listing credentials",
      error,
      "Failed to list credentials",
    );
  }
}

export async function POST(request: NextRequest) {
  // Hoist body parsing out of the main try/catch so malformed JSON returns
  // 400 (via parseAndValidateJsonBody) rather than 500. Aligns with every
  // other route in the Models/Config/Fallbacks surface.
  const parsed = await parseAndValidateJsonBody(request, credentialPostSchema);
  if (parsed instanceof NextResponse) return parsed;

  // A provider with no variable to write has nowhere to keep a key. Before
  // this the row was created, the env sync threw, and the rollback deleted it
  // again -- a 500 for a request that was never going to work (T-0100, D15).
  if (envVarForProvider(parsed.provider) === "") {
    return badRequest(
      `${parsed.provider} authenticates with OAuth (hermes model); it has no API key to store`,
    );
  }

  let createdId: string | null = null;
  try {
    const credential = createCredential(parsed);
    createdId = credential.id;
    // credentialPostSchema narrows parsed.provider to HermesProvider, so no
    // defensive isHermesProvider() guard is needed. The previous widening
    // cast (`as HermesProvider`) was a workaround for the z.enum widening
    // cast on providerSchema; session 53 dropped the widening cast, so
    // the type now flows through without manual coercion.
    syncCredentialToHermesEnv({
      provider: parsed.provider,
      apiKey: parsed.apiKey,
    });
    appendAuditLine({ action: "credential.create", resource: credential.id, ok: true });
    // After the row AND the env write: a key the agent cannot read is not added (T-0098).
    recordEvent("credential.added", { entityType: "credential", entityId: credential.id, metadata: { provider: parsed.provider } });
    return created({ credential });
  } catch (error) {
    if (createdId) {
      // Hermes write failed after the DB row was committed — roll back the row.
      try {
        deleteCredential(createdId);
      } catch (cleanupErr) {
        logApiError("POST /api/credentials", "rolling back credential after sync failure", cleanupErr);
      }
    }
    return serverErrorFromCatch(
      "POST /api/credentials",
      "creating credential",
      error,
      "Failed to create credential",
    );
  }
}
