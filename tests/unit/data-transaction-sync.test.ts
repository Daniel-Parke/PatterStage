/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- singleton and controlled external dependencies */
// T-0189: real SQLite; no OS process enumeration or operator filesystem reads.
import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { openBaselineDb, type RealDb } from "../helpers/baseline-db";

let testDb: RealDb | null = null;
let mockRoot = "";
let mockPs = "";
let mockEnv = "";
const mockSessionSync = jest.fn();
const mockExec = jest.fn((...args: unknown[]) => {
  const callback = args.at(-1) as (error: Error | null, stdout: string, stderr: string) => void;
  callback(null, mockPs, "");
});
jest.mock("child_process", () => ({ exec: (...args: unknown[]) => mockExec(...args) }));
jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => testDb));
jest.mock("@/lib/runtime/workspace", () => ({ getAgentWorkspace: () => ({
  root: mockRoot, logs: join(mockRoot, "logs"), env: join(mockRoot, ".env"), config: join(mockRoot, "config.yaml"),
}) }));
jest.mock("fs/promises", () => {
  const actual = jest.requireActual<typeof import("fs/promises")>("fs/promises");
  return {
    ...actual,
    readFile: (path: unknown, ...rest: unknown[]) => String(path) === join(mockRoot, ".env")
      ? Promise.resolve(mockEnv)
      : (actual.readFile as (...args: unknown[]) => unknown)(path, ...rest),
  };
});
jest.mock("@/lib/sessions/session-sync", () => ({ syncHermesSessionsToDb: (...args: unknown[]) => mockSessionSync(...args) }));
jest.mock("@/lib/api/api-logger", () => ({ logApiError: jest.fn() }));

import { ProcessSync } from "@/lib/sync/sources/ProcessSync";
import { LogSync } from "@/lib/sync/sources/LogSync";
import { EnvSync } from "@/lib/sync/sources/EnvSync";
import { SessionSync } from "@/lib/sync/sources/SessionSync";
import {
  insertErrorLogEntries, readRecentErrorLogEntries, readAgentProcesses,
  readGatewayPlatforms, type ErrorLogEntryInput,
} from "@/lib/sync/sync-repository";

const psRows = [
  "USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND",
  "oracle 4101 0.1 0.1 100 100 ? S 10:00 0:01 python hermes_cli.main chat",
  "oracle 4102 0.1 0.1 100 100 ? S 10:00 0:01 python hermes_cli.main chat",
].join("\n");
beforeEach(() => {
  testDb = openBaselineDb();
  const parent = join(process.cwd(), "tmp", "t0189-sync-fixtures");
  mkdirSync(parent, { recursive: true });
  mockRoot = mkdtempSync(join(parent, "case-"));
  mkdirSync(join(mockRoot, "logs"));
  writeFileSync(join(mockRoot, ".env"), "");
  mockEnv = "";
  mockPs = "";
  mockExec.mockClear();
  mockSessionSync.mockReset();
});
afterEach(() => { testDb?.close(); testDb = null; });

function seedProcesses() {
  testDb!.exec(`INSERT INTO agent_processes (id, type, name, status, pid, model, turns, last_activity, last_seen_at)
    VALUES ('old-a', 'agent', 'Old A', 'idle', 21, 'old-model', 3, 'old activity', 'old timestamp'),
           ('old-b', 'gateway', 'Old B', 'running', 22, 'another-model', 7, 'other activity', 'other timestamp')`);
}
function errors() { return testDb!.prepare("SELECT * FROM error_log_entries ORDER BY id").all(); }
const entry = (overrides: Partial<ErrorLogEntryInput> = {}): ErrorLogEntryInput => ({
  source: "gateway", timestamp: "2026-10-02 10:00:00", message: "ERROR oracle event", severity: "error", ...overrides,
});
function logs() {
  // Owned standard log names, with distinct source identities. Every selected
  // source contains two errors so failure injection reaches a second insert.
  for (const name of ["gateway.log", "hermes.log", "errors.log"]) {
    writeFileSync(join(mockRoot, "logs", name),
      "2026-10-02 10:00:00 ERROR oracle first\n2026-10-02 10:00:01 ERROR oracle second\n");
  }
}

