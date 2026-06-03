// ═══════════════════════════════════════════════════════════════
// /api/credentials — list + create provider credentials
// ═══════════════════════════════════════════════════════════════
//
// `apiKey` is NEVER returned in any response. List/get exposes
// `keyHint` only.
import { NextRequest, NextResponse } from "next/server";

import { listCredentials, createCredential, deleteCredential } from "@/lib/credentials-repository";
import { logApiError } from "@/lib/api-logger";
import { requireAuth } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/parse-json-body";
import { appendAuditLine } from "@/lib/audit-log";
import { zodErrorResponse, credentialPostSchema } from "@/lib/api-schemas";
import { serverError } from "@/lib/api-response";
import { syncCredentialToHermesEnv } from "@/lib/hermes-config-sync";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    return NextResponse.json({ data: { credentials: listCredentials() } });
  } catch (error) {
    logApiError("GET /api/credentials", "listing credentials", error);
    return serverError("Failed to list credentials");
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  // Hoist body parsing out of the main try/catch so malformed JSON returns
  // 400 (via parseJsonBody) rather than 500. Aligns with every other route
  // in the Models/Config/Fallbacks surface.
  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;
  const parsed = credentialPostSchema.safeParse(bodyResult);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  let createdId: string | null = null;
  try {
    const credential = createCredential(parsed.data);
    createdId = credential.id;
    // providerSchema narrows parsed.data.provider to HermesProvider, so no
    // defensive isHermesProvider() guard is needed. The previous widening
    // cast (`as HermesProvider`) was a workaround for the z.enum widening
    // cast on providerSchema; session 53 dropped the widening cast, so
    // the type now flows through without manual coercion.
    syncCredentialToHermesEnv({
      provider: parsed.data.provider,
      apiKey: parsed.data.apiKey,
    });
    appendAuditLine({ action: "credential.create", resource: credential.id, ok: true });
    return NextResponse.json({ data: { credential } }, { status: 201 });
  } catch (error) {
    if (createdId) {
      // Hermes write failed after the DB row was committed — roll back the row.
      try {
        deleteCredential(createdId);
      } catch (cleanupErr) {
        logApiError("POST /api/credentials", "rolling back credential after sync failure", cleanupErr);
      }
    }
    logApiError("POST /api/credentials", "creating credential", error);
    return serverError("Failed to create credential");
  }
}
