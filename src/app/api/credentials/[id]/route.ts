// ═══════════════════════════════════════════════════════════════
// DELETE /api/credentials/[id] — remove a provider credential
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

import type { NextRequest } from "next/server";

import { serverErrorFromCatch, logApiError } from "@/lib/api-logger";
import { notFound, ok, methodNotAllowed } from "@/lib/api-response";
import { appendAuditLine } from "@/lib/audit-log";
import {
  deleteCredential,
  getCredential,
  listCredentials,
} from "@/lib/credentials-repository";
import { listModels } from "@/lib/models-repository";
import { removeCredentialFromHermesEnv } from "@/modules/hermes/lib/hermes-env-sync";
import { isHermesProvider } from "@/modules/hermes/lib/providers";

interface Ctx {
  params: Promise<{ id: string }>;
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
    "GET is not supported here — /api/credentials lists credentials without their keys",
  );
}
