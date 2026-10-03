/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * U11 (T-0125): a number that is always 0 is not a fact.
 *
 * AgentGrowthPanel printed "Memory facts 0" for every agent on every install,
 * because the signal behind it is hard-coded to 0 pending a count API that
 * never landed (agent-experience.ts). On the same product, /agent/memory said
 * "2 FACTS" and the dashboard tile "2 facts · Hindsight". A reader who sees
 * two numbers disagree stops trusting both. The row goes; the signal stays in
 * the API, where a zero costs nobody anything.
 */
import { render, screen } from "@testing-library/react";

jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());
jest.mock("@/components/achievements", () => ({
  AgentLevelBadge: ({ label }: { label: string }) => <div data-testid="level-badge">{label}</div>,
}));
jest.mock("@/hooks/useAgentExperience", () => ({
  useAgentExperience: () => ({
    isLoading: false,
    entries: [
      {
        targetRef: "default",
        targetLabel: "Bob",
        experience: {
          level: { level: 3, title: "Adept", xp: 900, nextLevelXp: 1200, progress: 0.5 },
          xp: 900,
          signals: {
            runsCompleted: 11,
            totalTokens: 1000,
            activeDays: 2,
            skillsEnabled: 4,
            toolsetCount: 2,
            memoryFacts: 0,
          },
        },
      },
    ],
  }),
}));

import AgentGrowthPanel from "@/components/agents/AgentGrowthPanel";

describe("the growth panel", () => {
  it("names the counts that are measured, and not the one that is not", () => {
    render(<AgentGrowthPanel profileId="default" />);
    expect(screen.getByText("Runs completed")).toBeInTheDocument();
    expect(screen.getByText("Active days")).toBeInTheDocument();
    expect(screen.getByText("Skills enabled")).toBeInTheDocument();
    expect(screen.getByText("Toolsets attached")).toBeInTheDocument();
    expect(screen.queryByText(/memory facts/i)).toBeNull();
  });
});
