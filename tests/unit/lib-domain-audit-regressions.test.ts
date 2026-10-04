/** @jest-environment node */

// T0194 independent Faraday audit oracle, 2026-10-04. Synthetic transports and
// disposable SQLite only. Dangerous cron inputs execute in bounded owned children.
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { openBaselineDb, openRealDb } from "../helpers/baseline-db";
import { applyAnalyticsEventsMigration } from "@/lib/db/sql-migrations";
import { createModel, updateModel, getDefaultModel } from "@/lib/models/models-repository";
import { buildPartialUpdateBody, DIRECTIVE_UPDATE_FIELDS } from "@/lib/memory/hindsight-route-helpers";
import { handleUpdateDirective, handleUpdateMentalModel } from "@/lib/memory/hindsight-write-actions";
import { requestWithTimeout } from "@/lib/memory/hindsight-request";
import { groupByCategory } from "@/lib/skills/skills-grouping";
import { upsertSkill, listSkills, deriveCategory } from "@/lib/skills/skills-repository";
import { createSchedule } from "@/lib/schedule/schedules-repository";
import { computeDashboard } from "@/lib/stats/stats-repository";
import { countByTypeSince, readCompletedRunTimings } from "@/lib/analytics/analytics-repository";
import { createRun } from "@/lib/runs/runs-repository";

let testDb: import("better-sqlite3").Database | null = null;
let clockDb: import("better-sqlite3").Database | null = null;
jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => testDb));
jest.mock("@/lib/memory/hindsight-request", () => ({ requestWithTimeout: jest.fn(async () => ({ owned: true })) }));
const transport = requestWithTimeout as jest.Mock;
const NOW = "2026-10-04T12:00:00.000Z";
const root = resolve(__dirname, "../..");

beforeEach(() => {
  jest.useFakeTimers({ now: Date.parse(NOW) });
  testDb = openBaselineDb([applyAnalyticsEventsMigration]); clockDb = openRealDb();
  // Freeze SQL's clock while retaining SQLite's own timestamp/modifier semantics.
  for (const name of ["datetime", "julianday", "strftime"] as const) {
    testDb.function(name, { varargs: true }, (...args: (string | number | bigint | Buffer | null)[]) => {
      const values = args.map(value => value === "now" ? NOW : value);
      const row = clockDb!.prepare(`SELECT ${name}(${values.map(() => "?").join(",")}) AS value`).get(...values) as { value: string | number | null };
      return row.value;
    });
  }
  transport.mockClear();
});
afterEach(() => { testDb?.close(); clockDb?.close(); testDb = null; clockDb = null; jest.useRealTimers(); });

function models() {
  const a = createModel({ name: "Owned A", provider: "owned", modelId: "a", defaults: { agent: true } });
  const b = createModel({ name: "Owned B", provider: "owned", modelId: "b" });
  return { a, b };
}
describe("T0194 Models default ownership", () => {
  it("clearing non-owner B cannot clear agent owner A", () => {
    const { a, b } = models(); updateModel(b.id, { defaults: { agent: false } });
    expect(getDefaultModel("agent")?.id).toBe(a.id);
  });
  it("clearing the actual owner removes its agent slot", () => {
    const { a } = models(); updateModel(a.id, { defaults: { agent: false } });
    expect(getDefaultModel("agent")).toBeNull();
  });
  it("a true flag replaces the owner with B", () => {
    const { b } = models(); updateModel(b.id, { defaults: { agent: true } });
    expect(getDefaultModel("agent")?.id).toBe(b.id);
  });
  it("omitted flags on both owner and non-owner preserve the slot", () => {
    const { a, b } = models(); updateModel(a.id, { name: "Renamed A" }); updateModel(b.id, { defaults: {} });
    expect(getDefaultModel("agent")).toMatchObject({ id: a.id, name: "Renamed A" });
  });
});

