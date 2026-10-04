// ═══════════════════════════════════════════════════════════════
// build-mission-prompt.ts — Prompt building and parsing utils
// ═══════════════════════════════════════════════════════════════
// Agent prompts use XML under <hermes_mission>. Keep buildMissionPrompt,
// buildMissionPromptHuman, and parseMissionPrompt in sync.

import { normalizeLocalDirsInput } from "@/lib/fs/local-dir-entry";
import { declaredTimeoutMinutes, GRACE_MINUTES } from "@/lib/orchestration/run-deadline";
import type { LocalDirEntry } from "@/types/console";

// ── Build options ──────────────────────────────────────────────

export interface BuildPromptOptions {
  instruction: string;
  localDirs?: LocalDirEntry[] | string[];
  references?: string[];
  skills?: string[];
  toolsets?: string[];
  context?: string;
  goals?: string[];
  missionTimeMinutes?: number;
  timeoutMinutes?: number;
  outputFormat?: string;
  constraints?: string;
}

export interface ParsedMissionPrompt {
  instruction: string;
  context: string;
  outputFormat: string;
  constraints: string;
}

const MISSION_BRIEF = `Hermes mission prompt. Read sections in document order.
Setup (directories, references, skills) first; requirements (goals, output, constraints) next; execute the task last.
Constraints are binding unless the task explicitly overrides them.`;

const GOALS_COMPLETION_LINE =
  'Report completion with: GOAL_DONE: <goal text>';

// ── Helpers ────────────────────────────────────────────────────

function formatWorkingDirectories(
  localDirs: LocalDirEntry[] | string[] | undefined,
): string | null {
  const dirs = normalizeLocalDirsInput(localDirs ?? []);
  if (dirs.length === 0) return null;
  return dirs
    .map((d) => {
      const branch = d.branch ? ` (branch: ${d.branch})` : "";
      return `- \`${d.path}\`${branch}`;
    })
    .join("\n");
}

function formatList(items: string[] | undefined): string | null {
  if (!items || items.length === 0) return null;
  return items.map((item) => `- ${item}`).join("\n");
}

function formatGoals(goals: string[] | undefined): string | null {
  if (!goals || goals.length === 0) return null;
  const lines = goals.map((g, i) => `${i + 1}. [ ] ${g}`).join("\n");
  return `${lines}\n\n${GOALS_COMPLETION_LINE}`;
}

function formatMissionScope(minutes: number | undefined): string | null {
  if (minutes == null || minutes <= 0) return null;
  const devHours = (minutes / 60).toFixed(1);
  return (
    `Planning horizon: ${minutes} minutes (${devHours} developer hours).\n` +
    `This is a SOFT GUIDE — plan your work to fill this time with meaningful impact.\n` +
    `Do NOT rush. Do NOT pad. Stop when the work is done.`
  );
}

function formatSafetyLimits(opts: BuildPromptOptions): string | null {
  const minutes = declaredTimeoutMinutes(opts);
  if (minutes === null) return null;
  return (
    `Elapsed run deadline: ${minutes} minutes. Elapsed time starts at submission,\n` +
    `with a ${GRACE_MINUTES}-minute grace period before reconciliation marks the run failed\n` +
    `and requests cancellation. Tool activity does not reset or extend the deadline.`
  );
}

function wrapCdata(content: string): string {
  const safe = content.replace(/\]\]>/g, "]]]]><![CDATA[>");
  return `<![CDATA[\n${safe}\n]]>`;
}

function xmlAttributes(attrs?: Record<string, string>): string {
  if (!attrs || Object.keys(attrs).length === 0) return "";
  return " " + Object.entries(attrs).map(([key, value]) => `${key}="${value}"`).join(" ");
}

function xmlTag(
  name: string,
  body: string,
  attrs?: Record<string, string>,
): string {
  return `<${name}${xmlAttributes(attrs)}>\n${body.trim()}\n</${name}>`;
}

function xmlTagCdata(
  name: string,
  content: string,
  attrs?: Record<string, string>,
): string {
  return `<${name}${xmlAttributes(attrs)}>${wrapCdata(content)}</${name}>`;
}

function unescapeCdata(content: string): string {
  return content.replace(/\]\]\]\]><!\[CDATA\[>/g, "]]>");
}

function insideCdata(raw: string, index: number): boolean {
  let cursor = 0;
  while (true) {
    const start = raw.indexOf("<![CDATA[", cursor);
    if (start < 0 || start >= index) return false;
    const end = raw.indexOf("]]>", start + "<![CDATA[".length);
    if (end < 0 || index < end + 3) return true;
    cursor = end + 3;
  }
}

