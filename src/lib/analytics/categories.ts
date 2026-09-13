// ═══════════════════════════════════════════════════════════════
// analytics/categories.ts — map the event types into readable categories.
// Shared by the Insights donut, the per-category stacked-area, and the
// insights bundle so the colour/label set stays consistent.
//
// Nine categories over six neon tokens (T-0098, B4). Three pairs share a
// colour (workflows/config, research/chat, help/sessions) and are placed
// apart in the series order so no two adjacent bands of the stacked area
// read as one. The Composer is folded into Workflows with the artifacts it
// and Research produce; Research and Help are their own rows because the
// quests read them (D95).
// ═══════════════════════════════════════════════════════════════

import type { AnalyticsEventType } from "./event-types";
import type { NeonColor } from "@/components/viz/colors";

export interface EventCategory {
  key: string;
  label: string;
  color: NeonColor;
}

/** Ordered category catalog (the stacked-area series order). */
export const EVENT_CATEGORIES: EventCategory[] = [
  { key: "missions", label: "Missions", color: "cyan" },
  { key: "workflows", label: "Workflows", color: "pink" },
  { key: "stories", label: "Stories", color: "purple" },
  { key: "research", label: "Research", color: "yellow" },
  { key: "sessions", label: "Sessions", color: "green" },
  { key: "automation", label: "Automation", color: "orange" },
  { key: "config", label: "Config", color: "pink" },
  { key: "chat", label: "Chat", color: "yellow" },
  { key: "help", label: "Help", color: "green" },
];

const TYPE_TO_KEY: Record<AnalyticsEventType, string> = {
  "mission.dispatched": "missions",
  "mission.completed": "missions",
  "mission.failed": "missions",
  "mission.cancelled": "missions",
  "template.saved": "missions",
  "story.created": "stories",
  "story.chapter_generated": "stories",
  "story.completed": "stories",
  "session.started": "sessions",
  "session.closed": "sessions",
  "schedule.created": "automation",
  "schedule.fired": "automation",
  "script.saved": "automation",
  "script.run": "automation",
  "script.run_not_started": "automation",
  "script.scheduled": "automation",
  "skill.toggled": "config",
  "personality.changed": "config",
  "model.configured": "config",
  "model.added": "config",
  "credential.added": "config",
  "profile.created": "config",
  "profile.pushed": "config",
  "profile.pulled": "config",
  "toolset.saved": "config",
  "config.saved": "config",
  "memory.configured": "config",
  "memory.retained": "config",
  "backup.taken": "config",
  "chat.message_sent": "chat",
  "research.started": "research",
  "research.completed": "research",
  "research.failed": "research",
  "research.cancelled": "research",
  "composer.run_started": "workflows",
  "composer.run_completed": "workflows",
  "composer.run_failed": "workflows",
  "composer.gate_approved": "workflows",
  "composer.workflow_saved": "workflows",
  "artifact.saved": "workflows",
  "help.opened": "help",
  // Reads, categorised where the thing being read lives.
  "artifact.opened": "workflows",
  "logs.opened": "automation",
};

const KEY_TO_CATEGORY = new Map(EVENT_CATEGORIES.map((c) => [c.key, c]));

/** Category for an event type, or null when unmapped. */
export function categoryForEventType(type: string): EventCategory | null {
  const key = TYPE_TO_KEY[type as AnalyticsEventType];
  return key ? (KEY_TO_CATEGORY.get(key) ?? null) : null;
}
