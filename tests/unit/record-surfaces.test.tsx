/**
 * @jest-environment jsdom
 *
 * The behaviour-preserving half of the record-surface migration (T-0033,
 * WG-WEB-003 ruled D).
 *
 * The task changes what RENDERS a record. It must not change which records
 * render, what they say, or what their controls do. That sentence is only worth
 * anything if something holds it, because "I only touched the markup" is what
 * every silently broken href in this repository was introduced by.
 *
 * So each record surface gets the same three questions asked of it:
 *
 *   - are the records still there, all of them, saying the same things;
 *   - does every control still reach the same handler with the same argument;
 *   - does the surface now answer the bloom field from the container rather
 *     than from a call site that remembered to sprinkle the attribute.
 *
 * The third is the migration's own claim. The first two are what stops it being
 * a redesign. Authored before any file under src/ was edited; every case below
 * was red on write.
 */

import { render, screen, fireEvent, within } from "@testing-library/react";

import SessionCard from "@/components/session/SessionCard";
import MissionGroupCard from "@/components/session/MissionGroupCard";
import LogFilePicker from "@/components/logs/LogFilePicker";
import LogTerminal from "@/components/logs/LogTerminal";
import ToolsetReferenceTable from "@/components/tools/ToolsetReferenceTable";
import MissionsList from "@/components/missions/MissionsList";

import type { SessionRecord } from "@/lib/sessions/session-repository";
import type { MissionGroup } from "@/lib/sessions/sessions-grouping";
import type { LogFileMeta } from "@/lib/fs/log-files";
import type { MissionsPageViewModel } from "@/hooks/useMissionsPage";
import type { MissionRow } from "@/hooks/missions-page-types";

// The detail panel opens an EventSource when a mission expands. These tests are
// about which rows render and what the row's click does, not the stream.
jest.mock("@/components/missions/MissionLiveProgress", () => ({
  __esModule: true,
  default: () => null,
}));

const HOUR_AGO = new Date(Date.now() - 3_600_000).toISOString();
const DAY_AGO = new Date(Date.now() - 86_400_000).toISOString();

function session(over: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: "sess-1",
    agentType: "hermes",
    source: "cli",
    missionId: null,
    profileName: "default",
    modelId: "sonnet-4",
    provider: "anthropic",
    title: "Triage the queue",
    size: 4096,
    startedAt: HOUR_AGO,
    endedAt: null,
    status: "completed",
    exitCode: 0,
    error: null,
    messageCount: 5,
    ...over,
  } as SessionRecord;
}

/** The nearest ancestor that answers the bloom field, or null. */
function bloomHost(el: HTMLElement | null): HTMLElement | null {
  return el?.closest("[data-bloom]") as HTMLElement | null;
}

describe("SessionCard is a ledger row, not a rounded box", () => {
  it("still says everything the record says", () => {
    render(<SessionCard session={session()} />);
    expect(screen.getByText("Triage the queue")).toBeInTheDocument();
    expect(screen.getByText("CLI")).toBeInTheDocument();
    expect(screen.getByText("default")).toBeInTheDocument();
    expect(screen.getByText("sonnet-4")).toBeInTheDocument();
    expect(screen.getByText("5 msgs")).toBeInTheDocument();
    expect(screen.getByText("4.0 KB")).toBeInTheDocument();
  });

  it("still links to the transcript", () => {
    render(<SessionCard session={session({ id: "sess-42" })} />);
    const link = screen.getByRole("link", { name: /Triage the queue/ });
    expect(link.getAttribute("href")).toBe("/results/sessions/sess-42");
  });

  it("still links a mission-born session to its parent mission", () => {
    render(<SessionCard session={session({ missionId: "m-7" })} />);
    const badge = screen.getByTitle("Open parent mission");
    expect(badge.getAttribute("href")).toBe("/work/missions?mission=m-7");
  });

  it("hides the size when the record has none, exactly as before", () => {
    render(<SessionCard session={session({ size: 0 })} />);
    expect(screen.queryByText(/KB$/)).not.toBeInTheDocument();
  });

  it("answers the bloom field from the row, not from a sprinkled attribute", () => {
    render(<SessionCard session={session()} />);
    const host = bloomHost(screen.getByText("Triage the queue"));
    expect(host).not.toBeNull();
    expect(host?.getAttribute("data-bloom")).toBe("tight");
  });
});

