/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * U19 · An empty page offers its action.
 *
 * Automation's empty state was a sentence with 700px of ground under it; the
 * one thing to do, Schedule a mission, was in the section header. Artifacts'
 * empty state pointed at Deep Research and Composer in words with no way
 * there. Story Weaver's empty shelf does it right: the action is in the
 * empty state (the UI review of 2026-09-08, P3). EmptyState already has the
 * `action` slot; both pages use it, on the primitive rather than a dashed box
 * of their own.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());
jest.mock("next/link", () => require("../helpers/mocks").nextLinkMock());
jest.mock("next/navigation", () => ({
  usePathname: () => "/results/artifacts",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("@/components/help/ConceptHint", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

const schedules = {
  schedules: [] as unknown[],
  isLoading: false,
  error: null as string | null,
  refetch: jest.fn(),
  create: { mutate: jest.fn(), isPending: false },
  remove: { mutate: jest.fn() },
  toggle: { mutate: jest.fn() },
  runNow: { mutate: jest.fn() },
};
jest.mock("@/hooks/useSchedules", () => ({
  useSchedules: () => schedules,
  useMissionOptions: () => [],
}));
jest.mock("@/hooks/useScripts", () => ({
  useScripts: () => ({ scripts: [], isLoading: false, error: null }),
}));

const mockUseArtifacts = jest.fn();
jest.mock("@/hooks/useArtifacts", () => ({
  useArtifacts: () => mockUseArtifacts(),
  useArtifact: () => ({ data: null, isLoading: false, error: null, refetch: jest.fn() }),
}));
jest.mock("@/lib/api/api-fetch", () => ({
  ...(jest.requireActual("@/lib/api/api-fetch") as Record<string, unknown>),
  safeApiCall: jest.fn(),
}));

import AutomationList from "@/components/automation/AutomationList";
import ArtifactsPage from "@/app/results/artifacts/page";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe("U19 · an empty page offers its action", () => {
  it("Automation's empty state carries Schedule a mission, and it opens the form", () => {
    render(<AutomationList />);
    const title = screen.getByRole("heading", { level: 3, name: /Nothing is on a clock yet/ });
    const empty = title.parentElement!;
    const action = screen.getAllByRole("button", { name: "Schedule a mission" }).find((b) => empty.contains(b));
    expect(action).toBeDefined();
    fireEvent.click(action!);
    expect(screen.getByLabelText("Schedule name")).toBeInTheDocument();
  });

  it("Artifacts' empty state carries the two ways to make one", () => {
    mockUseArtifacts.mockReturnValue({ data: [], isLoading: false, error: null, refetch: jest.fn() });
    render(<ArtifactsPage />);
    const title = screen.getByRole("heading", { level: 3, name: "No artifacts yet" });
    const empty = title.parentElement!;
    const research = screen.getByRole("link", { name: /Deep Research/ });
    const composer = screen.getByRole("link", { name: /Composer/ });
    expect(research).toHaveAttribute("href", "/work/research");
    expect(composer).toHaveAttribute("href", "/work/composer");
    expect(empty.contains(research)).toBe(true);
    expect(empty.contains(composer)).toBe(true);
  });

  it("both are the primitive, and the dashed box is gone", () => {
    const automation = read("src/components/automation/AutomationList.tsx");
    expect(automation).toMatch(/from "@\/components\/ui\/EmptyState"/);
    expect(automation).not.toMatch(/border-dashed/);
    expect(read("src/app/results/artifacts/page.tsx")).toMatch(/from "@\/components\/ui\/EmptyState"/);
  });
});
