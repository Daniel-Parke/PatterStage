// ── agentFileUrl — the URL for one profile's behaviour file.

/** Build the file URL for /api/agent/files/[key], with profile query param when scoped. */
export function agentFileUrl(profileId: string, fileKey: string): string {
  return profileId === "default"
    ? `/api/agent/files/${fileKey}`
    : `/api/agent/files/${fileKey}?profile=${profileId}`;
}
