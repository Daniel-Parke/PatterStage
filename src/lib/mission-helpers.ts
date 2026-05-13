// ═══════════════════════════════════════════════════════════════
// Control Hub - Pure helper functions (no Next.js imports)
// Extracted from missions/route.ts for testability.
// ═══════════════════════════════════════════════════════════════

import type { CronJobData } from "@/lib/utils";
import { listModels, getModelDefaults } from "@/lib/models-repository";

// ── Template definition (prompt-building blocks) ───────────────

/**
 * Sentinel value for TemplateDef.defaultModel that opts out of any template
 * default and forces resolution through the models registry (agent default).
 */
export const USE_HERMES_DEFAULT = "__use_hermes_default__";

export interface TemplateDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  category: string;
  profile: string;
  description: string;
  instruction: string;
  context: string;
  goals: string[];
  suggestedSkills: string[];
  /**
 * Hermes model id hint for the mission form. Set to USE_HERMES_DEFAULT
 * to explicitly defer to the Hermes agent model defaults.
   * Omit or use a blank string to also fall through to the registry.
   * User can override per-mission. Resolves through the models registry —
   * see src/lib/models-repository.ts.
   */
  defaultModel?: string;
  /**
   * Inference provider that pairs with `defaultModel`. Must match a
   * provider id in src/lib/hermes-providers.ts.
   */
  defaultProvider?: string;
}

// ── Template Model Resolution ──────────────────────────────────

/**
 * Resolve the best modelId + provider for a template.
 *
 * Strategy:
 *   1. If the template's `defaultModel` is USE_HERMES_DEFAULT or falsy,
 *      fall through to the registry agent default.
 *   2. If the template's `defaultModel` is registered in the models registry,
 *      use it (respects user's configured base_url, credentials, etc.).
 *   3. Fall back to the `agent` default slot from the registry.
 *   4. Last resort: return empty strings (registry unavailable).
 *
 * This ensures templates always defer to the user's configured agent default
 * unless they explicitly opt into a specific model through the registry.
 */
export function resolveTemplateModel(template: TemplateDef): { modelId: string; provider: string } {
  try {
    const models = listModels();
    const defaults = getModelDefaults();

    // Only attempt a registry lookup if defaultModel is a concrete value
    // (USE_HERMES_DEFAULT and falsy both skip directly to agent default)
    if (template.defaultModel && template.defaultModel !== USE_HERMES_DEFAULT) {
      // Try to find a registry entry matching the template's bare model ID.
      // Match by (model_id === defaultModel) — the registry stores full IDs.
      const tm = template.defaultModel;
      const match = models.find(
        (m) =>
          m.modelId === tm ||
          m.modelId === `anthropic/${tm}` ||
          m.modelId === tm.replace("anthropic/", "")
      );
      if (match) {
        return { modelId: match.modelId, provider: match.provider };
      }
    }

    // Fall back to agent default from registry
    if (defaults.agent) {
      const agentModel = models.find((m) => m.id === defaults.agent);
      if (agentModel) {
        return { modelId: agentModel.modelId, provider: agentModel.provider };
      }
    }
  } catch {
    // Registry unavailable — fall through to last resort
  }

  // Last resort: empty strings (caller should handle gracefully)
  return { modelId: "", provider: "" };
}

// ── Scope Labels ──────────────────────────────────────────────

export function getScopeLabel(minutes: number): string {
  if (minutes <= 10) return "Quick Pass";
  if (minutes <= 15) return "Half Day";
  if (minutes <= 20) return "Most of a Day";
  if (minutes <= 30) return "Full Day";
  if (minutes <= 45) return "Deep Dive";
  return "Sprint";
}

// ── Time Conversion ───────────────────────────────────────────

export function missionTimeToDevHours(agentMinutes: number): number {
  return Math.round(agentMinutes * 16 / 60);
}

// ── Goals Section ─────────────────────────────────────────────

export function buildGoalsSection(goals: string[]): string {
  return (
    `## Goals (complete each in order)\n` +
    goals.map((g, i) => `${i + 1}. [ ] ${g}`).join("\n") +
    `\n\nMark each goal as done by including "GOAL_DONE: <goal text>" in your response when you finish each one.`
  );
}

// ── Full Mission Prompt Builder ───────────────────────────────

