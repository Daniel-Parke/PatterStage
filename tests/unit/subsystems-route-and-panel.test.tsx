/**
 * @jest-environment jsdom
 */

// T-0091: the route publishes the summary and the dashboard panel renders it
// as rows a person can read: a state, a label, and the reason.

import { render } from "@testing-library/react";
import SubsystemsPanel from "@/components/dashboard/SubsystemsPanel";
import type { SubsystemRow } from "@/lib/status/subsystems";

const rows: SubsystemRow[] = [
  { id: "gateway", label: "Gateway", state: "ok", reason: "reachable at http://127.0.0.1:8642" },
  { id: "memory", label: "Memory", state: "degraded", reason: "hindsight: ECONNREFUSED 127.0.0.1:9177" },
  { id: "sync", label: "Sync", state: "ok", reason: "last cycle clean at 2026-09-05T10:00:00Z" },
  { id: "config", label: "config.yaml", state: "down", reason: "does not parse: duplicated mapping key (27:1)" },
  { id: "gate", label: "Gateway gate", state: "ok", reason: "12 admitted, 0 refused" },
];

describe("SubsystemsPanel", () => {
  it("renders one row per subsystem with its reason", () => {
    const { container } = render(<SubsystemsPanel subsystems={rows} checkedAt="2026-09-05T10:00:05Z" />);

    const items = container.querySelectorAll('[role="listitem"]');
    expect(items).toHaveLength(5);
    expect(container.textContent).toContain("ECONNREFUSED 127.0.0.1:9177");
    expect(container.textContent).toContain("duplicated mapping key (27:1)");
  });

  it("says the state in words, not only in colour", () => {
    const { container } = render(<SubsystemsPanel subsystems={rows} checkedAt="2026-09-05T10:00:05Z" />);

    const states = Array.from(container.querySelectorAll("[data-state]")).map((el) => el.getAttribute("data-state"));
    expect(states).toEqual(["ok", "degraded", "ok", "down", "ok"]);
    // The ratified words (decision 13), shared with the pills above (T-0099).
    expect(container.textContent).toMatch(/Not running/);
    expect(container.textContent).toMatch(/Degraded/);
    expect(container.textContent).toMatch(/Healthy/);
  });

  it("has a calm state while the first check is in flight", () => {
    const { container } = render(<SubsystemsPanel subsystems={null} checkedAt={null} />);

    expect(container.querySelectorAll('[role="listitem"]')).toHaveLength(0);
    expect(container.textContent).toMatch(/checking/i);
  });
});

describe("GET /api/status/subsystems", () => {
  it("answers the five rows and when it looked", async () => {
    jest.resetModules();
    jest.doMock("@/lib/status/subsystems", () => ({
      collectSubsystems: async () => ({ checkedAt: "2026-09-05T10:00:05Z", subsystems: rows }),
      liveSubsystemDeps: () => ({}),
    }));
    jest.doMock("@/lib/api-logger", () => ({ serverErrorFromCatch: jest.fn() }));
    const { GET } = (await import("@/app/api/status/subsystems/route")) as { GET: () => Promise<Response> };

    const res = await GET();
    const body = (await res.json()) as { data: { subsystems: SubsystemRow[]; checkedAt: string } };

    expect(res.status).toBe(200);
    expect(body.data.subsystems.map((r) => r.id)).toEqual(["gateway", "memory", "sync", "config", "gate"]);
    expect(body.data.checkedAt).toBe("2026-09-05T10:00:05Z");
  });
});