describe("T-0189 process snapshots", () => {
  it("successful controlled scan replaces stale rows and stamps its result", async () => {
    seedProcesses();
    mockPs = psRows;
    const before = Date.now();
    const result = await new ProcessSync().sync();
    const rows = readAgentProcesses();
    expect(result).toMatchObject({ success: true, syncedCount: rows.length });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.map((row) => row.id)).not.toEqual(expect.arrayContaining(["old-a", "old-b"]));
    expect(rows.map((row) => row.id)).not.toContain("old-a");
    expect(rows.map((row) => row.id)).not.toContain("old-b");
    expect(rows.map((row) => row.pid)).toEqual(expect.arrayContaining([4101, 4102]));
    for (const row of rows) expect(Date.parse(row.last_seen_at)).toBeGreaterThanOrEqual(before - 1000);
    expect(mockExec).toHaveBeenCalled();
  });
  it("failed second new insert preserves the complete prior snapshot", async () => {
    seedProcesses();
    const before = readAgentProcesses();
    mockPs = psRows;
    testDb!.exec(`CREATE TRIGGER oracle_process_failure BEFORE INSERT ON agent_processes
      WHEN (SELECT COUNT(*) FROM agent_processes WHERE id NOT IN ('old-a', 'old-b')) >= 1
      BEGIN SELECT RAISE(ABORT, 'oracle second process insert'); END;`);
    const result = await new ProcessSync().sync();
    expect(result).toMatchObject({ success: false, syncedCount: 0, error: expect.stringContaining("oracle second process insert") });
    expect(readAgentProcesses()).toEqual(before);
  });
  it("successful empty scan clears stale rows", async () => {
    seedProcesses();
    expect(await new ProcessSync().sync()).toMatchObject({ success: true, syncedCount: 0 });
    expect(readAgentProcesses()).toEqual([]);
  });
});

describe("T-0189 error identity", () => {
  it("repeated identity ignores severity and retains the earliest stored representative", () => {
    insertErrorLogEntries([entry()], "first ingestion");
    const before = errors();
    insertErrorLogEntries([entry({ severity: "critical" })], "later ingestion");
    expect(errors()).toEqual(before);
    expect(readRecentErrorLogEntries()).toEqual([entry()]);
  });
  it("retains distinct source, timestamp and full-message tails including empty timestamps", () => {
    const prefix = "ERROR " + "x".repeat(700);
    const distinct = [
      entry({ message: prefix + "A" }), entry({ message: prefix + "B" }),
      entry({ source: "hermes", message: prefix + "A" }),
      entry({ timestamp: "2026-10-02 10:00:01", message: prefix + "A" }),
      entry({ timestamp: "", message: "ERROR untimed" }),
    ];
    insertErrorLogEntries(distinct, "first ingestion");
    insertErrorLogEntries(distinct, "second ingestion");
    expect(errors()).toHaveLength(distinct.length);
    expect(readRecentErrorLogEntries()).toEqual(expect.arrayContaining(distinct));
  });
  it("deduplicates historical rows by MIN(id) before LIMIT10 without deleting stored rows", () => {
    const insert = testDb!.prepare("INSERT INTO error_log_entries (source, timestamp, message, severity) VALUES (?, ?, ?, ?)");
    for (let index = 0; index < 12; index++) insert.run("gateway", "2026-10-02 12:00:00", "ERROR duplicate", index === 0 ? "warning" : "critical");
    insert.run("hermes", "2026-10-01 12:00:00", "ERROR older distinct", "error");
    const before = errors();
    expect(readRecentErrorLogEntries()).toEqual([
      entry({ timestamp: "2026-10-02 12:00:00", message: "ERROR duplicate", severity: "warning" }),
      entry({ source: "hermes", timestamp: "2026-10-01 12:00:00", message: "ERROR older distinct" }),
    ]);
    expect(errors()).toEqual(before);
  });
  it("still limits a distinct recent-error window to ten observations", () => {
    insertErrorLogEntries(Array.from({ length: 12 }, (_, i) => entry({ timestamp: `2026-10-02 10:00:${String(i).padStart(2, "0")}`, message: `ERROR distinct ${i}` })), "ingestion");
    const rows = readRecentErrorLogEntries();
    expect(rows).toHaveLength(10);
    expect(rows.map((row) => row.message)).toEqual(Array.from({ length: 10 }, (_, i) => `ERROR distinct ${11 - i}`));
    expect(errors()).toHaveLength(12);
  });
});

