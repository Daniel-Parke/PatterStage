// ═══════════════════════════════════════════════════════════════
// analytics/event-types.ts — interaction event taxonomy (single source)
//
// Dependency-free so it can be imported by migration code, the repository,
// the Zod query schema, and the achievement engine without dragging in the
// @/lib/db Jest mock. Adding a new event type = append to the tuple here and
// emit it via recordEvent() — no SQL migration needed (the table has no CHECK
// on event_type; the taxonomy is enforced at this TypeScript boundary).
//
// Extended once for the release (T-0098, B4): Insights was blind to Research
// and the Composer (D95), and the quests of B17 need a ledger of what the
// operator has actually done. Every type is emitted only after its write
// succeeded and only from a write path; the oracle in tests/unit/b4-emits-*
// holds each site to that.
// ═══════════════════════════════════════════════════════════════

/** Every meaningful PatterStage interaction we log to analytics_events. */
export const ANALYTICS_EVENT_TYPES = [
  "mission.dispatched",
  "mission.completed",
  "mission.failed",
  "story.created",
  "story.chapter_generated",
  "story.completed",
  "session.started",
  "session.closed",
  "skill.toggled",
  "personality.changed",
  "schedule.created",
  "schedule.fired",
  "chat.message_sent",
  "model.configured",
  // ── B4 ──
  "research.started",
  "research.completed",
  "research.failed",
  "research.cancelled",
  "composer.run_started",
  "composer.run_completed",
  "composer.run_failed",
  "composer.gate_approved",
  "composer.workflow_saved",
  "profile.created",
  "profile.pushed",
  "profile.pulled",
  "toolset.saved",
  "config.saved",
  "memory.configured",
  "memory.retained",
  "template.saved",
  "mission.cancelled",
  "script.saved",
  "script.run",
  "script.scheduled",
  "artifact.saved",
  "backup.taken",
  "credential.added",
  "model.added",
  "help.opened",
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

/** The kind of entity an event refers to (entity_id points into that table). */
export const ANALYTICS_ENTITY_TYPES = [
  "mission",
  "run",
  "story",
  "session",
  "skill",
  "personality",
  "schedule",
  "chat",
  "model",
  "research",
  "composer_run",
  "workflow",
  "profile",
  "toolset",
  "config",
  "memory",
  "template",
  "script",
  "artifact",
  "backup",
  "credential",
  "help",
] as const;

export type AnalyticsEntityType = (typeof ANALYTICS_ENTITY_TYPES)[number];

/**
 * Types in the taxonomy that nothing emits yet. Each is removed from this list
 * by the batch that lands its emitter: research.cancelled (B14), backup.taken
 * (B6), help.opened (B16). Until then they are charted if they ever appear and
 * asked of nobody.
 */
const NOT_YET_EMITTED: readonly string[] = ["research.cancelled", "backup.taken", "help.opened"];

/** Failures are recorded and charted; they are never something to collect. */
const FAILURE_TYPES: readonly string[] = ["mission.failed", "research.failed", "composer.run_failed"];

/**
 * The curated list the Completionist achievement is measured against: every
 * type an operator can trigger today by doing something, and no failure.
 * "Trigger all N event types" used to read the distinct count against a
 * literal 14, which a taxonomy of forty with three unemitted types and three
 * failures would have made unreachable by design.
 */
export const COMPLETIONIST_EVENT_TYPES: readonly AnalyticsEventType[] = ANALYTICS_EVENT_TYPES.filter(
  (t) => !NOT_YET_EMITTED.includes(t) && !FAILURE_TYPES.includes(t),
);
