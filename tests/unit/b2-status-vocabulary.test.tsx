/** @jest-environment jsdom */
/**
 * B2 (T-0096), decision 13: one status vocabulary, ratified by the operator.
 *
 *   Draft · Queued · Running · Waiting for you · Completed · Failed · Cancelled
 *   Healthy · Degraded · Not running · Not installed
 *   In sync · Out of sync
 *
 * The same fact used to wear a different word on every screen: a finished
 * mission was "Successful" on the dashboard badge, "Finished" on the board and
 * "Completed" in the insights strip; a story was "Failed" on the hub and
 * counted as "In Progress" in the library. src/lib/status-labels.ts is the one
 * map, typed exhaustively, and the badges read it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";

import {
  COMPOSER_RUN_STATUS_LABELS,
  SESSION_STATUS_LABELS,
  STATUS_VOCABULARY,
  SUBSYSTEM_STATE_LABELS,
  SYNC_STATUS_LABELS,
  missionStatusLabel,
} from "@/lib/status-labels";
import { STORY_STATUS_LABELS } from "@/modules/rec-room/lib/story-status-labels";
import { describeMissionRunState } from "@/lib/missions/mission-run-state";
import { MissionStatusBadge } from "@/components/dashboard/StatusBadge";
import StoryCard from "@/modules/rec-room/components/StoryCard";

const ROOT = join(__dirname, "..", "..");
const VOCAB = new Set<string>(STATUS_VOCABULARY);

describe("the vocabulary", () => {
  it("is the ratified thirteen words", () => {
    expect([...STATUS_VOCABULARY]).toEqual([
      "Draft",
      "Queued",
      "Running",
      "Waiting for you",
      "Completed",
      "Failed",
      "Cancelled",
      "Healthy",
      "Degraded",
      "Not running",
      "Not installed",
      "In sync",
      "Out of sync",
    ]);
  });

  it("every map speaks only those words", () => {
    for (const map of [SESSION_STATUS_LABELS, COMPOSER_RUN_STATUS_LABELS, SUBSYSTEM_STATE_LABELS, SYNC_STATUS_LABELS, STORY_STATUS_LABELS]) {
      for (const label of Object.values(map)) expect(VOCAB.has(label)).toBe(true);
    }
  });
});

describe("missions", () => {
  it("a mission reads Draft, Queued, Running, Completed, Failed or Cancelled", () => {
    expect(missionStatusLabel({ status: "queued" })).toBe("Draft");
    expect(missionStatusLabel({ status: "queued", queuedForRun: true })).toBe("Queued");
    expect(missionStatusLabel({ status: "dispatched" })).toBe("Running");
    expect(missionStatusLabel({ status: "successful" })).toBe("Completed");
    expect(missionStatusLabel({ status: "failed" })).toBe("Failed");
    expect(missionStatusLabel({ status: "failed", runStatus: "cancelled" })).toBe("Cancelled");
  });

  it("the board's run state uses the same words", () => {
    const now = Date.parse("2026-09-05T12:00:00Z");
    const done = describeMissionRunState(
      { status: "successful", createdAt: "2026-09-05T11:00:00Z", updatedAt: "2026-09-05T11:57:00Z", run: null },
      now,
    );
    expect(done.label).toBe("Completed");
    const waiting = describeMissionRunState(
      { status: "queued", queuedForRun: true, createdAt: "2026-09-05T11:00:00Z", updatedAt: "2026-09-05T11:00:00Z" },
      now,
    );
    expect(waiting.label).toBe("Queued");
  });

  it("the dashboard badge reads the map, not a title-cased enum", () => {
    render(
      <>
        <MissionStatusBadge status="successful" />
        <MissionStatusBadge status="dispatched" />
      </>,
    );
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.queryByText("Successful")).toBeNull();
    expect(screen.queryByText("Dispatched")).toBeNull();
  });
});

describe("sessions, composer, subsystems, sync", () => {
  it("map every state", () => {
    expect(SESSION_STATUS_LABELS).toEqual({ active: "Running", completed: "Completed", failed: "Failed" });
    expect(COMPOSER_RUN_STATUS_LABELS.awaiting_approval).toBe("Waiting for you");
    expect(COMPOSER_RUN_STATUS_LABELS.pending).toBe("Queued");
    expect(SUBSYSTEM_STATE_LABELS).toEqual({ ok: "Healthy", degraded: "Degraded", down: "Not running" });
    expect(SYNC_STATUS_LABELS).toEqual({ synced: "In sync", drift: "Out of sync", error: "Failed" });
  });
});

describe("stories", () => {
  it("a story reads Running, Waiting for you, Completed or Failed", () => {
    expect(STORY_STATUS_LABELS).toEqual({
      generating: "Running",
      active: "Waiting for you",
      complete: "Completed",
      failed: "Failed",
    });
  });

  it("the card reads the map", () => {
    render(
      <>
        <StoryCard story={{ id: "1", title: "A", status: "complete" }} onRead={() => {}} onDelete={() => {}} />
        <StoryCard story={{ id: "2", title: "B", status: "active" }} onRead={() => {}} onDelete={() => {}} />
        <StoryCard story={{ id: "3", title: "C", status: "generating" }} onRead={() => {}} onDelete={() => {}} />
      </>,
    );
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Waiting for you")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.queryByText(/Generating\.\.\./)).toBeNull();
  });

  it("the hub and the library no longer say In Progress or Complete", () => {
    for (const f of ["src/app/recroom/story-weaver/page.tsx", "src/app/recroom/story-weaver/library/page.tsx"]) {
      const src = readFileSync(join(ROOT, f), "utf-8");
      expect({ f, inProgress: /"In Progress|In Progress \(/.test(src) }).toEqual({ f, inProgress: false });
      expect({ f, complete: /label: "Complete"|"Complete"/.test(src) }).toEqual({ f, complete: false });
    }
  });
});
