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
import { appendAuditLine } from "@/lib/audit-log";
import { zodErrorResponse, credentialPostSchema } from "@/lib/api-schemas";
import { syncCredentialToHermesEnv } from "@/lib/hermes-config-sync";
import { isHermesProvider, type HermesProvider } from "@/lib/hermes-providers";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    return NextResponse.json({ data: { credentials: listCredentials() } });
  } catch (error) {
    logApiError("GET /api/credentials", "listing credentials", error);
    return NextResponse.json({ error: "Failed to list credentials" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = credentialPostSchema.safeParse(raw);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  let createdId: string | null = null;
  try {
    const credential = createCredential(parsed.data);
    createdId = credential.id;
    if (isHermesProvider(parsed.data.provider)) {
      syncCredentialToHermesEnv({
        provider: parsed.data.provider as HermesProvider,
        apiKey: parsed.data.apiKey,
      });
    }
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
    return NextResponse.json({ error: "Failed to create credential" }, { status: 500 });
  }
}