describe("MissionGroupCard keeps its grouping behaviour", () => {
  function group(over: Partial<MissionGroup> = {}): MissionGroup {
    return {
      kind: "mission",
      key: "mission:m-7",
      missionId: "m-7abcdef012345",
      sessions: [
        session({ id: "s-1", title: "Run one", startedAt: HOUR_AGO }),
        session({ id: "s-2", title: "Run two", startedAt: DAY_AGO }),
      ],
      firstStartedAt: DAY_AGO,
      lastStartedAt: HOUR_AGO,
      activeCount: 0,
      ...over,
    };
  }

  it("starts collapsed and shows the group's own facts", () => {
    render(<MissionGroupCard group={group()} />);
    expect(screen.getByText("Run one")).toBeInTheDocument();
    expect(screen.getByText("2 on this page")).toBeInTheDocument();
    expect(screen.queryByText("Run two")).not.toBeInTheDocument();
  });

  it("expands to every session in the group on click", () => {
    render(<MissionGroupCard group={group()} />);
    fireEvent.click(screen.getByRole("button", { name: /Run one/ }));
    expect(screen.getByText("Run two")).toBeInTheDocument();
  });

  it("counts the active sessions when there are any", () => {
    render(<MissionGroupCard group={group({ activeCount: 1 })} />);
    expect(screen.getByText("1 active")).toBeInTheDocument();
  });

  it("still links to the parent mission", () => {
    render(<MissionGroupCard group={group()} />);
    const link = screen.getByTitle("Open the parent mission");
    expect(link.getAttribute("href")).toBe(
      "/work/missions?mission=m-7abcdef012345",
    );
  });

  it("answers the bloom field from the group row", () => {
    render(<MissionGroupCard group={group()} />);
    const host = bloomHost(screen.getByText("Run one"));
    expect(host?.getAttribute("data-bloom")).toBe("tight");
  });
});

