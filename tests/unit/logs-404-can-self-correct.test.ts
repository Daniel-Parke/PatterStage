/** @jest-environment node */

// T-0071 · F8 — /logs 404s on every load and cannot recover from it.
//
// `activeLog` initialises to a hard-coded "agent". The page has an effect that
// auto-selects the first available log when the list arrives — but the list
// arrives only inside a SUCCESSFUL response body. The route builds
// `availableLogs` at the top of the handler, and the not-found path returns a
// bare `notFound()` that throws it away.
//
// So on an install whose logs directory holds anything except agent.log:
// the page asks for agent.log, gets a 404, receives no file list, keeps
// activeLog at "agent", asks again on the next poll, and 404s forever. The
// information that would fix it was computed three lines earlier and discarded.
//
// This drives the REAL handler with a faked filesystem, rather than reading the
// route's source. A regex can confirm the identifier `availableLogs` appears
// near the guard; only this can confirm it reaches the wire.

const mockExistsSync = jest.fn();
jest.mock("fs", () => ({
  existsSync: (...a: unknown[]) => mockExistsSync(...a),
  writeFileSync: jest.fn(),
}));

jest.mock("@/lib/runtime/workspace", () => ({
  getAgentWorkspace: () => ({ logs: "/ws/logs" }),
}));

const mockListLogFilesInDir = jest.fn();
jest.mock("@/lib/fs/log-files", () => ({
  listLogFilesInDir: (...a: unknown[]) => mockListLogFilesInDir(...a),
  logFileUnderLogsDir: jest.fn(),
  logValidationError: (r: string) => `bad: ${r}`,
  readLastLines: jest.fn(() => ({
    allLines: 1,
    lines: ["hello"],
    mtime: new Date("2026-08-31T12:00:00Z"),
    size: 5,
  })),
  resolveLogFilePath: (_d: string, _r: string, name: string | null) => ({
    ok: true,
    safeName: name ?? "agent",
    absolutePath: `/ws/logs/${name ?? "agent"}.log`,
  }),
}));

jest.mock("@/lib/log-line-format", () => ({ injectMissingTimestamps: (l: string[]) => l }));
jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn(), serverErrorFromCatch: jest.fn() }));
// The handler records logs.opened on the path that returns a file (T-0111).
// Doubled here so this suite keeps mocking `fs` down to four functions: the real
// recorder reaches the database, which reaches the rest of `fs`.
jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));

import { GET } from "@/app/api/logs/route";

const AVAILABLE = [
  { name: "hermes", size: 10, modified: "2026-08-31T11:00:00Z" },
  { name: "gateway", size: 20, modified: "2026-08-31T11:00:00Z" },
];

type Body = { error?: string; data?: { availableLogs?: { name: string }[] } };

async function get(name: string) {
  const res = await GET({ url: `http://localhost/api/logs?name=${name}` } as never);
  return { status: res.status, body: (await res.json()) as Body };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockListLogFilesInDir.mockReturnValue(AVAILABLE);
  // The logs DIRECTORY exists; the requested FILE inside it does not. That is
  // the shape of the defect — an install with logs, just not `agent.log`.
  mockExistsSync.mockImplementation((p: string) => p === "/ws/logs");
});

describe("a 404 for one log still hands back the others", () => {
  it("carries availableLogs, so the page can pick a different file", async () => {
    const { status, body } = await get("agent");

    expect(status).toBe(404);
    expect(body.data?.availableLogs?.map((l) => l.name)).toEqual(["hermes", "gateway"]);
  });

  it("still says which file was missing", async () => {
    // The recovery must not cost the diagnosis. An operator who typed the name
    // needs to know which one was not there.
    const { body } = await get("agent");
    expect(body.error).toMatch(/agent\.log/);
  });

  it("is still a 404, not a 200 with an empty body", async () => {
    // The cheap way to make the page stop erroring is to answer 200 with no
    // lines, which would report a missing file as an empty one — a different
    // lie, and a worse one.
    expect((await get("agent")).status).toBe(404);
  });

  it("survives a logs directory it cannot list", async () => {
    // listLogFilesInDir already fails soft into `[]`. The 404 body must not
    // become the thing that throws.
    mockListLogFilesInDir.mockImplementation(() => {
      throw new Error("EACCES");
    });

    const { status, body } = await get("agent");

    expect(status).toBe(404);
    expect(body.data?.availableLogs).toEqual([]);
  });

  it("GREEN CONTROL: a log that exists is still served normally", async () => {
    mockExistsSync.mockReturnValue(true);

    const { status, body } = await get("hermes");

    expect(status).toBe(200);
    expect(body.data?.availableLogs?.length).toBe(2);
  });
});

describe("a missing logs DIRECTORY explains itself too", () => {
  it("answers 404 with a reason, not a bare not-found", async () => {
    // The sibling of the case above, and the one T-0071 never touched. A fresh
    // install has no logs directory at all, so this is the FIRST thing a new
    // operator hits — and it used to return a bare 404 that the page rendered
    // as "No matching log files", an error indistinguishable from an empty
    // state (T-0079).
    mockExistsSync.mockReturnValue(false); // not even the directory

    const { status, body } = await get("agent");

    expect(status).toBe(404);
    expect(body.error).toMatch(/logs directory/i);
    // It must say this is NORMAL on a fresh install, or the reader reasonably
    // concludes something is broken.
    expect(body.error).toMatch(/fresh install|first time/i);
  });

  it("still carries an availableLogs field, so the page has something to read", async () => {
    mockExistsSync.mockReturnValue(false);

    const { body } = await get("agent");

    expect(body.data?.availableLogs).toEqual([]);
  });
});
