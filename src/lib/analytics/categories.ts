// ═══════════════════════════════════════════════════════════════
// analytics/categories.ts — map the event types into readable categories.
// Shared by the Insights donut, the per-category stacked-area, and the
// insights bundle so the colour/label set stays consistent.
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
  { key: "stories", label: "Stories", color: "purple" },
  { key: "sessions", label: "Sessions", color: "green" },
  { key: "automation", label: "Automation", color: "orange" },
  { key: "config", label: "Config", color: "pink" },
  { key: "chat", label: "Chat", color: "yellow" },
];

const TYPE_TO_KEY: Record<AnalyticsEventType, string> = {
  "mission.dispatched": "missions",
  "mission.completed": "missions",
  "mission.failed": "missions",
  "story.created": "stories",
  "story.chapter_generated": "stories",
  "story.completed": "stories",
  "session.started": "sessions",
  "session.closed": "sessions",
  "schedule.created": "automation",
  "schedule.fired": "automation",
  "skill.toggled": "config",
  "personality.changed": "config",
  "model.configured": "config",
  "chat.message_sent": "chat",
  // Benchmarks are a separate axis (Agent Rating), not operator engagement —
  // they map to a key with no rendered category, so categoryForEventType()
  // returns null and they stay out of the Insights engagement donut.
  "benchmark.started": "benchmarks",
  "benchmark.completed": "benchmarks",
  "benchmark.failed": "benchmarks",
};

const KEY_TO_CATEGORY = new Map(EVENT_CATEGORIES.map((c) => [c.key, c]));

/** Category for an event type, or null when unmapped. */
export function categoryForEventType(type: string): EventCategory | null {
  const key = TYPE_TO_KEY[type as AnalyticsEventType];
  return key ? (KEY_TO_CATEGORY.get(key) ?? null) : null;
}
