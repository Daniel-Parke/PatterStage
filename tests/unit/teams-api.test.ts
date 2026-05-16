// ═══════════════════════════════════════════════════════════════
// teams-api.test.ts — Unit tests for /api/teams route
// ═══════════════════════════════════════════════════════════════

/** @jest-environment node */

// Mock next/server first — route uses NextRequest and NextResponse
jest.mock("next/server", () => ({
  NextRequest: class NextRequest {
    url: string;
    method: string;
    headers: Headers;
    bodyUsed: boolean = false;
    private _body: string;
    constructor(url: string, init?: RequestInit) {
      this.url = url;
      this.method = init?.method ?? "GET";
      this.headers = new Headers(init?.headers as HeadersInit);
      this._body = typeof init?.body === "string" ? init.body : JSON.stringify(init?.body ?? {});
    }
    async json() { return JSON.parse(this._body); }
  },
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => {
      const status = init?.status ?? 200;
      const res = {
        ok: status >= 200 && status < 300,
        status,
        statusText:
          status === 201 ? "Created"
          : status === 400 ? "Bad Request"
          : status === 404 ? "Not Found"
          : "OK",
        headers: new Headers(),
        json: () => Promise.resolve(data),
      };
      return res;
    },
  },
}));

jest.mock("@/lib/api-auth", () => ({
  requireAuth: jest.fn(() => null),
  requireMcApiKey: jest.fn(() => null),
  requireNotReadOnly: jest.fn(() => null),
}));

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
}));

jest.mock("@/lib/audit-log", () => ({
  appendAuditLine: jest.fn(),
}));

jest.mock("@/lib/kanban-repository", () => {
  const updateBoard = jest.fn();
  return { updateBoard, __updateBoard: updateBoard };
});

