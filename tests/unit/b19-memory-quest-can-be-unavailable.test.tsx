/** @jest-environment jsdom */

/**
 * T-0113: quest 3.7 ("Retain a fact") could never read as unavailable.
 *
 * The quest declares `requires: "memory"`, and useQuestHost answered that
 * requirement with `state !== "down"` over the Memory subsystem row. That row
 * is NEVER down: collectSubsystems reports an unreachable memory provider as
 * DEGRADED on purpose, because the agent still runs without memory. So the
 * capability was true on every install, including one with no provider at all,
 * and the dashboard recommended "Retain a fact" on the same screen that said
 * memory was not answering.
 *
 * The host-scheduler quest is the shape 3.7 should have had all along: it reads
 * as unavailable with its reason on a host that cannot run it. These pin that
 * the memory capability can be false, that it is false for the state the
 * collector actually emits, and that an unread or absent row still leaves the
 * quest offered (a status endpoint that has not answered is not a refusal).
 */

import { renderHook } from "@testing-library/react";

import { HOST_REQUIREMENT_COPY, questAvailable, type QuestHostCapabilities } from "@/lib/quests/quest-defs";
import type { SubsystemRow } from "@/lib/status/subsystems";

interface ResourceOptions<T> {
  select: (payload: unknown) => T | undefined;
  fallback?: T;
}

/** What each endpoint answers this test. Undefined means "has not answered". */
let payloads: Record<string, unknown> = {};
let composerFlag: boolean | undefined;

jest.mock("@/hooks/useApiResource", () => ({
  // The endpoint is the key since T-0129: the hook takes (endpoint, opts).
  useApiResource: <T,>(endpoint: string, opts: ResourceOptions<T>) => {
    const payload = payloads[endpoint];
    const value = payload === undefined ? undefined : opts.select(payload);
    return { data: value === undefined ? (opts.fallback ?? null) : value, isLoading: false, error: null };
  },
}));

jest.mock("@/hooks/useFeatureFlags", () => ({
  useFeatureFlags: () => ({ data: { composer: composerFlag }, isLoading: false, error: null }),
}));

import { useQuestHost } from "@/hooks/useQuestHost";

function row(id: SubsystemRow["id"], state: SubsystemRow["state"], reason: string): SubsystemRow {
  return { id, label: id, state, reason };
}

function host(rows: SubsystemRow[] | undefined, platform = "linux"): QuestHostCapabilities {
  payloads = {};
  if (rows) payloads["/api/status/subsystems"] = { checkedAt: "2026-09-06T00:00:00.000Z", subsystems: rows };
  payloads["/api/status/runtime"] = { platform };
  return renderHook(() => useQuestHost()).result.current;
}

const OK_ROWS = [row("gateway", "ok", "reachable"), row("memory", "ok", "hindsight is answering")];

beforeEach(() => {
  payloads = {};
  composerFlag = true;
});

describe("the memory capability follows the row the collector actually emits", () => {
  it("is false when the memory provider is not answering", () => {
    // The state collectSubsystems emits for an unreachable provider. It is
    // degraded rather than down because memory is optional to the agent, which
    // is exactly why "not down" was the wrong question to ask of it.
    const caps = host([row("gateway", "ok", "reachable"), row("memory", "degraded", "none: no provider is configured")]);
    expect(caps.memory).toBe(false);
    expect(questAvailable({ requires: "memory" }, caps)).toBe(false);
  });

  it("is false when the memory row could not be checked", () => {
    const caps = host([row("memory", "degraded", "could not check: health check failed")]);
    expect(caps.memory).toBe(false);
  });

  it("GREEN CONTROL: is true when the provider is answering", () => {
    const caps = host(OK_ROWS);
    expect(caps.memory).toBe(true);
    expect(questAvailable({ requires: "memory" }, caps)).toBe(true);
  });

  it("is true while the subsystems read has not answered yet", () => {
    // Unknown is not a refusal: a slow status endpoint must not shorten the
    // programme the operator can see.
    const caps = host(undefined);
    expect(caps.memory).toBe(true);
  });

  it("is true on an install that sends no memory row at all", () => {
    const caps = host([row("gateway", "ok", "reachable")]);
    expect(caps.memory).toBe(true);
  });
});

describe("the reason the operator now actually reads", () => {
  it("says what would change it, the way the other three do", () => {
    // The sentence was written for a case that could not happen, so it stopped
    // at what is missing. Now that it renders, it has to carry the next action:
    // a provider is connected on Agent then Memory, which is quest 3.6.
    const line = HOST_REQUIREMENT_COPY.memory;
    expect(line).toMatch(/connect/i);
    expect(line).toMatch(/memory/i);
  });
});

describe("the other three capabilities are unchanged by it", () => {
  it("still reads the gateway off its own row, where down is the only refusal", () => {
    expect(host([row("gateway", "down", "nothing at 127.0.0.1:8642"), row("memory", "ok", "answering")]).gateway).toBe(false);
    // A gateway the collector could not check is not a gateway that is down.
    expect(host([row("gateway", "degraded", "could not check: timed out")]).gateway).toBe(true);
  });

  it("does not let a missing memory provider hide the gateway quests", () => {
    const caps = host([row("gateway", "ok", "reachable"), row("memory", "degraded", "none: no provider is configured")]);
    expect(questAvailable({ requires: "gateway" }, caps)).toBe(true);
  });

  it("still reads the Composer flag and the host scheduler", () => {
    composerFlag = false;
    expect(host(OK_ROWS).composer).toBe(false);
    composerFlag = true;
    expect(host(OK_ROWS).composer).toBe(true);
    expect(host(OK_ROWS, "win32").hostScheduler).toBe(false);
    expect(host(OK_ROWS, "linux").hostScheduler).toBe(true);
  });
});
