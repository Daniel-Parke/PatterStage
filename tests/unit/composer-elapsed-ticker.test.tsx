/**
 * @jest-environment jsdom
 */

// T-0089: round 6, finding 13, cheaper than proposed. A composer stage with a
// long LLM behind it showed "started 2 minutes ago" from a 3-second poll and
// nothing else; the report asked for server heartbeats. Every snapshot
// already carries the node run's startedAt, so a client-side ticker needs
// zero server changes.

import { act, render } from "@testing-library/react";
import ElapsedSince from "@/components/composer/ElapsedSince";
import ComposerNodeRunDetail from "@/components/composer/ComposerNodeRunDetail";
import type { ComposerNode, ComposerNodeRun } from "@/lib/composer/schema";

jest.mock("@/lib/api-fetch", () => ({ safeApiCall: jest.fn() }));

// The Sheet reads a media query; jsdom has no matchMedia.
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false }),
  });
});

describe("ElapsedSince", () => {
  beforeEach(() => jest.useFakeTimers({ now: Date.parse("2026-09-05T10:00:00Z") }));
  afterEach(() => jest.useRealTimers());

  it("counts up every second from the given instant", () => {
    const { container } = render(<ElapsedSince since="2026-09-05T09:59:30Z" />);
    expect(container.textContent).toContain("0:30");

    act(() => { jest.advanceTimersByTime(31_000); });

    expect(container.textContent).toContain("1:01");
  });

  it("carries the accessible name of a live timer", () => {
    const { container } = render(<ElapsedSince since="2026-09-05T10:00:00Z" />);
    expect(container.querySelector("time")).not.toBeNull();
  });
});

describe("the stage sheet shows a live elapsed time while a stage runs", () => {
  beforeEach(() => jest.useFakeTimers({ now: Date.parse("2026-09-05T10:00:00Z") }));
  afterEach(() => jest.useRealTimers());

  const node = { id: "n1", kind: "worker", label: "Draft", gate: "auto" } as unknown as ComposerNode;
  const running = {
    id: "nr1", nodeId: "n1", status: "running", attempt: 1,
    startedAt: "2026-09-05T09:58:00Z", completedAt: null, verdict: null, error: null, output: null,
  } as unknown as ComposerNodeRun;

  // Sheet renders through a portal into document.body, so the RTL container
  // is empty; read the body.
  it("ticks while running", () => {
    render(<ComposerNodeRunDetail open onClose={() => {}} node={node} nodeRun={running} />);
    expect(document.body.textContent).toContain("2:00");

    act(() => { jest.advanceTimersByTime(5_000); });

    expect(document.body.textContent).toContain("2:05");
  });

  it("does not tick once the stage has completed", () => {
    const done = { ...running, status: "completed", completedAt: "2026-09-05T09:59:00Z" } as unknown as ComposerNodeRun;
    render(<ComposerNodeRunDetail open onClose={() => {}} node={node} nodeRun={done} />);

    expect(document.body.textContent).toContain("Draft");
    expect(document.body.querySelector("time")).toBeNull();
  });
});