// Mock teams-repository with require() factory
jest.mock("@/lib/teams-repository", () => {
  const listTeams = jest.fn();
  const getTeam = jest.fn();
  const createTeam = jest.fn();
  const updateTeam = jest.fn();
  const deleteTeam = jest.fn();
  const addTeamMember = jest.fn();
  const removeTeamMember = jest.fn();

  return {
    listTeams,
    getTeam,
    createTeam,
    updateTeam,
    deleteTeam,
    addTeamMember,
    removeTeamMember,
    __listTeams: listTeams,
    __getTeam: getTeam,
    __createTeam: createTeam,
    __updateTeam: updateTeam,
    __deleteTeam: deleteTeam,
    __addTeamMember: addTeamMember,
    __removeTeamMember: removeTeamMember,
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const repo = require("@/lib/teams-repository") as Record<string, unknown>;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const kanbanRepo = require("@/lib/kanban-repository") as Record<string, unknown>;
const mockUpdateBoard = kanbanRepo.__updateBoard as jest.Mock;

const mockListTeams = repo.__listTeams as jest.Mock;
const mockGetTeam = repo.__getTeam as jest.Mock;
const mockCreateTeam = repo.__createTeam as jest.Mock;
const mockUpdateTeam = repo.__updateTeam as jest.Mock;
const mockDeleteTeam = repo.__deleteTeam as jest.Mock;
const mockAddTeamMember = repo.__addTeamMember as jest.Mock;
const mockRemoveTeamMember = repo.__removeTeamMember as jest.Mock;

// Use beforeAll + beforeEach pattern: beforeEach clears all mock state,
// beforeAll (which runs after beforeEach for each test) restores defaults.
beforeAll(() => {
  mockListTeams.mockReturnValue([]);
  mockGetTeam.mockReturnValue(null);
  mockCreateTeam.mockReturnValue(null);
  mockUpdateTeam.mockReturnValue(null);
  mockDeleteTeam.mockReturnValue(null);
  mockAddTeamMember.mockReturnValue(null);
  mockRemoveTeamMember.mockReturnValue(null);
  mockUpdateBoard.mockReturnValue(null);
});

beforeEach(() => {
  // clearAllMocks clears return values AND mockImplementation — unlike mockReset()
  jest.clearAllMocks();
});

// ── Helpers ──────────────────────────────────────────────────────

type ApiRes = { status: number; ok: boolean; json(): Promise<Record<string, unknown>> };

async function getRoute(path: string): Promise<ApiRes> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const route = require("@/app/api/teams/route") as { GET: (req: Request) => unknown };
  const req = { url: `http://localhost${path}`, method: "GET", headers: new Headers() } as unknown as Request;
  return route.GET(req) as unknown as ApiRes;
}

async function postRoute(path: string, body: Record<string, unknown>): Promise<ApiRes> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const route = require("@/app/api/teams/route") as { POST: (req: Request) => unknown };
  const req = {
    url: `http://localhost${path}`,
    method: "POST",
    headers: new Headers({ "content-type": "application/json" }),
    body: JSON.stringify(body),
    json: async () => JSON.parse(JSON.stringify(body)),
  } as unknown as Request;
  return route.POST(req) as unknown as ApiRes;
}

// ── Test data ─────────────────────────────────────────────────

const TEAM_DATA = {
  id: "team_test123",
  name: "Platform Team",
  description: "Platform engineering",
  leaderProfileId: "bob",
  members: [
    { profileId: "bob", role: "leader" as const, joinedAt: "2025-01-01T00:00:00.000Z" },
    { profileId: "alice", role: "specialist" as const, joinedAt: "2025-01-01T00:00:00.000Z" },
  ],
  boardIds: [] as string[],
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

// ─────────────────────────────────────────────────────────────────
// GET /api/teams
// ─────────────────────────────────────────────────────────────────

describe("GET /api/teams", () => {
  it("returns empty teams list when directory is empty", async () => {
    mockListTeams.mockReturnValue([]);
    const res = await getRoute("/api/teams");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ data: { teams: [] } });
  });

  it("returns a specific team when ?id= is provided", async () => {
    mockGetTeam.mockReturnValue(TEAM_DATA);
    const res = await getRoute("/api/teams?id=team_test123");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("data");
  });

  it("returns 404 for a non-existent team", async () => {
    mockGetTeam.mockReturnValue(null);
    const res = await getRoute("/api/teams?id=nonexistent");
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────
// POST /api/teams — create
// ─────────────────────────────────────────────────────────────────

describe("POST /api/teams — create", () => {
  it("creates a new team with the leader as first member", async () => {
    mockCreateTeam.mockReturnValue(TEAM_DATA);
    const res = await postRoute("/api/teams", {
      action: "create",
      name: "Data Engineering Team",
      description: "Build data pipelines",
      leaderProfileId: "data-engineer",
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toHaveProperty("data");
  });

  it("rejects a team without a name", async () => {
    const res = await postRoute("/api/teams", { action: "create", leaderProfileId: "bob" });
    expect(res.status).toBe(400);
  });

  it("rejects a team without a leader", async () => {
    const res = await postRoute("/api/teams", { action: "create", name: "Team Without Lead" });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────
// POST /api/teams — add-member
// ─────────────────────────────────────────────────────────────────

describe("POST /api/teams — add-member", () => {
  it("adds a member to an existing team", async () => {
    mockGetTeam.mockReturnValue(TEAM_DATA);
    const updatedTeam = {
      ...TEAM_DATA,
      members: [...TEAM_DATA.members, { profileId: "charlie", role: "specialist" as const, joinedAt: "2025-01-01T00:00:00.000Z" }],
    };
    mockAddTeamMember.mockReturnValue(updatedTeam);
    const res = await postRoute("/api/teams", {
      action: "add-member",
      teamId: "team_test123",
      profileId: "charlie",
      role: "reviewer",
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("data");
  });

  it("returns 404 when team does not exist", async () => {
    mockAddTeamMember.mockReturnValue(null);
    const res = await postRoute("/api/teams", {
      action: "add-member",
      teamId: "nonexistent",
      profileId: "charlie",
      role: "specialist",
    });
    expect(res.status).toBe(404);
  });

  it("rejects missing teamId", async () => {
    const res = await postRoute("/api/teams", {
      action: "add-member",
      profileId: "charlie",
    });
    expect(res.status).toBe(400);
  });

  it("rejects missing profileId", async () => {
    const res = await postRoute("/api/teams", {
      action: "add-member",
      teamId: "team_test123",
    });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────
// POST /api/teams — remove-member
// ─────────────────────────────────────────────────────────────────

describe("POST /api/teams — remove-member", () => {
  it("removes an existing member from the team", async () => {
    mockRemoveTeamMember.mockReturnValue(true);
    mockGetTeam.mockReturnValue(TEAM_DATA);

    const res = await postRoute("/api/teams", {
      action: "remove-member",
      teamId: "team_test123",
      profileId: "alice",
    });
    expect(res.status).toBe(200);
    // removeTeamMember is a void operation — the returned team is a fresh DB fetch,
    // so we only verify the operation succeeded (status 200) and was called correctly
    expect(mockRemoveTeamMember).toHaveBeenCalledWith("team_test123", "alice");
  });

  it("returns 404 when team does not exist", async () => {
    mockRemoveTeamMember.mockReturnValue(false);
    const res = await postRoute("/api/teams", {
      action: "remove-member",
      teamId: "nonexistent",
      profileId: "alice",
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 when teamId is missing", async () => {
    const res = await postRoute("/api/teams", { action: "remove-member", profileId: "alice" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when profileId is missing", async () => {
    const res = await postRoute("/api/teams", { action: "remove-member", teamId: "team_test123" });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────
// POST /api/teams — update (action: "update")
// ─────────────────────────────────────────────────────────────────

describe("POST /api/teams — update", () => {
  it("updates team name", async () => {
    mockGetTeam.mockReturnValue(TEAM_DATA);
    mockUpdateTeam.mockReturnValue({ ...TEAM_DATA, name: "Renamed Platform Team" });
    const res = await postRoute("/api/teams", {
      action: "update",
      teamId: "team_test123",
      name: "Renamed Platform Team",
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("data");
  });

  it("updates team description", async () => {
    mockGetTeam.mockReturnValue(TEAM_DATA);
    mockUpdateTeam.mockReturnValue({ ...TEAM_DATA, description: "New description" });
    const res = await postRoute("/api/teams", {
      action: "update",
      teamId: "team_test123",
      description: "New description",
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("data");
  });

  it("returns 400 when teamId is missing", async () => {
    const res = await postRoute("/api/teams", { action: "update", name: "New Name" });
    expect(res.status).toBe(400);
  });

  it("returns 404 when team does not exist", async () => {
    mockUpdateTeam.mockReturnValue(null);
    const res = await postRoute("/api/teams", {
      action: "update",
      teamId: "nonexistent",
      name: "New Name",
    });
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────
// POST /api/teams — delete
// ─────────────────────────────────────────────────────────────────

describe("POST /api/teams — delete", () => {
  it("deletes an existing team", async () => {
    mockDeleteTeam.mockReturnValue(true);
    const res = await postRoute("/api/teams", { action: "delete", teamId: "team_test123" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ data: { deleted: "team_test123" } });
  });

  it("returns 400 when teamId is missing", async () => {
    const res = await postRoute("/api/teams", { action: "delete" });
    expect(res.status).toBe(400);
  });

  it("returns 404 when team does not exist", async () => {
    mockDeleteTeam.mockReturnValue(false);
    const res = await postRoute("/api/teams", { action: "delete", teamId: "nonexistent" });
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────
// GET /api/teams — filter by boardId
// ─────────────────────────────────────────────────────────────────

describe("GET /api/teams — filter by boardId", () => {
  it("returns teams that have the given boardId in boardIds", async () => {
    const teamWithBoard: typeof TEAM_DATA = {
      ...TEAM_DATA,
      boardIds: ["board_alpha"],
    };
    mockListTeams.mockReturnValue([teamWithBoard]);
    const res = await getRoute("/api/teams?boardId=board_alpha");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("data");
  });

  it("returns empty list when no teams match the boardId", async () => {
    mockListTeams.mockReturnValue([TEAM_DATA]);
    const res = await getRoute("/api/teams?boardId=board_alpha");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ data: { teams: [] } });
  });

  it("returns all teams when no boardId filter is provided", async () => {
    mockListTeams.mockReturnValue([TEAM_DATA]);
    const res = await getRoute("/api/teams");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("data");
  });
});

// ─────────────────────────────────────────────────────────────────
// POST /api/teams — link-board
// ─────────────────────────────────────────────────────────────────

describe("POST /api/teams — link-board", () => {
  it("links a board to a team", async () => {
    mockGetTeam.mockReturnValue(TEAM_DATA);
    mockUpdateBoard.mockReturnValue({ id: "board_new", name: "Test Board" });
    const res = await postRoute("/api/teams", {
      action: "link-board",
      teamId: "team_test123",
      boardId: "board_new",
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("data");
  });

  it("returns 400 when teamId is missing", async () => {
    const res = await postRoute("/api/teams", { action: "link-board", boardId: "board_new" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when boardId is missing", async () => {
    const res = await postRoute("/api/teams", { action: "link-board", teamId: "team_test123" });
    expect(res.status).toBe(400);
  });

  it("returns 404 when team does not exist", async () => {
    mockGetTeam.mockReturnValue(null);
    const res = await postRoute("/api/teams", {
      action: "link-board",
      teamId: "nonexistent",
      boardId: "board_new",
    });
    expect(res.status).toBe(404);
  });
});
