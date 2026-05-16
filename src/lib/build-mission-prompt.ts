// ═══════════════════════════════════════════════════════════════
// build-mission-prompt.ts — Prompt building and parsing utils
// ═══════════════════════════════════════════════════════════════
// These are the shared functions for constructing and deconstructing
// the full mission prompt that's stored in the DB. Keep both the
// build and parse functions in sync — if you change the format here,
// update stripPromptSections() to match.

import { normalizeLocalDirsInput } from "@/lib/local-dir-entry";
import type { LocalDirEntry } from "@/types/hermes";

// ── Build options ──────────────────────────────────────────────

export interface BuildPromptOptions {
  instruction: string;
  localDirs?: LocalDirEntry[] | string[];
  references?: string[];
  skills?: string[];
  context?: string;
  goals?: string[];
}

// ── The sections injected by buildMissionPrompt ─────────────────

const WORKING_DIRS_HEADER = "## Working Directories";
const KEY_REFS_HEADER = "## Key References";
const SKILLS_HEADER = "## Recommended Skills";
const GOALS_HEADER = "## Goals (complete each in order)";
const SCOPE_HEADER = "## MISSION SCOPE";
const SAFETY_HEADER = "## SAFETY LIMITS";

// ── Build the full prompt ──────────────────────────────────────

export function buildMissionPrompt(opts: BuildPromptOptions): string {
  const parts: string[] = [];

  // Working Directories (highest priority)
  const dirs = normalizeLocalDirsInput(opts.localDirs ?? []);
  if (dirs.length > 0) {
    parts.push(
      `${WORKING_DIRS_HEADER}\n${
        dirs
          .map((d) => {
            const branch = d.branch ? ` (branch: ${d.branch})` : "";
            return `- \`${d.path}\`${branch}`;
          })
          .join("\n")
      }\n`,
    );
  }

  // Key References
  if (opts.references && opts.references.length > 0) {
    parts.push(
      `${KEY_REFS_HEADER}\n${
        opts.references.map((r) => `- ${r}`).join("\n")
      }\n`,
    );
  }

  // Recommended Skills
  if (opts.skills && opts.skills.length > 0) {
    parts.push(
      `${SKILLS_HEADER}\n${
        opts.skills.map((s) => `- ${s}`).join("\n")
      }\n`,
    );
  }

  // Goals
  if (opts.goals && opts.goals.length > 0) {
    parts.push(
      `${GOALS_HEADER}\n${
        opts.goals.map((g, i) => `${i + 1}. [ ] ${g}`).join("\n")
      }\n\nMark each goal as done by including "GOAL_DONE: <goal text>" in your response when you finish each one.\n`,
    );
  }

  parts.push(opts.instruction);

  // Additional Context
  if (opts.context && opts.context.trim()) {
    parts.push(`\n---\n\n## Additional Context\n\n${opts.context.trim()}`);
  }

  return parts.join("\n\n---\n\n");
}

// ── Strip all injected sections, returning just instruction + context ──

export interface StrippedPrompt {
  instruction: string;
  context: string;
}

/**
 * Strip buildMissionPrompt-injected sections from a stored prompt,
 * returning the original instruction and context parts.
 * Uses the same section headers as buildMissionPrompt() so they
 * stay in sync.
 */
export function stripPromptSections(raw: string): StrippedPrompt {
  let cleaned = raw;

  // Remove injected sections one by one
  const sections = [
    WORKING_DIRS_HEADER,
    KEY_REFS_HEADER,
    SKILLS_HEADER,
    GOALS_HEADER,
    SCOPE_HEADER,
    SAFETY_HEADER,
  ];

  for (const header of sections) {
    cleaned = cleaned.replace(
      new RegExp(
        `^${escapeRegex(header)}\\n[\\s\\S]*?(?=\\n## |\\n\\n---|,?\\n[A-Z]|$)`,
        "m",
      ),
      "",
    );
  }

  // Clean up excessive newlines
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  // Split on the context separator
  const sep = "\n---\n";
  const sepIdx = cleaned.indexOf(sep);
  if (sepIdx >= 0) {
    return {
      instruction: cleaned.slice(0, sepIdx).trim(),
      context: cleaned
        .slice(sepIdx + sep.length)
        .replace(/^## Additional Context\n\n?/i, "")
        .trim(),
    };
  }

  return { instruction: cleaned, context: "" };
}

// ── Helpers ────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
