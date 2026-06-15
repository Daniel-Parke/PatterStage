// ═══════════════════════════════════════════════════════════════
// analytics/event-types.ts — interaction event taxonomy (single source)
//
// Dependency-free so it can be imported by migration code, the repository,
// the Zod query schema, and the achievement engine without dragging in the
// @/lib/db Jest mock. Adding a new event type = append to the tuple here and
// emit it via recordEvent() — no SQL migration needed (the table has no CHECK
// on event_type; the taxonomy is enforced at this TypeScript boundary).
// ═══════════════════════════════════════════════════════════════

/** Every meaningful Control Hub interaction we log to analytics_events. */
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
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

/** The kind of entity an event refers to (entity_id points into that table). */
export type AnalyticsEntityType =
  | "mission"
  | "run"
  | "story"
  | "session"
  | "skill"
  | "personality"
  | "schedule"
  | "chat"
  | "model";
