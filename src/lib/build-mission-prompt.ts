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
  /** Planning horizon guide — shown as ## MISSION SCOPE in the prompt. */
  missionTimeMinutes?: number;
  /** Inactivity timeout warning — shown as ## SAFETY LIMITS in the prompt. */
  timeoutMinutes?: number;
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

  // MISSION SCOPE — planning horizon guide
  if (opts.missionTimeMinutes != null && opts.missionTimeMinutes > 0) {
    const devHours = (opts.missionTimeMinutes / 60).toFixed(1);
    parts.push(
      `${SCOPE_HEADER}\n` +
      `Planning horizon: ${opts.missionTimeMinutes} minutes (${devHours} developer hours).\n` +
      `This is a SOFT GUIDE — plan your work to fill this time with meaningful impact.\n` +
      `Do NOT rush. Do NOT pad. Stop when the work is done.\n`,
    );
  }

  // SAFETY LIMITS — inactivity timeout warning
  if (opts.timeoutMinutes != null && opts.timeoutMinutes > 0) {
    parts.push(
      `${SAFETY_HEADER}\n` +
      `- Inactivity timeout: ${opts.timeoutMinutes} minutes. If you stop making API calls or\n` +
      `  tool requests for this duration, your session will be terminated.\n` +
      `- To avoid timeout: stay active. Each tool call resets the timer.\n`,
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
/**
 * Strip buildMissionPrompt-injected sections from a stored prompt,
 * returning the original instruction and context parts.
 *
 * The built prompt joins parts with "\n\n---\n\n", producing chunks:
 *   [0] Working Directories
 *   [1] Key References
 *   [2] Recommended Skills
 *   [3] Goals
 *   [4] MISSION SCOPE
 *   [5] SAFETY LIMITS
 *   [6] instruction
 *   [7] Additional Context (optional)
 *
 * This function reconstructs the original instruction and context by
 * finding the instruction chunk (always the 7th chunk when all sections
 * are present, or the last chunk before Additional Context).
 */
export function stripPromptSections(raw: string): StrippedPrompt {
  const chunks = raw.split(/\n{0,2}-\n{0,2}\n{0,2}/);

  if (chunks.length === 1) {
    // No separators at all — the entire thing is the instruction.
    return { instruction: raw.trim(), context: "" };
  }

  // Find the instruction chunk by looking for the last content chunk
  // before any "## Additional Context" chunk.
  let instructionChunkIdx = -1;
  let contextChunkIdx = -1;

  for (let i = chunks.length - 1; i >= 0; i--) {
    const trimmed = chunks[i].trim();
    if (trimmed.startsWith("## Additional Context")) {
      contextChunkIdx = i;
      continue;
    }
    // Skip separator-only chunks (shouldn't exist with the split pattern
    // but be defensive).
    if (!trimmed || /^-+$/.test(trimmed)) continue;
    // Skip chunks that are clearly section blocks (they start with ##).
    if (trimmed.startsWith("## ")) continue;
    // This is the first real content chunk from the bottom — it's the instruction.
    if (instructionChunkIdx === -1) {
      instructionChunkIdx = i;
    }
  }

  const instruction = instructionChunkIdx >= 0
    ? chunks[instructionChunkIdx].trim()
    : "";

  const context = contextChunkIdx >= 0
    ? chunks[contextChunkIdx]
        .replace(/^## Additional Context\n{0,3}/i, "")
        .trim()
    : "";

  return { instruction, context };
}

// ── Helpers ────────────────────────────────────────────────────
