import type { NextRequest } from "next/server";

import { getAuthMode, readAuthToken, SESSION_COOKIE, tokenMatches } from "@/lib/api/auth-token";
import { validateBrowserSession } from "./session-store";

/** Recheck the actual caller credential. An internal request header is never authority. */
export function streamAuthorizer(request: NextRequest): () => boolean {
  if (getAuthMode() === "none") return () => true;
  const header = request.headers.get("authorization");
  const bearer = header?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) return () => tokenMatches(bearer, readAuthToken());

  const secret = request.cookies.get(SESSION_COOKIE)?.value;
  if (!secret) return () => false;
  return () => {
    try { return validateBrowserSession(secret, false) !== null; }
    catch { return false; }
  };
}
