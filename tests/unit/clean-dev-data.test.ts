/** @jest-environment node */
// Dev-data cleanup matches only clearly-throwaway names (starts with a test
// marker) and deletes across workflows / stories / missions — never real
// content that merely mentions "test".

jest.mock("@/lib/composer/composer-repository", () => ({
  listWorkflows: jest.fn(),
  deleteWorkflow: jest.fn(),
}));
jest.mock("@/modules/rec-room/lib/story-repository", () => ({
  listStories: jest.fn(),
  deleteStory: jest.fn(),
}));
jest.mock("@/lib/missions/mission-repository", () => ({
  listMissions: jest.fn(),
  deleteMission: jest.fn(),
}));

import { previewDevDataCleanup, cleanDevData } from "@/lib/seed/clean-dev-data";
import { listWorkflows, deleteWorkflow } from "@/lib/composer/composer-repository";
import { listStories, deleteStory } from "@/modules/rec-room/lib/story-repository";
import { listMissions, deleteMission } from "@/lib/missions/mission-repository";

const mockListWorkflows = listWorkflows as jest.Mock;
const mockDeleteWorkflow = deleteWorkflow as jest.Mock;
const mockListStories = listStories as jest.Mock;
const mockDeleteStory = deleteStory as jest.Mock;
const mockListMissions = listMissions as jest.Mock;
const mockDeleteMission = deleteMission as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockListWorkflows.mockReturnValue([
    { id: "w1", name: "Testy" },
    { id: "w2", name: "Software Delivery" },
    { id: "w3", name: "test-flow" },
  ]);
  mockListStories.mockReturnValue([
    { id: "s1", title: "Test Story 2026" },
    { id: "s2", title: "Untitled Story" },
    { id: "s3", title: "The Last Enchantment" },
  ]);
  mockListMissions.mockReturnValue([
    { id: "m1", name: "Test mission" },
    { id: "m2", name: "Testing strategy for the API" }, // real content — must NOT match
    { id: "m3", name: "Review & Refactor" },
  ]);
});

describe("previewDevDataCleanup", () => {
  it("matches only names that START with a test marker", () => {
    const p = previewDevDataCleanup();
    expect(p.workflows.map((w) => w.id)).toEqual(["w1", "w3"]);
    expect(p.stories.map((s) => s.id)).toEqual(["s1", "s2"]);
    // "Testing strategy…" does not start with a test marker word boundary.
    expect(p.missions.map((m) => m.id)).toEqual(["m1"]);
  });
});

describe("cleanDevData", () => {
  it("deletes exactly the previewed items and reports counts", () => {
    const res = cleanDevData();
    expect(mockDeleteWorkflow.mock.calls.map((c) => c[0])).toEqual(["w1", "w3"]);
    expect(mockDeleteStory.mock.calls.map((c) => c[0])).toEqual(["s1", "s2"]);
    expect(mockDeleteMission.mock.calls.map((c) => c[0])).toEqual(["m1"]);
    expect(res.counts).toEqual({ workflows: 2, stories: 2, missions: 1, total: 5 });
  });
});
