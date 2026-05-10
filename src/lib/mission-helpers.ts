// ═══════════════════════════════════════════════════════════════
// Control Hub - Pure helper functions (no Next.js imports)
// Extracted from missions/route.ts for testability.
// ═══════════════════════════════════════════════════════════════

import type { CronJobData } from "@/lib/utils";
import { listModels, getModelDefaults } from "@/lib/models-repository";

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
   * Hermes model id picked when this template is selected (mission form
   * pre-fills from this). User can override per-mission. Resolves through
   * the models registry — see src/lib/models-repository.ts.
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
 *   1. If the template's `defaultModel` is registered in the models registry,
 *      use it (respects user's configured base_url, credentials, etc.).
 *   2. Fall back to the `agent` default slot from the registry.
 *   3. Fall back to the raw template values (bare IDs used directly).
 *
 * This ensures that imported Hermes config models are always preferred over
 * bare IDs, and that templates always have a valid model to dispatch with.
 */
export function resolveTemplateModel(template: TemplateDef): { modelId: string; provider: string } {
  try {
    const models = listModels();
    const defaults = getModelDefaults();

    if (template.defaultModel) {
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
    // Registry unavailable — fall through to template raw values
  }

  // Last resort: use template's raw values (bare IDs used as-is)
  const tm2 = template.defaultModel ?? "";
  return {
    modelId: tm2,
    provider: template.defaultProvider ?? "",
  };
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

// ── Template Definitions ──────────────────────────────────────

/** Flatten template instruction + context into a single mission prompt. */
export function promptFromTemplate(t: TemplateDef): string {
  const ctx = t.context && t.context.trim() ? "\n\n## Additional Context\n\n" + t.context : "";
  return t.instruction + ctx;
}

export const TEMPLATES: TemplateDef[] = [
  // === ENGINEERING - QA ===
  {
    id: "qa-bugfix",
    name: "QA - Bug Fix",
    icon: "Bug",
    color: "pink",
    category: "Engineering - QA",
    profile: "ch-qa-engineer",
    description: "Reproduce, diagnose, fix, and test a specific bug",
    instruction: [
      "You are a QA Bug Fix Engineer. Your job is to reproduce, diagnose, fix, and verify the reported issue.",
      "",
      "YOUR WORKFLOW - Follow these steps IN ORDER. Do NOT skip any step.",
      "You MUST implement changes - do not just report findings.",
      "",
      "1. REPRODUCE - Trigger the exact failure. Capture error messages, stack traces, logs.",
      "2. DIAGNOSE - Trace the execution path. Follow the code from input to failure point.",
      "3. FIX - Make the minimal change needed to resolve the issue. No gold-plating.",
      "4. TEST - Run the full test suite. Write a regression test for this bug.",
      "5. BUILD - Run `npm run build` to verify nothing is broken.",
      "6. DOCUMENT - Summarise: what was broken, root cause, what you changed, test results.",
      "",
      "CONSTRAINTS:",
      "- Work DIRECTLY on the code - do not ask permission, do not just suggest fixes.",
      "- The build MUST pass before you finish.",
      "- If the fix requires architectural changes, implement the minimal version and document the larger refactor as a TODO.",
    ].join("\n"),
    context: "Describe the bug (error message, steps to reproduce, expected vs actual):\n",
    goals: ["Reproduce the issue", "Diagnose root cause", "Implement fix", "Test & verify"],
    suggestedSkills: ["systematic-debugging"],
    // QA bug-fix benefits from strong reasoning + tooling fidelity.
    defaultModel: "anthropic/claude-sonnet-4",
    defaultProvider: "anthropic",
  },
  {
    id: "qa-acceptance",
    name: "QA - Acceptance Tests",
    icon: "CheckSquare",
    color: "pink",
    category: "Engineering - QA",
    profile: "ch-qa-engineer",
    description: "Write and run acceptance tests for a feature or component",
    instruction: [
      "You are a QA Engineer specialising in acceptance testing.",
      "",
      "YOUR WORKFLOW:",
      "You MUST write and run tests - do not just describe what should be tested.",
      "",
      "1. UNDERSTAND - Read the feature/component code. Understand expected behaviour.",
      "2. PLAN - Define acceptance criteria. List edge cases, error states, happy paths.",
      "3. WRITE - Create acceptance tests that cover all criteria.",
      "4. RUN - Execute the tests. Fix any that fail due to test errors (not product bugs).",
      "5. REPORT - Summarise: what's tested, coverage gaps, any bugs found during testing.",
    ].join("\n"),
    context: "Feature or component to write acceptance tests for:\n",
    goals: ["Understand feature", "Define acceptance criteria", "Write tests", "Run & verify"],
    suggestedSkills: ["test-driven-development"],
    defaultModel: "anthropic/claude-sonnet-4",
    defaultProvider: "anthropic",
  },
  {
    id: "qa-unit-tests",
    name: "QA - Unit & Integration Tests",
    icon: "TestTube",
    color: "pink",
    category: "Engineering - QA",
    profile: "ch-qa-engineer",
    description: "Write comprehensive unit and integration tests for a module",
    instruction: [
      "You are a QA Engineer specialising in test coverage.",
      "",
      "YOUR WORKFLOW:",
      "You MUST write and run tests - achieve meaningful coverage.",
      "",
      "1. ANALYSE - Read the target module. Identify all exported functions, classes, and edge cases.",
      "2. PLAN - Map test cases to code paths. Prioritise critical logic, error handling, boundary conditions.",
      "3. WRITE - Create unit tests for individual functions. Create integration tests for component interactions.",
      "4. RUN - Execute the full test suite. Fix any test errors.",
      "5. VERIFY - Run `npm run build` to confirm nothing breaks.",
      "6. REPORT - Summarise: tests written, coverage achieved, any gaps remaining.",
    ].join("\n"),
    context: "Module or file to increase test coverage for:\n",
    goals: ["Understand module", "Plan test cases", "Write tests", "Run & verify"],
    suggestedSkills: ["test-driven-development"],
    defaultModel: "anthropic/claude-sonnet-4",
    defaultProvider: "anthropic",
  },
  {
    id: "eng-refactor",
    name: "Engineering - Refactor",
    icon: "RefreshCw",
    color: "cyan",
    category: "Engineering",
    profile: "ch-swe-engineer",
    description: "Safely restructure code without changing external behaviour",
    instruction: [
      "You are a Software Engineer specialising in code quality and refactoring.",
      "",
      "YOUR WORKFLOW:",
      "1. READ - Read the target code. Understand its structure and dependencies.",
      "2. PLAN - Define what needs to change and the order of changes.",
      "3. REFACTOR - Make changes incrementally. Each change should be minimal.",
      "4. TEST - Run the test suite after each change. All tests must pass.",
      "5. BUILD - Run `npm run build` to confirm nothing is broken.",
      "",
      "RULES:",
      "- Do NOT change behaviour - the refactored code must produce identical results.",
      "- Do NOT add features - scope is strictly refactoring.",
      "- Make atomic commits for each logical step.",
    ].join("\n"),
    context: "Code to refactor:\n",
    goals: ["Read & understand code", "Plan refactor", "Execute refactor", "Run tests"],
    suggestedSkills: ["refactoring-patterns"],
    // Refactor needs careful reasoning — Opus tier.
    defaultModel: "anthropic/claude-opus-4",
    defaultProvider: "anthropic",
  },
  {
    id: "eng-bugfix",
    name: "Engineering - Bug Fix",
    icon: "Bug",
    color: "red",
    category: "Engineering",
    profile: "ch-swe-engineer",
    description: "Find and fix a specific bug",
    instruction: [
      "You are a Software Engineer fixing a bug.",
      "",
      "YOUR WORKFLOW:",
      "1. REPRODUCE - Get the code into a failing state.",
      "2. DIAGNOSE - Find the root cause. Ask: why does this fail?",
      "3. FIX - Implement the minimal fix.",
      "4. VERIFY - Run the failing test (or repro case) to confirm the fix works.",
      "5. BUILD - Run `npm run build`.",
    ].join("\n"),
    context: "Bug description (error, steps to reproduce):\n",
    goals: ["Reproduce bug", "Find root cause", "Implement fix", "Verify & build"],
    suggestedSkills: ["systematic-debugging"],
    defaultModel: "anthropic/claude-sonnet-4",
    defaultProvider: "anthropic",
  },
  {
    id: "eng-feature",
    name: "Engineering - Feature",
    icon: "Sparkles",
    color: "green",
    category: "Engineering",
    profile: "ch-swe-engineer",
    description: "Implement a new feature end-to-end",
    instruction: [
      "You are a Software Engineer implementing a new feature.",
      "",
      "YOUR WORKFLOW:",
      "1. CLARIFY - Make sure you understand the requirement fully.",
      "2. PLAN - Define the approach, files to change, tests to add.",
      "3. IMPLEMENT - Write clean, working code.",
      "4. TEST - Write tests. Run the full test suite.",
      "5. BUILD - Run `npm run build`.",
      "6. DOCUMENT - Summarise what was built.",
    ].join("\n"),
    context: "Feature to implement:\n",
    goals: ["Clarify requirements", "Plan approach", "Implement feature", "Test & document"],
    suggestedSkills: ["test-driven-development"],
    // New features benefit from the larger model's planning depth.
    defaultModel: "anthropic/claude-opus-4",
    defaultProvider: "anthropic",
  },
  {
    id: "eng-code-review",
    name: "Engineering - Code Review",
    icon: "Eye",
    color: "purple",
    category: "Engineering",
    profile: "ch-swe-engineer",
    description: "Review a pull request or set of code changes",
    instruction: [
      "You are a senior engineer reviewing code.",
      "",
      "YOUR WORKFLOW:",
      "1. UNDERSTAND - Read the PR description and the code changes.",
      "2. ANALYSE - Check logic, edge cases, error handling, security, and performance.",
      "3. TEST - If possible, run the code. Try to break it.",
      "4. REPORT - Summarise: what looks good, concerns, suggestions.",
    ].join("\n"),
    context: "PR or code changes to review:\n",
    goals: ["Understand changes", "Analyse code", "Test if possible", "Write review"],
    suggestedSkills: ["security-code-review", "systematic-debugging"],
    // Code review prizes critical reasoning — Opus tier.
    defaultModel: "anthropic/claude-opus-4",
    defaultProvider: "anthropic",
  },
  {
    id: "devops-infra",
    name: "DevOps - Infrastructure",
    icon: "Server",
    color: "orange",
    category: "DevOps",
    profile: "ch-devops-engineer",
    description: "Manage infrastructure, CI/CD, and deployment",
    instruction: [
      "You are a DevOps Engineer managing infrastructure.",
      "",
      "YOUR WORKFLOW:",
      "1. ASSESS - Understand the current infrastructure and what needs to change.",
      "2. PLAN - Define the changes, rollback plan, and testing approach.",
      "3. IMPLEMENT - Apply changes. Prefer idempotent scripts.",
      "4. VERIFY - Confirm the change works. Check monitoring/logs.",
      "5. DOCUMENT - Update runbooks and diagrams.",
    ].join("\n"),
    context: "Infrastructure task:\n",
    goals: ["Assess current state", "Plan changes", "Implement", "Verify & document"],
    suggestedSkills: ["infrastructure-as-code"],
    // DevOps tooling work pairs well with GPT-class context handling.
    defaultModel: "openai/gpt-5.5-medium",
    defaultProvider: "openai",
  },
  {
    id: "devops-deploy",
    name: "DevOps - Deploy",
    icon: "Rocket",
    color: "orange",
    category: "DevOps",
    profile: "ch-devops-engineer",
    description: "Deploy an application to an environment",
    instruction: [
      "You are a DevOps Engineer deploying an application.",
      "",
      "BEFORE DEPLOYING:",
      "- Read the deployment documentation.",
      "- Check that the build is green.",
      "- Verify rollback plan.",
      "",
      "YOUR WORKFLOW:",
      "1. PREPARE - Ensure all prerequisites are met.",
      "2. DEPLOY - Execute the deployment.",
      "3. VERIFY - Check health endpoints, smoke tests, monitoring.",
      "4. CONFIRM - Report success or failure with details.",
    ].join("\n"),
    context: "Application and target environment:\n",
    goals: ["Prepare deployment", "Execute deploy", "Verify health", "Report status"],
    suggestedSkills: ["ci-test-workflow"],
    defaultModel: "openai/gpt-5.5-medium",
    defaultProvider: "openai",
  },
];
