// ═══════════════════════════════════════════════════════════════
// Path safety — prevent traversal from user-controlled segments
// ═══════════════════════════════════════════════════════════════

import { relative, resolve } from "path";
import { homedir } from "os";
import { NextResponse } from "next/server";

import { PS_DATA_DIR } from "@/lib/paths";
import { getAgentWorkspace } from "@/lib/runtime/workspace";
import { badRequest } from "@/lib/api-response";

const PROFILE_PATTERN = /^\.[a-zA-Z0-9][a-zA-Z0-9_-]{0,126}$|^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

/** On Unix, `path.resolve("C:/...")` is relative to cwd; reject drive paths. */
const WINDOWS_DRIVE_PATH = /^[a-zA-Z]:[/\\]/;

function isPathUnderRoot(absolutePath: string, root: string): boolean {
  const R = resolve(root);
  const C = resolve(absolutePath);
  if (C === R) return true;
  const rel = relative(R, C);
  return rel !== "" && !rel.startsWith("..") && !rel.includes("..");
}

/**
 * Workspace paths must resolve under home, PS_DATA_DIR, or any registered Hermes root.
 */
export function resolveAllowedWorkspacePath(
  input: string
): { ok: true; absolute: string } | { ok: false; error: string } {
  const trimmed = (input || "").trim();
  if (!trimmed) {
    return { ok: false, error: "Path is required" };
  }
  if (process.platform !== "win32" && WINDOWS_DRIVE_PATH.test(trimmed)) {
    return {
      ok: false,
      error: "Windows-style paths are not valid on this operating system",
    };
  }
  let abs: string;
  try {
    abs = resolve(trimmed);
  } catch {
    return { ok: false, error: "Invalid path" };
  }
  const roots = [homedir(), PS_DATA_DIR, getAgentWorkspace().root];
  for (const root of roots) {
    if (isPathUnderRoot(abs, root)) {
      return { ok: true, absolute: abs };
    }
  }
  return {
    ok: false,
    error: "Path must be under your home directory, PatterStage data, or the agent install root",
  };
}

/**
 * Returns a safe profile segment for paths under <agent>/profiles/<profile>/.
 * Rejects "..", slashes, and other metacharacters. "default" uses global paths.
 */
export function resolveSafeProfileName(
  profileParam: string | null
): { ok: true; profile: string } | { ok: false; error: string } {
  const profile = (profileParam || "default").trim();
  if (profile === "default" || profile === "") {
    return { ok: true, profile: "default" };
  }
  if (!PROFILE_PATTERN.test(profile)) {
    return { ok: false, error: "Invalid profile name" };
  }
  return { ok: true, profile };
}

/**
 * Resolve a profile id (or null → "default") and return a 400 NextResponse
 * if it is invalid. The "validation-returns-Response-or-T" pattern from the
 * `requireMissionId` / `getMissionOrNotFound` helpers in
 * `src/app/api/missions/route.ts` (session 42). Centralises the 8 inline
 * `if (!prof.ok) { return badRequest(prof.error); }` copies that the
 * `agent/profiles/*` and `agent/personality` routes used to repeat.
 *
 * Callers check `if (prof instanceof NextResponse) return prof;` to
 * short-circuit. Success type is `{ profile: string }` — the consumer reads
 * `prof.profile` after the narrowing check.
 */
export function requireSafeProfileName(
  profileParam: string | null,
): { profile: string } | NextResponse {
  const resolved = resolveSafeProfileName(profileParam);
  if (!resolved.ok) {
    return badRequest(resolved.error);
  }
  return { profile: resolved.profile };
}

/**
 * Validates skill URL segments: no empty, ".", "..", or separators.
 * Returns the joined relative path under the skills root, or null if invalid.
 */
function safeSkillRelativePath(segments: string[]): string | null {
  if (segments.length === 0) return null;
  for (const seg of segments) {
    if (
      seg === "" ||
      seg === "." ||
      seg === ".." ||
      seg.includes("/") ||
      seg.includes("\\")
    ) {
      return null;
    }
  }
  return segments.join("/");
}

/**
 * Builds an absolute skill directory path and verifies it stays under skillsRoot
 * (string prefix check; skillsRoot must not end with slash).
 */
export function resolveSkillDirUnderRoot(
  skillsRoot: string,
  segments: string[]
): { ok: true; skillDir: string } | { ok: false; error: string } {
  const normalizedRoot = skillsRoot.replace(/\/$/, "");
  const rel = safeSkillRelativePath(segments);
  if (!rel) {
    return { ok: false, error: "Invalid skill path" };
  }
  const skillDir = normalizedRoot + "/" + rel;
  const prefix = normalizedRoot + "/";
  if (skillDir !== normalizedRoot && !skillDir.startsWith(prefix)) {
    return { ok: false, error: "Invalid skill path" };
  }
  return { ok: true, skillDir };
}