describe("T0194 Hindsight upstream PATCH keys", () => {
  it("the directive builder uses literal name/content/priority keys including zero", () => {
    expect(buildPartialUpdateBody({ name: "Owned title", content: "Literal body", priority: 0 }, DIRECTIVE_UPDATE_FIELDS))
      .toEqual({ name: "Owned title", content: "Literal body", priority: 0 });
  });
  it("the real directive handler sends literal fields, false activation and tags", async () => {
    await handleUpdateDirective("owned", "directive_1", { name: "Owned title", content: "Literal body", priority: 0, is_active: false, tags: ["owned"] });
    expect(transport).toHaveBeenCalledWith("/v1/default/banks/owned/directives/directive_1", { method: "PATCH", body: { name: "Owned title", content: "Literal body", priority: 0, is_active: false, tags: ["owned"] } });
  });
  it("the real model handler sends literal name and remaps query to source_query", async () => {
    await handleUpdateMentalModel("owned", "model_1", { name: "Owned model", query: "Owned query", tags: ["owned"] });
    expect(transport).toHaveBeenCalledWith("/v1/default/banks/owned/mental-models/model_1", { method: "PATCH", body: { name: "Owned model", source_query: "Owned query", tags: ["owned"] } });
  });
  it("omitted fields stay absent while false, empty tags and source_query mapping survive", async () => {
    await handleUpdateDirective("owned", "directive_1", { name: undefined, content: null, is_active: false, tags: [] });
    await handleUpdateMentalModel("owned", "model_1", { query: "Owned query" });
    expect(transport.mock.calls.map(call => call[1].body)).toEqual([{ is_active: false, tags: [] }, { source_query: "Owned query" }]);
  });
});

describe("T0194 Skills inherited category names", () => {
  it.each(["constructor", "toString"])("groups %s safely without changing item identity, normalisation or sorting", category => {
    const special = { category, id: "special" }, first = { category: "control-hub", id: "first" }, second = { category: " CONTROL HUB ", id: "second" };
    const input = [special, first, second];
    expect(() => groupByCategory(input)).not.toThrow();
    const grouped = groupByCategory(input);
    expect(grouped.map(([key]) => key)).toEqual([category.toLowerCase(), "control hub"].sort((a, b) => a.localeCompare(b)));
    expect(grouped.find(([key]) => key === category.toLowerCase())![1][0]).toBe(special);
    expect(grouped.find(([key]) => key === "control hub")![1]).toEqual([first, second]);
    expect(input).toEqual([special, first, second]);
  });
  it("groups the persisted constructor category used by the catalogue without mutating stored rows", () => {
    upsertSkill({ skillKey: "owned/one", category: "constructor", content: "Owned content" });
    const persisted = listSkills();
    expect(persisted[0].category).toBe("constructor");
    const catalogue = persisted.map(row => ({ ...row, category: deriveCategory(row) }));
    expect(() => groupByCategory(catalogue)).not.toThrow();
    expect(groupByCategory(catalogue)[0][1][0]).toBe(catalogue[0]);
    expect(listSkills()).toEqual(persisted);
  });
});

