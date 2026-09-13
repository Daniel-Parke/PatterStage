// GET /api/prefs, PUT /api/prefs: the console's own settings for this operator
// (T-0097). Six allow-listed keys with a schema each; the repository refuses
// anything else, so this route cannot become a free-form store. A PUT answers
// the whole map, the way the shell reads it on mount.

import type { NextRequest } from "next/server";

import { badRequest, ok } from "@/lib/api/api-response";
import { readOperatorPrefs, validateOperatorPref, writeOperatorPref } from "@/lib/system/operator-prefs-repository";
import { route } from "@/lib/api/api-route";

export const GET = route("GET /api/prefs", "reading preferences", "Failed to read preferences", async () => {
  return ok({ prefs: readOperatorPrefs() });
});

export const PUT = route("PUT /api/prefs", "writing a preference", "Failed to save the preference", async (request: NextRequest) => {
  const body = (await request.json().catch(() => null)) as { key?: unknown; value?: unknown } | null;
  if (!body || typeof body.key !== "string") {
    return badRequest("Body must be { key, value } with a key from the allow-list.");
  }
  const checked = validateOperatorPref(body.key, body.value);
  if (!checked.ok) return badRequest(checked.error);
  writeOperatorPref(checked.key, checked.value);
  return ok({ prefs: readOperatorPrefs() });
});
