/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * U18 · One Push all.
 *
 * The profiles drift banner carried "Push all to Hermes" and the sync bar
 * sixty pixels under it carried "Push all": the same write, two buttons, and
 * the banner's was the more prominent though the bar's is the canonical one,
 * beside Pull all (the UI review of 2026-09-08, P2). The banner states the
 * drift and names the bar's action; the bar keeps the button. One control
 * per action, and the words say where it is.
 */

import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());
jest.mock("@/components/agents/AgentPerformanceStrip", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/help/ConceptHint", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

import ProfilesDriftBanner from "@/components/profiles/ProfilesDriftBanner";
import AgentProfilesOverview from "@/components/agents/AgentProfilesOverview";
import type { AgentProfile } from "@/types/console";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const drifted = [
  { id: "p1", name: "Bob", syncStatus: "drift" },
  { id: "p2", name: "QA", syncStatus: "drift" },
] as unknown as AgentProfile[];

describe("U18 · one Push all", () => {
  it("the banner states the drift and names the action, and carries no button", () => {
    render(<ProfilesDriftBanner driftCount={2} errorCount={0} />);
    expect(screen.getByText(/Profile drift/)).toBeInTheDocument();
    expect(screen.getByText(/2 profiles drifted/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    // The sentence points at the control that exists.
    expect(screen.getByText(/Push all/)).toBeInTheDocument();
  });

  it("the overview offers Push all once, in the bar beside Pull all", () => {
    render(
      <AgentProfilesOverview
        profiles={drifted}
        syncBusy={false}
        onPushAll={() => {}}
        onPullAll={() => {}}
        onImportDiscovered={() => {}}
      />,
    );
    expect(screen.getAllByRole("button", { name: /push all/i })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /pull all/i })).toBeInTheDocument();
    expect(screen.getByText(/Profile drift/)).toBeInTheDocument();
  });

  it("the banner's source has no control, and the guide names one Push all", () => {
    expect(read("src/components/profiles/ProfilesDriftBanner.tsx")).not.toMatch(/<button\b|<Button\b/);
    expect(read("docs/guides/agents.md")).not.toMatch(/Push all to Hermes/);
  });
});
