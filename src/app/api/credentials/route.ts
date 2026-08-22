// ═══════════════════════════════════════════════════════════════
// /api/credentials — list + create provider credentials
// ═══════════════════════════════════════════════════════════════
//
// `apiKey` is NEVER returned in any response. List/get exposes
// `keyHint` only.
import { NextRequest, NextResponse } from "next/server";

import { listCredentials, createCredential, deleteCredential } from "@/lib/credentials-repository";
import { logApiError, serverErrorFromCatch } from "@/lib/api-logger";
import { requireAuth } from "@/lib/api-auth";
import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import { appendAuditLine } from "@/lib/audit-log";
import { credentialPostSchema } from "@/lib/api-schemas";
import { created, ok } from "@/lib/api-response";
import { syncCredentialToHermesEnv } from "@/modules/hermes/lib/hermes-env-sync";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

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
  const auth = requireAuth(request);
  if (auth) return auth;

  // Hoist body parsing out of the main try/catch so malformed JSON returns
  // 400 (via parseAndValidateJsonBody) rather than 500. Aligns with every
  // other route in the Models/Config/Fallbacks surface.
  const parsed = await parseAndValidateJsonBody(request, credentialPostSchema);
  if (parsed instanceof NextResponse) return parsed;

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
