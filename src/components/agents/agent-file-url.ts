// ── agentFileUrl — the URL for one profile's behaviour file.
// Pure helper, extracted verbatim from app/operations/agents/page.tsx.

/** Build the file URL for /api/agent/files/[key], with profile query param when scoped. */
export function agentFileUrl(profileId: string, fileKey: string): string {
  return profileId === "default"
    ? `/api/agent/files/${fileKey}`
    : `/api/agent/files/${fileKey}?profile=${profileId}`;
}