describe("the log file picker is a ledger of files", () => {
  const files: LogFileMeta[] = [
    { name: "agent", size: 2048, modified: HOUR_AGO, group: "core" },
    { name: "gateway", size: 1024, modified: DAY_AGO, group: "system" },
  ];

  function picker(onSelect = jest.fn(), activeLog = "agent") {
    render(
      <LogFilePicker
        files={files}
        query=""
        onQueryChange={() => {}}
        activeLog={activeLog}
        onSelect={onSelect}
      />,
    );
    return onSelect;
  }

  it("renders one row per file, grouped as before", () => {
    picker();
    expect(screen.getByText("agent.log")).toBeInTheDocument();
    expect(screen.getByText("gateway.log")).toBeInTheDocument();
    expect(screen.getByText("Core")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
  });

  it("still selects the file it was clicked on", () => {
    const onSelect = picker();
    fireEvent.click(screen.getByRole("button", { name: /gateway\.log/ }));
    expect(onSelect).toHaveBeenCalledWith("gateway");
  });

  it("still says nothing matched when nothing does", () => {
    render(
      <LogFilePicker
        files={[]}
        query="zzz"
        onQueryChange={() => {}}
        activeLog="agent"
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("No matching log files")).toBeInTheDocument();
  });

  it("answers the bloom field from each file row", () => {
    picker();
    const host = bloomHost(screen.getByText("gateway.log"));
    expect(host?.getAttribute("data-bloom")).toBe("tight");
  });
});

describe("the log terminal is a panel of ledger lines", () => {
  function terminal(lines: string[], searchTerm = "") {
    render(
      <LogTerminal
        scrollRef={{ current: null }}
        onScroll={() => {}}
        logName="agent"
        activeLog="agent"
        showingLines={lines.length}
        totalLines={lines.length}
        lines={lines}
        searchTerm={searchTerm}
      />,
    );
  }

  it("keeps its chrome and its column headings", () => {
    terminal(["2026-08-25 10:00:00 INFO started"]);
    expect(screen.getByText(/agent\.log/)).toBeInTheDocument();
    expect(screen.getByText("Time")).toBeInTheDocument();
    expect(screen.getByText("Level")).toBeInTheDocument();
    expect(screen.getByText("Message")).toBeInTheDocument();
  });

  it("renders one row per line", () => {
    terminal([
      "2026-08-25 10:00:00 INFO started",
      "2026-08-25 10:00:01 ERROR it broke",
    ]);
    expect(screen.getByText("started")).toBeInTheDocument();
    expect(screen.getByText("it broke")).toBeInTheDocument();
  });

  it("still distinguishes an empty file from a filtered-out one", () => {
    terminal([]);
    expect(screen.getByText("Log file is empty")).toBeInTheDocument();
  });

  it("answers the bloom field from each line", () => {
    terminal(["2026-08-25 10:00:00 INFO started"]);
    const host = bloomHost(screen.getByText("started"));
    expect(host?.getAttribute("data-bloom")).toBe("tight");
  });
});

describe("the toolset reference is a real table", () => {
  const entries = [
    { id: "web", description: "Fetch and search the web" },
    { id: "files", description: "Read and write local files" },
  ];

  it("renders a header row and one body row per toolset", () => {
    render(<ToolsetReferenceTable entries={entries} />);
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader")).toHaveLength(2);
    expect(within(table).getAllByRole("row")).toHaveLength(entries.length + 1);
  });

  it("says exactly what the catalogue says", () => {
    render(<ToolsetReferenceTable entries={entries} />);
    expect(screen.getByText("web")).toBeInTheDocument();
    expect(screen.getByText("Fetch and search the web")).toBeInTheDocument();
    expect(screen.getByText("files")).toBeInTheDocument();
    expect(screen.getByText("Read and write local files")).toBeInTheDocument();
  });
});

describe("the missions board is a ledger per column", () => {
  function missionRow(over: Partial<MissionRow> = {}): MissionRow {
    return {
      id: "m-1",
      name: "Nightly triage",
      prompt: "Triage the queue",
      status: "dispatched",
      createdAt: HOUR_AGO,
      updatedAt: HOUR_AGO,
      ...over,
    } as MissionRow;
  }

  const missions = [
    missionRow(),
    missionRow({ id: "m-2", name: "Weekly digest", status: "successful" }),
  ];

  function viewModel(over: Partial<MissionsPageViewModel> = {}) {
    return {
      missions,
      showCreate: true,
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
      missionCategoryPills: [],
      filteredGrouped: [],
      filtered: missions,
      categories: [],
      handleTemplateSelect: jest.fn(),
      openTemplateManager: jest.fn(),
      openCategoryManager: jest.fn(),
      handleEdit: jest.fn(),
      handleDelete: jest.fn(),
      handleCancel: jest.fn(),
      handleDuplicateMission: jest.fn(),
      cancellingMissionId: null,
      ...over,
    } as unknown as MissionsPageViewModel;
  }

  it("still renders every mission, in its own column", () => {
    render(<MissionsList vm={viewModel()} />);
    expect(screen.getByText("Nightly triage")).toBeInTheDocument();
    expect(screen.getByText("Weekly digest")).toBeInTheDocument();
  });

  it("still says which columns are empty", () => {
    render(<MissionsList vm={viewModel()} />);
    // draft, queued and failed have no rows in this fixture.
    expect(screen.getAllByText("No missions")).toHaveLength(3);
  });

  it("still expands the mission the row was clicked on", () => {
    const setExpandedId = jest.fn();
    render(<MissionsList vm={viewModel({ setExpandedId })} />);
    fireEvent.click(screen.getByRole("button", { name: /Nightly triage/ }));
    expect(setExpandedId).toHaveBeenCalledWith("m-1");
  });

  it("still says nothing matched when the filter empties the board", () => {
    render(<MissionsList vm={viewModel({ filtered: [] })} />);
    expect(screen.getByText("No missions match your filter")).toBeInTheDocument();
  });

  it("answers the bloom field from each mission row", () => {
    render(<MissionsList vm={viewModel()} />);
    const host = bloomHost(screen.getByText("Nightly triage"));
    expect(host?.getAttribute("data-bloom")).toBe("tight");
  });
});
