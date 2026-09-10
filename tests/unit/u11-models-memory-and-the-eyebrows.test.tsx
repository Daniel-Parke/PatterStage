/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * U11 (T-0125): the smaller repairs on Models, Memory, Tools, Restore and
 * System, each one measured.
 *
 *   Models   At 1024 the table was 898px inside a 774px scroll container and
 *            the clipped part was ACTIONS, with no scrollbar cue. It is a
 *            DataList now, and below xl the rows stack. The eight task-default
 *            descriptions each lost 97-256px to `truncate`; they wrap to two
 *            lines instead. And the CONFIG back link goes: Models is a rail
 *            entry, and the rail already says where you are.
 *   Memory   A 43px search box beside 33px buttons, with a "Press Enter to
 *            search" line under the box that put the buttons on a different
 *            baseline. One height, and Enter is what the Recall button beside
 *            it does.
 *   Tools    The strip restated the subtitle; the subtitle carries the count.
 *   Restore and System are siblings under Settings and carried CONFIG and
 *            SETTINGS as their eyebrows. One word.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import { pageSubtitle } from "../helpers/page-subtitle";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

jest.mock("next/navigation", () => ({
  usePathname: () => "/agent/models",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock("next/link", () => require("../helpers/mocks").nextLinkMock());
jest.mock("@/components/layout/AppPageShell", () => require("../helpers/mocks").appPageShellMock());
jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());
jest.mock("@/components/ui/ProfilePicker", () => ({
  __esModule: true,
  default: () => <div data-testid="profile-picker" />,
}));
jest.mock("@/hooks/useProfiles", () => ({
  useProfiles: () => ({
    refetch: async () => undefined, data: [{ id: "default", name: "Bob (local default)", description: "" }],
    isLoading: false,
    error: null,
  }),
}));

const mockApiFetch = jest.fn();
const mockSafeApiCallData = jest.fn();
jest.mock("@/lib/api-fetch", () => ({
  ...(jest.requireActual("@/lib/api-fetch") as Record<string, unknown>),
  apiFetch: (...a: unknown[]) => mockApiFetch(...a),
  // The Tools page reads through useApiResource, which calls safeApiCall; routed
  // through the same mock so a read is still one of the paths asked for (C6, T-0143).
   
  safeApiCall: require("../helpers/mocks").safeApiCallOver((...a: unknown[]) => mockApiFetch(...a)),
  safeApiCallData: (...a: unknown[]) => mockSafeApiCallData(...a),
}));

import ModelsTableSection from "@/components/models/ModelsTableSection";
import DefaultsGrid from "@/components/models/DefaultsGrid";
import HindsightBrowser from "@/components/memory/HindsightBrowser";
import ToolsPage from "@/app/agent/tools/page";
import { TASK_TYPES } from "@/lib/models/task-types";

function withQuery(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

const MODEL = {
  id: "m1",
  name: "Sonnet",
  provider: "anthropic",
  modelId: "claude-sonnet-4",
  baseUrl: null,
  contextLength: 200000,
  credentialsId: null,
  apiStyle: null,
  createdAt: "",
  updatedAt: "",
};

describe("the Models table", () => {
  it("is a DataList that stacks below xl, with the actions inside every row", () => {
    render(
      <ModelsTableSection
        models={[MODEL as never]}
        defaults={Object.fromEntries(TASK_TYPES.map((t) => [t, null])) as never}
        busyTaskType={null}
        onAddModel={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onPush={jest.fn()}
        onPull={jest.fn()}
      />,
    );
    const table = screen.getByRole("table", { name: /models/i });
    expect(table.className).toMatch(/\bxl:table\b/);
    const row = screen.getByTestId("model-row-m1");
    expect(within(row).getByRole("button", { name: /Edit Sonnet/ })).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: /Delete Sonnet/ })).toBeInTheDocument();
  });
});

describe("the task-default descriptions", () => {
  it("wrap rather than truncate", () => {
    const { container } = render(
      <DefaultsGrid defaults={Object.fromEntries(TASK_TYPES.map((t) => [t, null])) as never} models={[]} onChange={jest.fn()} />,
    );
    const descriptions = Array.from(container.querySelectorAll("[data-task-slot] p"));
    expect(descriptions.length).toBeGreaterThan(0);
    for (const p of descriptions) {
      expect(p.className).not.toMatch(/\btruncate\b/);
      expect(p.className).toMatch(/\bline-clamp-2\b/);
    }
  });
});

describe("the Memory search row", () => {
  it("is one height, and no longer tells you to press Enter", async () => {
    mockSafeApiCallData.mockResolvedValue(null);
    mockApiFetch.mockResolvedValue({ data: { memories: [], health: { available: false } } });
    render(withQuery(<HindsightBrowser />));
    const box = await screen.findByRole("textbox", { name: /search memories/i });
    expect(screen.queryByText(/press enter/i)).toBeNull();
    const recall = screen.getByRole("button", { name: /Recall/ });
    const add = screen.getByRole("button", { name: /Add Memory/ });
    const height = (el: Element) => (el.className.match(/\bh-\d+(?:\.\d+)?\b/) ?? [])[0];
    expect(height(box)).toBeTruthy();
    expect(height(recall)).toBe(height(box));
    expect(height(add)).toBe(height(box));
  });
});

describe("the Tools subtitle carries the count the strip carried", () => {
  it("says how many of the catalogue are on, for whom, and how many platforms it fans out to", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/toolsets")) {
        return { data: { platformToolsets: { cli: ["web"] }, unifiedEnabled: ["web"], source: "database", platformsDiverged: false } };
      }
      return { data: { success: true } };
    });
    mockSafeApiCallData.mockResolvedValue({ profiles: [] });
    render(withQuery(<ToolsPage />));
    await waitFor(() => expect(screen.getByText("Enabled toolsets")).toBeInTheDocument());
    expect(screen.queryByTestId("stat-tile")).toBeNull();
    expect(screen.queryByTestId("stat-ring")).toBeNull();
    const subtitle = pageSubtitle();
    expect(subtitle).toHaveTextContent(/1 of \d+ toolsets enabled/);
    expect(subtitle).toHaveTextContent(/Bob/);
    expect(subtitle).toHaveTextContent(/\d+ platforms/);
  });
});

describe("the eyebrows agree", () => {
  it("Restore and System both come back to SETTINGS; Models carries none", () => {
    const { readFileSync } = require("fs") as typeof import("fs");
    const { join } = require("path") as typeof import("path");
    const read = (p: string) => readFileSync(join(__dirname, "..", "..", "src", "app", "agent", ...p.split("/")), "utf-8");
    expect(read("settings/restore/page.tsx")).toMatch(/backLabel="SETTINGS"/);
    expect(read("settings/system/page.tsx")).toMatch(/backLabel="SETTINGS"/);
    expect(read("settings/restore/page.tsx")).not.toMatch(/backLabel="CONFIG"/);
    expect(read("models/page.tsx")).not.toMatch(/backHref/);
  });
});