export function buildMissionPrompt(mission: {
  prompt: string;
  goals: string[];
  missionTimeMinutes: number;
  timeoutMinutes: number;
}): string {
  const devHours = missionTimeToDevHours(mission.missionTimeMinutes);
  const scopeLabel = getScopeLabel(mission.missionTimeMinutes);

  const scopeSection =
    `## MISSION SCOPE\n` +
    `Planning horizon: ${scopeLabel} (${mission.missionTimeMinutes} min agent time ≈ ${devHours} developer hours).\n` +
    `This is a SOFT GUIDE for how much work to plan, not a hard deadline.\n` +
    `Plan your approach to fill this time with meaningful, impactful work.\n` +
    `Do NOT rush - quality over speed. Do NOT pad - stop when the work is done.\n\n`;

  const safetySection =
    `## SAFETY LIMITS\n` +
    `- Inactivity timeout: ${mission.timeoutMinutes} minutes. If you stop making API calls or tool\n` +
    `  requests for this duration, your session will be terminated.\n` +
    `- To avoid timeout: stay active. Each tool call, file read, or API request resets the timer.\n` +
    `- You can work for as long as needed - just stay active.\n\n`;

  let prompt = "";
  if (mission.goals.length > 0) {
    prompt += buildGoalsSection(mission.goals) + "\n\n---\n\n";
  }
  prompt += scopeSection + safetySection + mission.prompt;
  return prompt;
}

// ── Mission Status Mapper ─────────────────────────────────────
// Maps cron job state directly to mission status.
// Source of truth: cron job file. No session reading, no heuristics.
export function getMissionStatus(
  job: CronJobData | null,
  currentStatus: string,
): { status: string; error?: string } {
  if (!job) {
    // Cron job deleted - for one-shot dispatches this means it completed
    if (currentStatus === "dispatched") return { status: "successful" };
    return { status: currentStatus };
  }
  // User cancelled the job
  if (job.state === "paused" && !job.enabled) {
    return { status: "failed", error: "Cancelled by user" };
  }
  // Scheduler is actively executing - highest priority
  if (job.state === "running") {
    return { status: "dispatched" };
  }
  // Job has never run
  if (!job.last_run_at) {
    return { status: "queued" };
  }
  // Job has run - check result
  if (job.last_status === "ok") {
    return { status: "successful" };
  }
  if (job.last_status === "error") {
    return { status: "failed" };
  }
  // Job ran but no status yet (still executing or status not recorded)
  return { status: "dispatched" };
}

// ── Template Definitions ─────────────────────────────────────
//
// Minimal templates — the agent's personality and approach come from its
// Hermes profile (SOUL.md + AGENTS.md), not from a rigid workflow script.
// Each template is: a role, one sentence of instruction, and optional skills.
// The dispatch prompt builder (buildMissionPrompt) wraps these with goals,
// scope, and safety headers before sending to the agent.
// ═══════════════════════════════════════════════════════════════

/** Flatten template instruction + context into a single mission prompt. */
export function promptFromTemplate(t: TemplateDef): string {
  const ctx = t.context && t.context.trim() ? "\n\n## Additional Context\n\n" + t.context : "";
  return t.instruction + ctx;
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: "agent-general",
    name: "Agent Task",
    icon: "Bot",
    color: "cyan",
    category: "General",
    profile: "default",
    description: "Run a general-purpose coding or research task",
    instruction: "Execute the task described below. Work in ~/control-hub/ for any file operations. Keep your working directory tidy. Report what you did and what changed.",
    context: "",
    goals: ["Understand the task", "Plan your approach", "Execute", "Report results"],
    suggestedSkills: [],
  },
  {
    id: "agent-refactor",
    name: "Refactor",
    icon: "RefreshCw",
    color: "cyan",
    category: "Engineering",
    profile: "default",
    description: "Improve code quality and structure without changing behaviour",
    instruction: "Refactor the specified code. Do NOT change external behaviour — the refactored code must produce identical results. Run tests after each change. Report every change made.",
    context: "Code to refactor:\n",
    goals: ["Read & understand code", "Plan refactor", "Execute refactor", "Run tests"],
    suggestedSkills: ["refactoring-patterns"],
  },
  {
    id: "agent-debug",
    name: "Debug",
    icon: "Bug",
    color: "pink",
    category: "Engineering",
    profile: "default",
    description: "Find and fix a specific bug or error",
    instruction: "Reproduce the bug, find its root cause, implement a fix, verify the fix works, and run the test suite. Report: root cause, what was changed, test results.",
    context: "Bug description (error, steps to reproduce):\n",
    goals: ["Reproduce the bug", "Find root cause", "Implement fix", "Verify & build"],
    suggestedSkills: ["systematic-debugging"],
  },
];
