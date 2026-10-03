// ═══════════════════════════════════════════════════════════════
// models/task-types.ts — the model-registry task slots (CORE)
//
// These name PatterStage's OWN columns: the 12 `is_default_<task>` fields in
// migration 006_models_credentials.sql. They mirror Hermes' auxiliary slots,
// but mirroring is not ownership — the registry is ours, and a second agent
// framework would map onto these slots rather than replace them.
//
// Extracted from modules/hermes/lib/providers.ts, where they sat next to genuinely
// Hermes-specific things (the provider list and its env-var map). That made
// eight core modules import a `hermes-*` file to say the word "agent", which
// counted against the framework-agnostic claim without any Hermes coupling
// actually existing. See org/decisions/ADR-0005-product-modules.md, "the hermes module".
// ═══════════════════════════════════════════════════════════════

/**
 * Task slots in the models registry. Mirrors the 12 `is_default_<task>`
 * columns in migration 006_models_credentials.sql. `agent` is the primary
 * mission model; the remaining 11 are auxiliary slots.
 */
export const TASK_TYPES = [
  "agent",
  "hindsight",
  "compression",
  "vision",
  "web_extract",
  "session_search",
  "title_generation",
  "skills_hub",
  "mcp",
  "triage_specifier",
  "approval",
  "delegation",
] as const;

export type TaskType = (typeof TASK_TYPES)[number];

/**
 * The 11 auxiliary task slots (everything except the primary `agent` slot).
 *
 * A single source of truth so callers don't independently compute
 * `TASK_TYPES.filter((t) => t !== "agent")` — which was duplicated in
 * `BulkAuxiliaryUpdater.tsx` and `modules/hermes/lib/config-sync.ts` as of 2026-06-02.
 * The type predicate narrows to a precise tuple, preserving literal types.
 */
export const AUXILIARY_TASK_TYPES = TASK_TYPES.filter(
  (t): t is Exclude<TaskType, "agent"> => t !== "agent",
);

export function isTaskType(value: unknown): value is TaskType {
  return typeof value === "string" && (TASK_TYPES as readonly string[]).includes(value);
}
