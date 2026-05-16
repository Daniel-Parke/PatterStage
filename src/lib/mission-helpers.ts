// ═══════════════════════════════════════════════════════════════
// Control Hub - Mission template definitions
// Only TEMPLATES and TemplateDef are used (by templates/route.ts).
// All other exports have been cleaned up — they were dead code.
// ═══════════════════════════════════════════════════════════════

// ── Template definition (prompt-building blocks) ───────────────

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
   * Hermes model id hint for the mission form. Omit or use a blank string
   * to fall through to the registry agent default. User can override per-mission.
   */
  defaultModel?: string;
  /**
   * Inference provider that pairs with `defaultModel`. Must match a
   * provider id in src/lib/hermes-providers.ts.
   */
  defaultProvider?: string;
}

// ── Template Definitions ─────────────────────────────────────
//
// Minimal templates — the agent's personality and approach come from its
// Hermes profile (SOUL.md + AGENTS.md), not from a rigid workflow script.
// Each template is: a role, one sentence of instruction, and optional skills.
// The dispatch prompt builder (buildMissionPrompt) wraps these with goals,
// scope, and safety headers before sending to the agent.
// ═══════════════════════════════════════════════════════════════

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
