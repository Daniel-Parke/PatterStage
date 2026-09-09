/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-require-imports */
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
// Amended 2026-09-10 (C3, T-0138): the hub reads through useApiResource.
import { renderWithQuery } from "../helpers/render-with-query";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import LoadErrorBanner from "@/components/ui/LoadErrorBanner";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/components/layout/AppPageShell", () => require("../helpers/mocks").appPageShellMock());
jest.mock("@/components/layout/PageHeader", () => ({ __esModule: true, default: () => <div /> }));
jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());

const ROOT = join(__dirname, "..", "..");

describe("LoadErrorBanner", () => {
  it("has a compact variant that still announces and still retries", () => {
    const onRetry = jest.fn();
    render(<LoadErrorBanner compact error="Couldn't load conversations" onRetry={onRetry} />);
    const alert = screen.getByRole("alert");
    // `body`, not `xs`. A compact banner is still prose, and prose at 12px is
    // the defect T-0119 removes; compact now means less padding and a tighter
    // gap rather than smaller words.
    expect(alert.className).toMatch(/text-body/);
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
    renderWithQuery(<Hub />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    // Amended 2026-09-07 (U12, T-0126): the hub is the library, and its empty
    // shelf says so in the library's words.
    expect(screen.queryByText(/bookshelf is empty/i)).toBeNull();
  });
});
