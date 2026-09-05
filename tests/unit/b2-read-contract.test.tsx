/** @jest-environment jsdom */
/**
 * B2 (T-0096), the read contract: a list read that failed shows an error with
 * Retry, never an empty state. Nine pages rendered "no X yet" over a failed
 * fetch (Composer runs, Missions, Agents, Library, Characters, Themes,
 * Research, Artifacts, the Chat sidebar); the Story Weaver hub rendered its
 * error banner AND its empty state together. LoadErrorBanner gains a compact
 * variant for sidebars, ErrorBanner (message only, no retry) is retired, and
 * tests/e2e/read-contract.spec.ts drives every page against a 500.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import LoadErrorBanner from "@/components/ui/LoadErrorBanner";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/components/layout/AppPageShell", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock("@/components/layout/PageHeader", () => ({ __esModule: true, default: () => <div /> }));
jest.mock("lucide-react", () => {
  const icon = (name: string) =>
    function Icon(props: Record<string, unknown>) {
      return <svg data-icon={name} aria-hidden="true" {...props} />;
    };
  return new Proxy({}, { get: (_t, prop: string) => icon(prop) });
});

const ROOT = join(__dirname, "..", "..");

describe("LoadErrorBanner", () => {
  it("has a compact variant that still announces and still retries", () => {
    const onRetry = jest.fn();
    render(<LoadErrorBanner compact error="Couldn't load conversations" onRetry={onRetry} />);
    const alert = screen.getByRole("alert");
    expect(alert.className).toMatch(/text-xs/);
    screen.getByRole("button", { name: /retry/i }).click();
    expect(onRetry).toHaveBeenCalled();
  });
});

describe("ErrorBanner is retired", () => {
  it("is no longer exported and no longer imported", async () => {
    const mod = await import("@/components/ui/LoadingSpinner");
    expect("ErrorBanner" in mod).toBe(false);
    for (const f of ["src/app/agent/settings/[section]/page.tsx", "src/app/agent/models/page.tsx", "src/components/memory/hindsight/HealthBanner.tsx"]) {
      const src = readFileSync(join(ROOT, f), "utf-8");
      expect({ f, uses: /\bErrorBanner\b/.test(src) }).toEqual({ f, uses: false });
    }
  });
});

describe("the Story Weaver hub", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("shows the error and Retry, and NOT the empty state, when the list read fails", async () => {
    globalThis.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ error: "database locked" }), { status: 500, headers: { "content-type": "application/json" } }),
    ) as unknown as typeof fetch;
    const { default: Hub } = await import("@/app/recroom/story-weaver/page");
    render(<Hub />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText(/your story awaits/i)).toBeNull();
  });
});
