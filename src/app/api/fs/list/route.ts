// ═══════════════════════════════════════════════════════════════
// GET /api/fs/list — list one directory level under allowed roots
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { readdirSync, statSync, existsSync } from "fs";
import { homedir } from "os";
import { resolve as pathResolve } from "path";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { badRequest, ok } from "@/lib/api-response";
import { resolveAllowedWorkspacePath } from "@/lib/fs/path-security";

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl;
    const pathParam = url.searchParams.get("path")?.trim();
    const showHidden = url.searchParams.get("showHidden") === "1";

    const rootInput = pathParam && pathParam.length > 0 ? pathParam : homedir();
    const resolved = resolveAllowedWorkspacePath(rootInput);
    if (!resolved.ok) {
      return badRequest(resolved.error);
    }
    const abs = resolved.absolute;

    if (!existsSync(abs) || !statSync(abs).isDirectory()) {
      return badRequest("Not a directory");
    }

    const entries: { name: string; isDir: boolean; isFile: boolean }[] = [];
    for (const name of readdirSync(abs)) {
      if (!showHidden && name.startsWith(".")) continue;
      const full = pathResolve(abs, name);
      try {
        const st = statSync(full);
        entries.push({
          name,
          isDir: st.isDirectory(),
          isFile: st.isFile(),
        });
      } catch {
        // Skip unreadable entries
      }
    }
    entries.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    let parent: string | null = null;
    const parentResolved = resolveAllowedWorkspacePath(pathResolve(abs, ".."));
    if (parentResolved.ok && parentResolved.absolute !== abs) {
      parent = parentResolved.absolute;
    }

    return ok({ path: abs, parent, entries });
  } catch (error) {
    return serverErrorFromCatch(
      "GET /api/fs/list",
      "listing path",
      error,
      "Failed to list directory",
    );
  }
}
