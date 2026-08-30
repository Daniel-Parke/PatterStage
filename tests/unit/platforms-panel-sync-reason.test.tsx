/** @jest-environment jsdom */
// ═══════════════════════════════════════════════════════════════
// The dashboard says WHY the sync failed (T-0034, finding 2).
//
// PlatformsPanel drew a red cross beside "Sync: 4m ago" and stopped there. The
// cross is the whole message: it tells an operator that something is broken and
// nothing about what, on a surface whose entire purpose is to be read at a
// glance. The reason existed on the server the whole time.
//
// The companion oracle to monitor-sync-source-errors.test.ts, which pins the
// payload. This one pins that the panel actually renders it, and that a healthy
// sync stays quiet.
// ═══════════════════════════════════════════════════════════════

import { render, screen } from "@testing-library/react";

import PlatformsPanel from "@/modules/hermes/components/PlatformsPanel";
import type { MonitorData } from "@/types/console";

function monitor(sync: Partial<MonitorData["sync"]>): MonitorData {
  return {
    sessions: { total: 0, recent: [] },
    gateway: { platforms: {}, connectedCount: 0 },
    memory: { factCount: 0, dbSize: "N/A", provider: "Not Installed" },
    errors: [],
    system: { uptime: "N/A", configPresent: true, soulPresent: true, configYamlError: null },
    sync: {
      lastRun: "2026-08-25T09:00:00Z",
      allSuccessful: true,
      sourceStatuses: {},
      sourceErrors: {},
      ...sync,
    },
    scheduler: {
      ownerPid: 1,
      lastTickAt: "2026-08-25T09:00:00Z",
      stale: false,
      staleAfterMs: 90_000,
      selfPid: 1,
    },
  };
}

const noop = () => {};

describe("PlatformsPanel — the sync footer", () => {
  it("names the failing source and its reason instead of a bare cross", () => {
    render(
      <PlatformsPanel
        monitor={monitor({
          allSuccessful: false,
          sourceStatuses: { missions: "ok", cron: "error" },
          sourceErrors: { cron: "ENOENT: no such file or directory, open '/home/op/.hermes/crontab'" },
        })}
        syncNowBusy={false}
        onSyncNow={noop}
      />,
    );
    // Exact, because the reason itself mentions a crontab: a loose match here
    // would pass on the message alone and stop proving the source is named.
    expect(screen.getByText("cron")).toBeInTheDocument();
    expect(screen.getByText(/no such file or directory/)).toBeInTheDocument();
  });

  it("still says a source failed when the scheduler kept no message for it", () => {
    // A failure with no text is the case that must not go back to being silent:
    // the status says error, so the panel says error, in words.
    render(
      <PlatformsPanel
        monitor={monitor({
          allSuccessful: false,
          sourceStatuses: { cron: "error" },
          sourceErrors: {},
        })}
        syncNowBusy={false}
        onSyncNow={noop}
      />,
    );
    expect(screen.getByText("cron")).toBeInTheDocument();
    expect(screen.getByText(/no message recorded/)).toBeInTheDocument();
  });

  it("stays quiet when every source is healthy", () => {
    render(
      <PlatformsPanel
        monitor={monitor({ allSuccessful: true, sourceStatuses: { cron: "ok" }, sourceErrors: {} })}
        syncNowBusy={false}
        onSyncNow={noop}
      />,
    );
    expect(screen.queryByText(/no such file/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
