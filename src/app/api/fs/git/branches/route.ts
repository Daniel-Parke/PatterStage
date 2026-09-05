// ═══════════════════════════════════════════════════════════════
// GET /api/fs/git/branches — list branches + current ref for a repo
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, badRequest } from "@/lib/api-response";
import { resolveAllowedWorkspacePath } from "@/lib/fs/path-security";
import { readGitBranchMetadataForWorkspacePath } from "@/lib/git/git-workspace-branches";

export async function GET(request: NextRequest) {
  try {
    const pathParam = request.nextUrl.searchParams.get("path")?.trim();
    if (!pathParam) {
      return badRequest("path is required");
    }
    const resolved = resolveAllowedWorkspacePath(pathParam);
    if (!resolved.ok) {
      return badRequest(resolved.error);
    }
    const abs = resolved.absolute;

    const data = await readGitBranchMetadataForWorkspacePath(abs);

    return ok(data);
  } catch (error) {
    return serverErrorFromCatch(
      "GET /api/fs/git/branches",
      "git info",
      error,
      "Failed to read git branches",
    );
  }
}
