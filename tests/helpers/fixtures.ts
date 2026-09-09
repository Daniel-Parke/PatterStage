// Fixtures that several suites each built by hand (C4, T-0140): the stats
// ledger's zero row, the mission composer's empty form, and the missions
// page's view model with every handler a jest.fn. Each takes overrides.

import type { RawMetrics } from "@/lib/stats/derive";
import type { MissionFormState } from "@/components/missions/MissionCreateForm";
import type { MissionRow } from "@/hooks/missions-page-types";
import type { MissionsPageViewModel } from "@/hooks/useMissionsPage";

/** Every counter at zero, every list empty: the ledger before anything happened. */
export function rawMetrics(over: Partial<RawMetrics> = {}): RawMetrics {
  return {
    completedMissions: 0,
    failedMissions: 0,
    completedRuns: 0,
    totalTokens: 0,
    stories: 0,
    schedulesEnabled: 0,
    scriptsEnabled: 0,
    longestStreak: 0,
    currentStreak: 0,
    completionHours: [],
    dispatchedMissions: 0,
    maxMissionsInADay: 0,
    chaptersGenerated: 0,
    storiesCompleted: 0,
    sessionsStarted: 0,
    schedulesCreated: 0,
    schedulesFired: 0,
    skillToggles: 0,
    personalityChanges: 0,
    modelConfigs: 0,
    chatMessages: 0,
    distinctProfiles: 0,
    distinctEventTypes: 0,
    eventCounts: {},
    facts: { profiles: 0, models: 0, credentials: 0, workflows: 0, memoryConfigured: false },
    ...over,
  };
}

/** The composer's form with a name and an instruction, everything else at rest. */
export function composerFormState(over: Partial<MissionFormState> = {}): MissionFormState {
  return {
    newName: "Test",
    newInstruction: "Run the task",
    newContext: "",
    newGoals: "",
    newOutputFormat: "",
    newConstraints: "",
    newDispatch: "save",
    newSchedule: "every 5m",
    newMissionTime: 15,
    newTimeout: 10,
    newProfile: "",
    newModel: "",
    newProvider: "",
    newLocalDirs: [],
    localDirDraft: { path: "", branch: null },
    newReferences: [],
    referenceInput: "",
    newSkills: [],
    newToolsets: [],
    ...over,
  } as MissionFormState;
}

/** The missions page's view model over these rows, every handler a jest.fn. */
export function missionsViewModel(missions: MissionRow[], over: Partial<MissionsPageViewModel> = {}): MissionsPageViewModel {
  return {
    missions,
    filtered: missions,
    showCreate: false,
    filter: "all",
    setFilter: jest.fn(),
    search: "",
    setSearch: jest.fn(),
    expandedId: null,
    setExpandedId: jest.fn(),
    detail: null,
    detailLoading: false,
    promptCollapsed: true,
    setPromptCollapsed: jest.fn(),
    collapsedColumns: {},
    setCollapsedColumns: jest.fn(),
    categoryFilter: "all",
    setCategoryFilter: jest.fn(),
    missionCategoryFilter: "all",
    setMissionCategoryFilter: jest.fn(),
    templateCategoryPills: [],
    missionCategoryPills: [
      { id: "ops", name: "Ops", color: "cyan", count: 12 },
      { id: "research", name: "Research", color: "purple", count: 8 },
    ],
    filteredGrouped: [],
    categories: [],
    handleTemplateSelect: jest.fn(),
    openTemplateManager: jest.fn(),
    openCategoryManager: jest.fn(),
    handleEdit: jest.fn(),
    handleDelete: jest.fn(),
    handleCancel: jest.fn(),
    handleDuplicateMission: jest.fn(),
    cancellingMissionId: null,
    missionsLoadError: null,
    fetchData: jest.fn(),
    ...over,
  } as unknown as MissionsPageViewModel;
}
