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
  // A run that never happened. `script.run` is the record of a script that
  // RAN, whatever it exited with, and it is what the "run a script" quest is
  // proved by; a missing interpreter or a spawn the host refused would tick
  // that quest for a run nobody performed. So it is recorded as its own
  // failure, the way mission.failed and composer.run_failed are.
  "script.run_not_started",
  "script.scheduled",
  "artifact.saved",
  "backup.taken",
  "credential.added",
  "model.added",
  "help.opened",
  // The first two READ events in this taxonomy, and a deliberate exception
  // rather than a new pattern (operator ruling, 2026-09-06, during T-0111).
  //
  // Everything above records a WRITE, which is what makes the ledger a record
  // of what an operator did rather than of what they looked at. Two quest steps
  // ask an operator to READ something, and the alternatives were to ship a
  // shorter chapter or to swap the steps for writes that are not what they
  // meant. The operator chose these. Both are emitted server-side from the GET
  // handler the screen already calls; a client cannot write this ledger,
  // because a client that could would be able to forge the quest progress that
  // reads it.
  //
  // Adding a third read event is a decision, not a precedent.
  "artifact.opened",
  "logs.opened",
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
  // A log FILE, named by its safe basename. The only entity here that is not a
  // row in a table; logs.opened points at what was read, and there is nothing
  // else to point it at (T-0111).
  "log",
  "backup",
  "credential",
  "help",
] as const;

export type AnalyticsEntityType = (typeof ANALYTICS_ENTITY_TYPES)[number];

/**
 * Types in the taxonomy that nothing emits yet. Each is removed from this list
 * by the batch that lands its emitter: backup.taken left it in B6, when
 * POST /api/backup began writing one, and help.opened in B16, when the Help
 * page began recording the guide it rendered. research.cancelled (B14) is the
 * one left. Until then they are charted if they ever appear and asked of
 * nobody.
 */
const NOT_YET_EMITTED: readonly string[] = ["research.cancelled"];

/** Failures are recorded and charted; they are never something to collect. */
const FAILURE_TYPES: readonly string[] = [
  "mission.failed",
  "research.failed",
  "composer.run_failed",
  "script.run_not_started",
];

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
