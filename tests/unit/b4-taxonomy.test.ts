/** @jest-environment node */

// B4 (T-0098) oracle: the analytics taxonomy extended once.
//
// The programme adds twenty-six event types so Insights can see Research and
// the Composer (D95) and so the quests of B17 have a ledger to read. This file
// holds the shape: every type in the tuple, every type in exactly one category,
// every category colour a declared token, and the Completionist achievement
// reading a curated list rather than "all N types", because three of the new
// types have no emitter until B6, B14 and B16 and a failure is not something
// an operator should have to trigger.

import { readFileSync } from "fs";
import { join } from "path";

import {
  ANALYTICS_EVENT_TYPES,
  ANALYTICS_ENTITY_TYPES,
  COMPLETIONIST_EVENT_TYPES,
  type AnalyticsEventType,
} from "@/lib/analytics/event-types";
import { EVENT_CATEGORIES, categoryForEventType } from "@/lib/analytics/categories";

const ORIGINAL = [
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

const ADDED = [
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

/**
 * The two READ events T-0111 added, on the operator's ruling of 2026-09-06.
 *
 * Kept in their own list rather than folded into ADDED, because B4's list is a
 * record of what B4 did and because the distinction is the point: everything
 * above records a write, and these two are the deliberate exception a quest
 * chapter needed. A third one is a decision, not a precedent.
 */
const READS = ["artifact.opened", "logs.opened"] as const;

/**
 * The type added when a script run began recording how it went.
 *
 * Its own list, like READS above and for the same reason: this file is the
 * record of which change added what. `script.run` is the record of a script
 * that RAN, whatever it exited with, and it is what the "run a script" quest
 * is proved by. A run the host could not start therefore needed a type of its
 * own rather than a `script.run` row that would tick that quest for a run
 * nobody performed.
 */
const NEVER_STARTED = ["script.run_not_started"] as const;

/** Types with no emitter until a later batch (B14). backup.taken got one in B6, help.opened in B16. */
const NOT_YET_EMITTED = ["research.cancelled"] as const;

/** Failures: recorded, charted, never required of anyone. */
const FAILURES = [
  "mission.failed",
  "research.failed",
  "composer.run_failed",
  // AMENDED with the taxonomy it mirrors: a run that never started is a
  // failure, so it is charted and is not something to collect.
  "script.run_not_started",
] as const;

const keyOf = (t: string) => categoryForEventType(t)?.key ?? null;

describe("the taxonomy after B4", () => {
  it("keeps the original fourteen, B4's twenty-six, T-0111's two reads and the non-start, each once", () => {
    for (const t of [...ORIGINAL, ...ADDED, ...READS, ...NEVER_STARTED]) {
      expect(ANALYTICS_EVENT_TYPES).toContain(t);
    }
    expect(ANALYTICS_EVENT_TYPES).toHaveLength(
      ORIGINAL.length + ADDED.length + READS.length + NEVER_STARTED.length,
    );
    expect(new Set(ANALYTICS_EVENT_TYPES).size).toBe(ANALYTICS_EVENT_TYPES.length);
  });

  it("names an entity type for every table an event now points into", () => {
    const wanted = [
      "mission", "run", "story", "session", "skill", "personality", "schedule", "chat", "model",
      "research", "composer_run", "workflow", "profile", "toolset", "config", "memory", "template",
      "script", "artifact", "backup", "credential", "help",
    ];
    for (const e of wanted) expect(ANALYTICS_ENTITY_TYPES).toContain(e);
    expect(new Set(ANALYTICS_ENTITY_TYPES).size).toBe(ANALYTICS_ENTITY_TYPES.length);
  });

  it("maps every type to a category that exists, and every category has a type", () => {
    const keys = new Set(EVENT_CATEGORIES.map((c) => c.key));
    expect(keys.size).toBe(EVENT_CATEGORIES.length);
    const used = new Set<string>();
    for (const t of ANALYTICS_EVENT_TYPES) {
      const key = keyOf(t);
      expect(key).not.toBeNull();
      expect(keys.has(key!)).toBe(true);
      used.add(key!);
    }
    for (const key of keys) expect(used.has(key)).toBe(true);
    expect(categoryForEventType("not.a.type")).toBeNull();
  });

  it("adds Research, folds the Composer into Workflows, files Help, and keeps the rest where it was", () => {
    expect(EVENT_CATEGORIES.map((c) => c.key)).toEqual(
      expect.arrayContaining(["missions", "workflows", "research", "stories", "sessions", "automation", "config", "chat", "help"]),
    );
    const labels = Object.fromEntries(EVENT_CATEGORIES.map((c) => [c.key, c.label]));
    expect(labels.research).toBe("Research");
    expect(labels.workflows).toBe("Workflows");
    expect(labels.help).toBe("Help");

    const expectKey = (types: readonly string[], key: string) => {
      for (const t of types) expect({ type: t, key: keyOf(t) }).toEqual({ type: t, key });
    };
    expectKey(["research.started", "research.completed", "research.failed", "research.cancelled"], "research");
    expectKey(
      ["composer.run_started", "composer.run_completed", "composer.run_failed", "composer.gate_approved", "composer.workflow_saved", "artifact.saved"],
      "workflows",
    );
    expectKey(["help.opened"], "help");
    expectKey(["mission.dispatched", "mission.completed", "mission.failed", "mission.cancelled", "template.saved"], "missions");
    expectKey(
      ["schedule.created", "schedule.fired", "script.saved", "script.run", "script.run_not_started", "script.scheduled"],
      "automation",
    );
    expectKey(
      [
        "skill.toggled", "personality.changed", "model.configured", "model.added", "credential.added",
        "profile.created", "profile.pushed", "profile.pulled", "toolset.saved", "config.saved",
        "memory.configured", "memory.retained", "backup.taken",
      ],
      "config",
    );
    expectKey(["story.created", "story.chapter_generated", "story.completed"], "stories");
    expectKey(["session.started", "session.closed"], "sessions");
    expectKey(["chat.message_sent"], "chat");
  });

  it("paints every category with a declared neon token", () => {
    const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf-8");
    for (const c of EVENT_CATEGORIES) {
      expect({ key: c.key, declared: css.includes(`--color-neon-${c.color}:`) }).toEqual({ key: c.key, declared: true });
    }
  });
});

describe("Completionist reads a curated list", () => {
  it("lists every type that has an emitter today and is not a failure, once each", () => {
    const curated = COMPLETIONIST_EVENT_TYPES as readonly AnalyticsEventType[];
    expect(new Set(curated).size).toBe(curated.length);
    for (const t of curated) expect(ANALYTICS_EVENT_TYPES).toContain(t);
    for (const t of NOT_YET_EMITTED) expect(curated).not.toContain(t);
    for (const t of FAILURES) expect(curated).not.toContain(t);
    const expected = ANALYTICS_EVENT_TYPES.filter(
      (t) => !(NOT_YET_EMITTED as readonly string[]).includes(t) && !(FAILURES as readonly string[]).includes(t),
    );
    expect([...curated].sort()).toEqual([...expected].sort());
  });
});
