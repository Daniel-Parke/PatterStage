// GET /api/prefs, PUT /api/prefs: the console's own settings for this operator
// (T-0097). Six allow-listed keys with a schema each; the repository refuses
// anything else, so this route cannot become a free-form store. A PUT answers
// the whole map, the way the shell reads it on mount.

import type { NextRequest } from "next/server";

import { requireNotReadOnly } from "@/lib/api-auth";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { badRequest, ok } from "@/lib/api-response";
import { readOperatorPrefs, validateOperatorPref, writeOperatorPref } from "@/lib/operator-prefs-repository";

export async function GET() {
  try {
    return ok({ prefs: readOperatorPrefs() });
  } catch (error) {
    return serverErrorFromCatch("GET /api/prefs", "reading preferences", error, "Failed to read preferences");
  }
}

export async function PUT(request: NextRequest) {
  // The proxy refuses every write under read-only first; this names the thing.
  const refused = requireNotReadOnly("preferences");
  if (refused) return refused;

  const body = (await request.json().catch(() => null)) as { key?: unknown; value?: unknown } | null;
  if (!body || typeof body.key !== "string") {
    return badRequest("Body must be { key, value } with a key from the allow-list.");
  }
  const checked = validateOperatorPref(body.key, body.value);
  if (!checked.ok) return badRequest(checked.error);

  try {
    writeOperatorPref(checked.key, checked.value);
    return ok({ prefs: readOperatorPrefs() });
  } catch (error) {
    return serverErrorFromCatch("PUT /api/prefs", "writing a preference", error, "Failed to save the preference");
  }
}
