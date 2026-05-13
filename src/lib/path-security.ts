// ═══════════════════════════════════════════════════════════════
// Path safety — prevent traversal from user-controlled segments
// ═══════════════════════════════════════════════════════════════

import { relative, resolve } from "path";
import { homedir } from "os";

import { CH_DATA_DIR } from "@/lib/paths";
import { getHermesFilesystemRoot } from "@/lib/hermes-home";

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
 * Workspace paths must resolve under home, CH_DATA_DIR, or any registered Hermes root.
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
  const roots = [homedir(), CH_DATA_DIR, getHermesFilesystemRoot()];
  for (const root of roots) {
    if (isPathUnderRoot(abs, root)) {
      return { ok: true, absolute: abs };
    }
  }
  return {
    ok: false,
    error: "Path must be under your home directory, Control Hub data, or the Hermes install root",
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
 * Validates skill URL segments: no empty, ".", "..", or separators.
 * Returns the joined relative path under the skills root, or null if invalid.
 */
export function safeSkillRelativePath(segments: string[]): string | null {
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
