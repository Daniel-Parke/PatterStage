// ═══════════════════════════════════════════════════════════════
// /api/credentials/[id] — rotate or remove one provider credential
//
// PATCH replaces the stored key. Before it existed the only way to change a
// key that had leaked or expired was to delete the credential and add it
// again, which unlinked every model pointing at it (T-0100, D14). The row and
// the Hermes .env variable move together, and if the .env write fails the row
// is put back: half a rotation is a credential nobody can use.
//
// DELETE removes a provider credential.
//
// Every piece of this existed before the route did. `deleteCredential` was the
// rollback path of POST /api/credentials, `removeCredentialFromHermesEnv` was
// production code whose docstring already said "Used when a credential is
// deleted", and `models.credentials_id` has been ON DELETE SET NULL since
// migration 001. Only the door was missing (QA finding 17, operator ruling 3).
//
// TWO THINGS IT HAS TO GET RIGHT.
//
// The `.env` var is keyed by PROVIDER and the row is not. `upsertCredential`'s
// docstring claims a unique constraint on `provider`; there is none —
// migration 001 creates a plain index — so two OpenAI keys can coexist and
// share OPENAI_API_KEY. The variable is therefore removed only when no
// credential for that provider survives the delete.
//
// And a model attached to the deleted credential is unlinked silently by the
// foreign key, failing at its next call. It is named in the response, at the
// one moment the operator can still change their mind. As information, never
// as a veto: refusing to delete a key that is in use would make it impossible
// to remove exactly when removing it matters most.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { serverErrorFromCatch, logApiError } from "@/lib/api-logger";
import { notFound, ok, methodNotAllowed } from "@/lib/api-response";
import { appendAuditLine } from "@/lib/audit-log";
import {
  deleteCredential,
  getCredential,
  getCredentialWithKey,
  listCredentials,
  updateCredential,
} from "@/lib/credentials-repository";
import { listModels } from "@/lib/models-repository";
import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import {
  removeCredentialFromHermesEnv,
  syncCredentialToHermesEnv,
} from "@/modules/hermes/lib/hermes-env-sync";
import { envVarForProvider, isHermesProvider } from "@/modules/hermes/lib/providers";

interface Ctx {
  params: Promise<{ id: string }>;
}

// The key and nothing else. `.trim()` before `.min(1)` so "   " is refused
// here rather than reaching updateCredential, which reads a blank key as
// "leave it alone" and would answer 200 to a rotation that never happened.
// No provider and no label: a rotation replaces the secret, and letting it
// move the provider would silently orphan the .env variable it wrote before.
const credentialPatchSchema = z
  .object({
    apiKey: z.string().trim().min(1),
  })
  .strict();

// No auth or read-only call here, and that is deliberate: src/proxy.ts
// authenticates every request and refuses unsafe methods under PS_READ_ONLY
// before a handler runs.
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsed = await parseAndValidateJsonBody(request, credentialPatchSchema);
  if (parsed instanceof NextResponse) return parsed;
  const apiKey = parsed.apiKey;

  try {
    // The previous key is read first, because it is what the restore below
    // needs and it stops existing the moment the row is rewritten.
    const existing = getCredentialWithKey(id);
    if (!existing) return notFound("Credential not found");

    const credential = updateCredential(id, { apiKey });
    if (!credential) return notFound("Credential not found");

    const provider = existing.provider;
    let envVarUpdated = false;
    try {
      // A provider Hermes does not know, or one that authenticates by OAuth
      // (nous), has no variable to write. Guarded rather than caught, because
      // the sync throws on both and a throw here would roll back a rotation
      // that was entirely successful.
      if (isHermesProvider(provider) && envVarForProvider(provider)) {
        syncCredentialToHermesEnv({ provider, apiKey });
        envVarUpdated = true;
      }
    } catch (error) {
      // Put the old key back. Hermes still holds the previous key, so leaving
      // the new one in the row would give the operator a credential that reads
      // as rotated and authenticates as nothing.
      try {
        updateCredential(id, { apiKey: existing.apiKey });
      } catch (restoreError) {
        logApiError(
          "PATCH /api/credentials/[id]",
          "restoring the previous key after a failed .env write",
          restoreError,
        );
      }
      throw error;
    }

    appendAuditLine({ action: "credential.rotate", resource: id, ok: true });

    // The summary, never the key: this route's whole reason for having no GET
    // is that no response in this surface carries one.
    return ok({ credential, envVarUpdated });
  } catch (error) {
    return serverErrorFromCatch(
      "PATCH /api/credentials/[id]",
      `id=${id}`,
      error,
      "Failed to rotate credential",
    );
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const credential = getCredential(id);
    if (!credential) return notFound("Credential not found");

    // Read the attachments BEFORE the delete, while the link still exists.
    const orphanedModels = listModels()
      .filter((m) => m.credentialsId === id)
      .map((m) => m.modelId);

    if (!deleteCredential(id)) return notFound("Credential not found");

    let envRemoved = false;
    let envError: string | null = null;
    const siblingRemains = listCredentials().some((c) => c.provider === credential.provider);
    // Guarded rather than cast. `credentials.provider` is a plain TEXT column,
    // so a row written before the provider list existed -- or by hand -- can
    // hold a value the env-sync does not know. It throws on those, and the row
    // deletion has already happened, so an unguarded call would turn a
    // successful delete into a 500.
    if (!siblingRemains && isHermesProvider(credential.provider)) {
      try {
        removeCredentialFromHermesEnv(credential.provider);
        envRemoved = true;
      } catch (error) {
        // The row is gone, which is what was asked for and what happened. A 500
        // here would deny a deletion that took, and invite a retry that 404s
        // (the T-0082 lesson). The failure is reported in the body instead.
        logApiError("DELETE /api/credentials/[id]", "removing credential from Hermes .env", error);
        envError = error instanceof Error ? error.message : String(error);
      }
    }

    appendAuditLine({ action: "credential.delete", resource: id, ok: true });

    return ok({
      deleted: true,
      provider: credential.provider,
      // Said out loud either way, so the operator never has to infer which
      // happened from the absence of a message.
      envVarRemoved: envRemoved,
      envVarKeptForSibling: siblingRemains,
      envError,
      orphanedModels,
    });
  } catch (error) {
    return serverErrorFromCatch(
      "DELETE /api/credentials/[id]",
      `id=${id}`,
      error,
      "Failed to delete credential",
    );
  }
}

// GET is not supported, and the reason is the point: this route addresses a
// secret. `apiKey` is never returned by any response in this surface, so a
// per-credential read would exist only to tempt one into being added.
export async function GET() {
  return methodNotAllowed(
    "GET is not supported here — /api/credentials lists credentials without their keys", ["PATCH", "DELETE"]);
}