describe("T-0189 actual LogSync ticks", () => {
  it("full message tails survive actual log ingestion as distinct identities", async () => {
    const prefix = "2026-10-02 10:00:00 ERROR " + "x".repeat(700);
    const messages = [prefix + "A", prefix + "B"];
    writeFileSync(join(mockRoot, "logs", "gateway.log"), messages.join("\n") + "\n");
    expect(await new LogSync().sync()).toMatchObject({ success: true });
    expect(testDb!.prepare("SELECT message FROM error_log_entries ORDER BY id").all())
      .toEqual(messages.map((message) => ({ message })));
  });
  it("repeated ticks do not append the same log identities", async () => {
    logs();
    expect(await new LogSync().sync()).toMatchObject({ success: true });
    const before = errors();
    expect(before.length).toBeGreaterThanOrEqual(2);
    expect(await new LogSync().sync()).toMatchObject({ success: true });
    expect(errors()).toEqual(before);
  });
  it("second insertion failure rolls back every insertion in the tick", async () => {
    logs();
    insertErrorLogEntries([entry({ message: "ERROR retained old" })], "old ingestion");
    const before = errors();
    testDb!.exec(`CREATE TRIGGER oracle_log_insert_failure BEFORE INSERT ON error_log_entries
      WHEN (SELECT COUNT(*) FROM error_log_entries) > 1
      BEGIN SELECT RAISE(ABORT, 'oracle second log insert'); END;`);
    const result = await new LogSync().sync();
    expect(result).toMatchObject({ success: false, syncedCount: 0, error: expect.stringContaining("oracle second log insert") });
    expect(errors()).toEqual(before);
  });
  it("pruning failure rolls back new log rows as part of the same tick", async () => {
    logs();
    insertErrorLogEntries(Array.from({ length: 500 }, (_, i) => entry({ timestamp: "2000-01-01 00:00:00", message: `ERROR retained ${i}` })), "2000-01-01 00:00:00");
    const before = errors();
    testDb!.exec("CREATE TRIGGER oracle_log_prune_failure BEFORE DELETE ON error_log_entries BEGIN SELECT RAISE(ABORT, 'oracle log prune'); END;");
    expect(await new LogSync().sync()).toMatchObject({ success: false, error: expect.stringContaining("oracle log prune") });
    expect(errors()).toEqual(before);
  });
  it("successful tick preserves the existing 500-row retention ceiling", async () => {
    logs();
    insertErrorLogEntries(Array.from({ length: 500 }, (_, i) => entry({ timestamp: "2000-01-01 00:00:00", message: `ERROR retained ${i}` })), "2000-01-01 00:00:00");
    expect(await new LogSync().sync()).toMatchObject({ success: true });
    expect(errors()).toHaveLength(500);
    expect(errors()).toEqual(expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining("oracle first") })]));
  });
});

describe("T-0189 token presence agrees across sync sources", () => {
  it.each([
    { label: "empty", value: "", present: false },
    { label: "commented", value: "# absent", present: false },
    { label: "placeholder", value: "changeme", present: false },
    { label: "quoted placeholder", value: '"changeme"', present: false },
    { label: "quoted empty", value: '""', present: false },
    { label: "real", value: "oracle-fake-token", present: true },
    { label: "double quoted real", value: '"oracle-fake-token"', present: true },
    { label: "single quoted real", value: "'oracle-fake-token'", present: true },
  ])("$label values agree for Discord, Telegram and Slack", async ({ value, present }) => {
    mockEnv = ["DISCORD_BOT_TOKEN", "TELEGRAM_BOT_TOKEN", "SLACK_BOT_TOKEN"].map((key) => `${key}=${value}`).join("\n");
    mockPs = "USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND\noracle 4201 0.1 0.1 100 100 ? S 10:00 0:01 hermes gateway run";
    expect(await new EnvSync().sync()).toMatchObject({ success: true });
    expect(await new ProcessSync().sync()).toMatchObject({ success: true });
    const platforms = readGatewayPlatforms();
    const labels = readAgentProcesses().map((row) => row.name).join(" ").toLowerCase();
    for (const platform of ["discord", "telegram", "slack"]) {
      expect(platforms.find((row) => row.platform === platform)?.bot_token_present).toBe(Number(present));
      expect(labels.includes(platform)).toBe(present);
    }
  });
  it.each(["WHATSAPP_API_KEY", "WHATSAPP_PHONE_ID"])("EnvSync WhatsApp is present with %s alone", async (key) => {
    mockEnv = `${key}=oracle-fake-value`;
    mockPs = "USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND\noracle 4201 0.1 0.1 100 100 ? S 10:00 0:01 hermes gateway run";
    expect(await new EnvSync().sync()).toMatchObject({ success: true });
    expect(await new ProcessSync().sync()).toMatchObject({ success: true });
    expect(readGatewayPlatforms().find((row) => row.platform === "whatsapp")?.enabled).toBe(1);
    expect(readAgentProcesses().map((row) => row.name).join(" ").toLowerCase()).toContain("whatsapp");
  });
});


describe("T-0189 SessionSync retires registry writes", () => {
  it.each(["success", "rejection"])("preserves registry history on underlying %s", async (outcome) => {
    testDb!.exec("INSERT INTO sync_registry (source_name, last_synced_at, status, synced_count) VALUES ('sessions', 'historical time', 'ok', 7)");
    const before = testDb!.prepare("SELECT * FROM sync_registry").all();
    if (outcome === "success") mockSessionSync.mockReturnValue({ synced: 2, skipped: 3 });
    else mockSessionSync.mockImplementation(() => { throw new Error("oracle session failure"); });
    const result = await new SessionSync().sync();
    expect(result.success).toBe(outcome === "success");
    if (outcome === "success") expect(result.syncedCount).toBe(2);
    if (outcome === "rejection") expect(result.error).toContain("oracle session failure");
    expect(testDb!.prepare("SELECT * FROM sync_registry").all()).toEqual(before);
    expect(mockSessionSync).toHaveBeenCalledTimes(1);
  });
});

// Amendment 2026-10-02, Planck 01a0fd1f-516a-7323-af9c-0682d6bbbe6c:
// Require each stale process to disappear and WhatsApp process labels for either key.
// Authorised by committed T-0189-oracle-amendment.md; original freeze retained.