function extractXmlTag(
  raw: string,
  tagName: string,
  cdata = false,
): string {
  if (cdata) {
    const opening = new RegExp(
      `<${tagName}(?=[\\s>])[^>]*>\\s*<!\\[CDATA\\[`,
      "gi",
    );
    let content = "";
    for (const match of raw.matchAll(opening)) {
      if (insideCdata(raw, match.index)) continue;
      const contentStart = match.index + match[0].length;
      const closing = new RegExp(`\\]\\]>\\s*</${tagName}>`, "i")
        .exec(raw.slice(contentStart));
      if (!closing) continue;
      // Builder-owned sections follow references. A reference can quote a
      // complete task tag; the final valid section is the stored one.
      content = unescapeCdata(raw.slice(contentStart, contentStart + closing.index).trim());
    }
    return content;
  }
  const re = new RegExp(
    `<${tagName}[^>]*>\\s*([\\s\\S]*?)\\s*</${tagName}>`,
    "i",
  );
  const m = raw.match(re);
  return m ? m[1].trim() : "";
}

// ── AI agent prompt (stored in DB) ─────────────────────────────

export function buildMissionPrompt(opts: BuildPromptOptions): string {
  const sections: string[] = [];

  sections.push(xmlTag("mission_brief", MISSION_BRIEF));

  const dirs = formatWorkingDirectories(opts.localDirs);
  if (dirs) sections.push(xmlTag("working_directories", dirs));

  const refs = formatList(opts.references);
  if (refs) sections.push(xmlTag("references", refs));

  const skills = formatList(opts.skills);
  if (skills) sections.push(xmlTag("recommended_skills", skills));

  const toolsets = formatList(opts.toolsets);
  if (toolsets) sections.push(xmlTag("recommended_toolsets", toolsets));

  if (opts.context?.trim()) {
    sections.push(
      xmlTagCdata("additional_context", opts.context.trim()),
    );
  }

  const goals = formatGoals(opts.goals);
  if (goals) {
    sections.push(xmlTag("goals", goals, { ordered: "true" }));
  }

  if (opts.outputFormat?.trim()) {
    sections.push(
      xmlTagCdata("expected_output", opts.outputFormat.trim()),
    );
  }

  if (opts.constraints?.trim()) {
    sections.push(
      xmlTagCdata("constraints", opts.constraints.trim(), {
        binding: "hard",
      }),
    );
  }

  const scope = formatMissionScope(opts.missionTimeMinutes);
  if (scope) sections.push(xmlTag("mission_scope", scope));

  const safety = formatSafetyLimits(opts);
  if (safety) sections.push(xmlTag("safety_limits", safety));

  sections.push(
    xmlTagCdata("task", opts.instruction.trim()),
  );

  return `<hermes_mission>\n\n${sections.join("\n\n")}\n\n</hermes_mission>`;
}

// ── Human-readable preview (not stored) ────────────────────────

export function buildMissionPromptHuman(opts: BuildPromptOptions): string {
  const parts: string[] = [];

  if (opts.instruction.trim()) {
    parts.push(`## Instruction\n\n${opts.instruction.trim()}`);
  }

  if (opts.goals && opts.goals.length > 0) {
    const goalLines = opts.goals
      .map((g, i) => `${i + 1}. [ ] ${g}`)
      .join("\n");
    parts.push(`## Goals\n\n${goalLines}`);
  }

  if (opts.context?.trim()) {
    parts.push(`## Additional context\n\n${opts.context.trim()}`);
  }

  if (opts.outputFormat?.trim()) {
    parts.push(`## Expected output\n\n${opts.outputFormat.trim()}`);
  }

  if (opts.constraints?.trim()) {
    parts.push(`## Constraints\n\n${opts.constraints.trim()}`);
  }

  const dirs = formatWorkingDirectories(opts.localDirs);
  if (dirs) {
    parts.push(`## Repositories\n\n${dirs}`);
  }

  const refs = formatList(opts.references);
  if (refs) {
    parts.push(`## References\n\n${refs}`);
  }

  const skills = formatList(opts.skills);
  if (skills) {
    parts.push(`## Recommended skills\n\n${skills}`);
  }

  const toolsets = formatList(opts.toolsets);
  if (toolsets) {
    parts.push(`## Recommended toolsets\n\n${toolsets}`);
  }

  const scope = formatMissionScope(opts.missionTimeMinutes);
  if (scope) {
    parts.push(`## Planning\n\n${scope}`);
  }

  const safety = formatSafetyLimits(opts);
  if (safety) {
    parts.push(`## Safety\n\n${safety}`);
  }

  return parts.join("\n\n");
}

// ── Parse stored AI prompt for edit ────────────────────────────

export function parseMissionPrompt(raw: string): ParsedMissionPrompt {
  const trimmed = raw.trim();
  if (!trimmed.includes("<hermes_mission")) {
    return {
      instruction: trimmed,
      context: "",
      outputFormat: "",
      constraints: "",
    };
  }

  return {
    instruction: extractXmlTag(trimmed, "task", true),
    context: extractXmlTag(trimmed, "additional_context", true),
    outputFormat: extractXmlTag(trimmed, "expected_output", true),
    constraints: extractXmlTag(trimmed, "constraints", true),
  };
}