// Load only the pure scheduling modules in the child. No application bootstrap,
// provider environment, database or filesystem writes can participate.
const cronDriver = `
const fs=require('node:fs'),ts=require(process.argv[1]),Module=require('node:module');
Module._extensions['.ts']=(mod,path)=>mod._compile(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,path);
const scheduling=require(process.argv[2]),parsing=require(process.argv[3]);
let writes=0;
for(const key of ['writeFileSync','appendFileSync','mkdirSync','renameSync','unlinkSync']) fs[key]=()=>{writes++;throw new Error('Owned child refuses writes');};
console.log(JSON.stringify({phase:'ready'}));
const expression=process.argv[4],valid=scheduling.cronCanEverFire(expression);
console.log(JSON.stringify({phase:'done',valid,writes,kind:parsing.parseSchedule(expression).kind,next:valid?scheduling.computeNextRun(expression,new Date('2026-10-04T12:01:00Z'))?.toISOString():null}));
`;
function cron(expression: string) {
  const result = spawnSync(process.execPath, ["-e", cronDriver, require.resolve("typescript"), resolve(root, "src/lib/schedule/next-run.ts"), resolve(root, "src/lib/schedule/parse-schedule.ts"), expression], {
    cwd: root, encoding: "utf8", timeout: 2000, killSignal: "SIGKILL", windowsHide: true, maxBuffer: 16_384,
    env: { SystemRoot: process.env.SystemRoot, NODE_ENV: "test", TZ: "UTC" },
  });
  const lines = result.stdout?.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)) ?? [];
  // A missing ready marker is a launch/configuration failure, never a cron kill.
  expect({ ready: lines.some(line => line.phase === "ready"), launchError: result.error?.message, stderr: result.stderr }).toMatchObject({ ready: true, stderr: "" });
  return { status: result.status, timedOut: result.error?.message.includes("ETIMEDOUT") ?? false, done: lines.find(line => line.phase === "done") };
}
describe("T0194 bounded cron validation", () => {
  it.each([
    ["negative step", "*/-1 * * * *"], ["zero step", "*/0 * * * *"],
    ["malformed step", "*/1.5 * * * *"], ["enormous step", "*/9007199254740992 * * * *"],
    ["enormous range", "0-9007199254740992 * * * *"], ["reversed range", "9-1 * * * *"],
  ])("rejects %s in a bounded owned child without writes", (_label, expression) => {
    expect(cron(expression)).toMatchObject({ status: 0, timedOut: false, done: { valid: false, writes: 0 } });
  });
  it("a positive step completes in the same child harness with its exact next time", () => {
    expect(cron("*/5 * * * *")).toMatchObject({ status: 0, timedOut: false, done: { valid: true, writes: 0, next: "2026-10-04T12:05:00.000Z" } });
  });
  it("preserves the existing six-field classification and first-five-field evaluation", () => {
    expect(cron("*/5 * * * * 17")).toMatchObject({ status: 0, timedOut: false, done: { valid: true, writes: 0, kind: "cron", next: "2026-10-04T12:05:00.000Z" } });
  });
});

describe("T0194 Stats and analytics query truth", () => {
  it("an upcoming script schedule keeps its script kind", () => {
    createSchedule({ kind: "script", scriptName: "owned.mjs", name: "Owned script", schedule: "every 5m", nextRunAt: "2026-10-04T13:00:00Z" });
    expect(computeDashboard().stats.automations.nextRun).toEqual({ kind: "script", name: "Owned script", at: "2026-10-04T13:00:00Z" });
  });
  it("same-day overdue ISO schedules are excluded in favour of the actual future row", () => {
    createSchedule({ name: "Overdue", schedule: "every 5m", nextRunAt: "2026-10-04T11:59:59Z" });
    expect(computeDashboard().stats.automations.nextRun).toBeNull();
    createSchedule({ name: "Future", schedule: "every 5m", nextRunAt: "2026-10-04 12:00:01" });
    expect(computeDashboard().stats.automations.nextRun).toEqual({ kind: "mission", name: "Future", at: "2026-10-04 12:00:01" });
  });
  it.each(["events", "completed timings"])("%s obeys the inclusive cutoff for both ISO and SQLite timestamps", mode => {
    const expected: string[] = [];
    for (const iso of [false, true]) for (const offset of [-1000, 0, 1000]) {
      const date = new Date(Date.parse(NOW) - 86_400_000 + offset);
      const at = iso ? date.toISOString() : date.toISOString().replace("T", " ").replace(".000Z", "");
      const id = `owned-${iso}-${offset}`;
      if (offset >= 0) expected.push(at);
      if (mode === "events") testDb!.prepare("INSERT INTO analytics_events(id,event_type,created_at) VALUES (?,'mission.completed',?)").run(id, at);
      else {
        createRun({ id });
        testDb!.prepare("UPDATE runs SET status='completed', submitted_at=?, completed_at=? WHERE id=?").run(at, NOW, id);
      }
    }
    if (mode === "events") expect(countByTypeSince(1)).toEqual({ "mission.completed": 4 });
    else expect(readCompletedRunTimings("-1 days").map(row => row.submitted_at).sort()).toEqual(expected.sort());
  });
});
