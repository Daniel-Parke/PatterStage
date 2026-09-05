/** @jest-environment node */

// ═══════════════════════════════════════════════════════════════
// B6 oracle, group config-route-builder, half two (T-0100, D77 + D78).
//
// Written before the product code moved. It holds contract section 3's D77
// server lines (validateSectionValues; PUT 400 on range, type and select;
// null passes range validation; keys outside the field list are ignored) and
// D78's wire lines (null deletes the key; an emptied section vanishes; ''
// still writes; the unset is idempotent; the writer's refresh carries the
// deletion into the row).
//
// THE TWO DEFECTS. PUT /api/config validates `values` as a free-form record
// and merges anything: max_turns 9999, "12", threshold 0.96 and verbose "yes"
// are all written with a 200. And deepMerge never deletes, so once a key is
// written nothing can remove it; the UI's coercions turn an untouched toggle
// into `false`, an emptied number into `0`, an emptied text into `''`.
//
// HARNESS. The PUT-route mock set of config-values-validation and
// config-put-refuses-unparseable-yaml (fs, agent-runtime at /tmp/test-hermes,
// paths, api-logger with a REAL 500 response, audit, a cold config cache),
// plus the two mocks the D76 writer refresh needs: agent-root-repository as a
// recorder, and profile-paths answering the SAME root the route writes to,
// so the resolve() guard in writeHermesConfigFile matches. Without that
// second mock the refresh is silently skipped under jest (critique-config
// gap 2), and the deletion oracle at the bottom could never fire.
//
// The not-yet-existing export is read through a loose cast (the
// b5-first-run-and-active-days pattern) so the lint gate is not red on types
// alone; a missing export fails at the call, which is the contract red.
// ═══════════════════════════════════════════════════════════════

const mockReadFileSync = jest.fn();
const mockWriteFileSync = jest.fn();
const mockExistsSync = jest.fn();
const mockMkdirSync = jest.fn();
const mockRenameSync = jest.fn();
const mockUnlinkSync = jest.fn();
const mockGetMetaPair = jest.fn();
const mockAppendAuditLine = jest.fn();
const mockUpdateAgentRoot = jest.fn();

// A bare jest.fn() for serverErrorFromCatch returns undefined and every
// assertion dies on `undefined.status`; a real 500 keeps a wrong path legible.
const mockServerError = () =>
  new Response(JSON.stringify({ error: "server error" }), {
    status: 500,
    headers: { "content-type": "application/json" },
  });

// Every entry is a closure, not the jest.fn itself: the route is imported
// statically below, imports hoist above these consts, and an eager reference
// in the factory is a TDZ error at suite load.
jest.mock("fs", () => ({
  readFileSync: (...a: unknown[]) => mockReadFileSync(...a),
  writeFileSync: (...a: unknown[]) => mockWriteFileSync(...a),
  existsSync: (...a: unknown[]) => mockExistsSync(...a),
  mkdirSync: (...a: unknown[]) => mockMkdirSync(...a),
  renameSync: (...a: unknown[]) => mockRenameSync(...a),
  unlinkSync: (...a: unknown[]) => mockUnlinkSync(...a),
}));

const ROOT = "/tmp/test-hermes";
const CONFIG_PATH = `${ROOT}/config.yaml`;

jest.mock("@/modules/hermes/lib/agent-runtime", () => ({
  getActiveHermesPaths: jest.fn(() => ({
    root: "/tmp/test-hermes",
    config: "/tmp/test-hermes/config.yaml",
    backups: "/tmp/test-hermes/backups",
    env: "/tmp/test-hermes/.env",
    soul: "/tmp/test-hermes/SOUL.md",
    hermes: "/tmp/test-hermes/HERMES.md",
    agents: "/tmp/test-hermes/AGENTS.md",
    skills: "/tmp/test-hermes/skills",
    profiles: "/tmp/test-hermes/profiles",
    sessions: "/tmp/test-hermes/sessions",
    logs: "/tmp/test-hermes/logs",
    cronJobs: "/tmp/test-hermes/cron/jobs.json",
    memoryDb: "/tmp/test-hermes/memory_store.db",
  })),
  getActiveHermesHome: jest.fn(() => "/tmp/test-hermes"),
  getAgentLlmEndpoints: jest.fn(() => ({
    apiUrl: "http://127.0.0.1:9/v1/chat/completions",
    gatewayBase: "http://127.0.0.1:9",
  })),
}));

// The SAME root as the route's active paths: this is what lets the writer's
// "is this the default root's config.yaml" guard say yes under jest.
jest.mock("@/modules/hermes/lib/profile-paths", () => ({
  getHermesDefaultRoot: () => "/tmp/test-hermes",
  resolveProfileHermesHome: (slug: string) =>
    slug === "default" ? "/tmp/test-hermes" : `/tmp/test-hermes/profiles/${slug}`,
}));

jest.mock("@/lib/agent-root-repository", () => ({
  getAgentRoot: jest.fn(() => ({
    id: 1, displayName: "Bob", description: "", personality: "technical",
    configYaml: "", soulMd: "", agentsMd: "", frameworkMd: "", userMd: "", memoryMd: "",
    disabledSkillsJson: "[]", platformToolsetsJson: "{}", syncedAt: null, syncError: null, updatedAt: "",
  })),
  updateAgentRoot: (...a: unknown[]) => mockUpdateAgentRoot(...a),
  setAgentRootSyncStatus: jest.fn(),
}));

jest.mock("@/lib/paths", () => ({
  PS_DATA_DIR: "/tmp/ch-data",
  PATHS: {
    missions: "/tmp/ch-data/missions",
    patterStageDb: "/tmp/ch-data/control-hub.db",
    templates: "/tmp/ch-data/templates",
    stories: "/tmp/ch-data/stories",
    recroom: "/tmp/ch-data/recroom",
    workspaces: "/tmp/ch-data/workspaces",
    auditLog: "/tmp/ch-data/audit",
    psScripts: "/tmp/ch-data/scripts",
    psHardwareLogs: "/tmp/ch-data/logs",
  },
  getPsScriptsDir: () => "/tmp/ch-data/scripts",
  getPsHardwareLogDir: () => "/tmp/ch-data/logs",
  readEnv: () => undefined,
}));

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.fn(() => mockServerError()),
}));
jest.mock("@/lib/api-auth", () => ({}));
jest.mock("@/lib/audit-log", () => ({
  appendAuditLine: (...a: unknown[]) => mockAppendAuditLine(...a),
}));
jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));

// Cold cache: the GET after an unset must read the file, not a 15 s memory.
jest.mock("@/lib/system-repository", () => ({
  getMetaPair: (...a: unknown[]) => mockGetMetaPair(...a),
  setMultipleStats: jest.fn(),
  deleteMetaPair: jest.fn(),
}));

import * as yaml from "js-yaml";
import { NextRequest } from "next/server";

import * as configSchema from "@/lib/config-schema";
import { GET, PUT } from "@/app/api/config/route";

// ── pre-B6 type shim (see header) ───────────────────────────────

type FieldProblem = { key: string; message: string };
type Validate = (sectionId: string, values: Record<string, unknown>) => FieldProblem[];

/** The new export, read off the namespace so the import compiles before B6. */
const validateSectionValues = (
  configSchema as typeof configSchema & { validateSectionValues?: Validate }
).validateSectionValues as Validate;

// ── helpers ─────────────────────────────────────────────────────

function putConfig(section: string, values: Record<string, unknown>) {
  return PUT(
    new NextRequest("http://localhost/api/config", {
      method: "PUT",
      body: JSON.stringify({ section, values }),
    }),
  );
}

async function errorOf(res: Response): Promise<string> {
  return ((await res.json()) as { error?: string }).error ?? "";
}

/** The post-merge config.yaml the route staged, or null when it wrote none. */
function writtenConfig(): string | null {
  const call = mockWriteFileSync.mock.calls.find((c) =>
    String(c[0]).startsWith(`${CONFIG_PATH}.tmp-`),
  );
  return call ? String(call[1]) : null;
}

function writtenDoc(): Record<string, unknown> {
  const text = writtenConfig();
  expect(text).not.toBeNull();
  return (yaml.load(text as string) ?? {}) as Record<string, unknown>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockExistsSync.mockReturnValue(true);
  mockGetMetaPair.mockReturnValue([]);
  mockReadFileSync.mockReturnValue("agent:\n  max_turns: 100\n  verbose: false\n");
});

// ═══════════════════════════════════════════════════════════════
// D77: validateSectionValues, the pure half
// ═══════════════════════════════════════════════════════════════
describe("validateSectionValues", () => {
  it("names the field, the bounds and the value it got", () => {
    expect(validateSectionValues("agent", { max_turns: 9999 })).toEqual([
      { key: "max_turns", message: "Max Turns must be between 1 and 500 (got 9999)" },
    ]);
  });

  it("treats the bounds as inclusive, at both ends", () => {
    expect(validateSectionValues("agent", { max_turns: 500 })).toEqual([]);
    expect(validateSectionValues("agent", { max_turns: 1 })).toEqual([]);
    expect(validateSectionValues("agent", { max_turns: 0 })).toHaveLength(1);
  });

  it("NaN is one problem naming Max Turns, never a silent pass", () => {
    const problems = validateSectionValues("agent", { max_turns: NaN });

    expect(problems).toHaveLength(1);
    expect(problems[0].key).toBe("max_turns");
    expect(problems[0].message).toMatch(/Max Turns/);
  });

  it("a numeric string is not a number", () => {
    expect(validateSectionValues("agent", { max_turns: "12" })).toEqual([
      { key: "max_turns", message: "Max Turns must be a number" },
    ]);
  });

  it("a numeric string that is ALSO out of range is still exactly one problem", () => {
    // Sweep survivor `validate-two-problems-per-field`. Without the early
    // continue, `"9999" > 500` coerces and the field is reported twice: once
    // for its type and once for a range it was never measured against.
    const problems = validateSectionValues("agent", { max_turns: "9999" });

    expect(problems).toEqual([{ key: "max_turns", message: "Max Turns must be a number" }]);
  });

  it("honours fractional bounds", () => {
    // compression.threshold is 0.1 to 0.95; voice.silence_threshold is 0 to 1.
    // No integer check anywhere, or every fractional field breaks.
    expect(validateSectionValues("compression", { threshold: 0.96 })).toEqual([
      { key: "threshold", message: "Threshold must be between 0.1 and 0.95 (got 0.96)" },
    ]);
    expect(validateSectionValues("compression", { threshold: 0.95 })).toEqual([]);
  });

  it("a select must be one of its options, listed in the message", () => {
    expect(validateSectionValues("agent", { reasoning_effort: "ultra" })).toEqual([
      {
        key: "reasoning_effort",
        message: "Reasoning Effort must be one of: none, low, medium, high, xhigh",
      },
    ]);
    expect(validateSectionValues("agent", { reasoning_effort: "high" })).toEqual([]);
  });

  it("a boolean must be a boolean", () => {
    const problems = validateSectionValues("agent", { verbose: "yes" });

    expect(problems).toHaveLength(1);
    expect(problems[0].key).toBe("verbose");
    expect(problems[0].message).toMatch(/Verbose Mode/);
    expect(validateSectionValues("agent", { verbose: true })).toEqual([]);
  });

  it("a well-formed section is clean", () => {
    expect(validateSectionValues("display", { show_cost: false, skin: "mono" })).toEqual([]);
  });

  it("null is the unset sentinel and is skipped", () => {
    expect(validateSectionValues("agent", { max_turns: null })).toEqual([]);
  });

  it("keys outside the field list are ignored", () => {
    // personalities is a complexKey, not a FieldDef; the deep-merge test's
    // nested patch must keep passing.
    expect(validateSectionValues("agent", { personalities: { default: "NewHermes" } })).toEqual(
      [],
    );
  });

  it("reports every problem in one pass", () => {
    const problems = validateSectionValues("agent", { max_turns: 0, verbose: "yes" });

    expect(problems.map((p) => p.key).sort()).toEqual(["max_turns", "verbose"]);
  });
});

// ═══════════════════════════════════════════════════════════════
// D77: PUT /api/config refuses what the schema forbids
// ═══════════════════════════════════════════════════════════════
describe("PUT /api/config refuses out-of-range and wrong-typed values", () => {
  it("max_turns 9999 is a 400 naming the bounds, and nothing is written", async () => {
    const res = await putConfig("agent", { max_turns: 9999 });

    expect(res.status).toBe(400);
    const error = await errorOf(res);
    expect(error).toMatch(/^Invalid values for 'agent': /);
    expect(error).toContain("Max Turns must be between 1 and 500");
    expect(writtenConfig()).toBeNull();
    expect(mockRenameSync).not.toHaveBeenCalled();
    expect(mockUpdateAgentRoot).not.toHaveBeenCalled();
  });

  it("max_turns 0 is refused and 500 is accepted (bounds inclusive)", async () => {
    expect((await putConfig("agent", { max_turns: 0 })).status).toBe(400);

    const ok = await putConfig("agent", { max_turns: 500 });

    expect(ok.status).toBe(200);
    expect(writtenConfig()).toContain("max_turns: 500");
  });

  it("a numeric string is refused as not a number", async () => {
    const res = await putConfig("agent", { max_turns: "12" });

    expect(res.status).toBe(400);
    expect(await errorOf(res)).toMatch(/must be a number/);
    expect(writtenConfig()).toBeNull();
  });

  it("compression.threshold 0.96 is refused and 0.95 is accepted", async () => {
    mockReadFileSync.mockReturnValue("compression:\n  threshold: 0.5\n");

    expect((await putConfig("compression", { threshold: 0.96 })).status).toBe(400);
    expect(writtenConfig()).toBeNull();

    const ok = await putConfig("compression", { threshold: 0.95 });

    expect(ok.status).toBe(200);
    expect(writtenConfig()).toContain("threshold: 0.95");
  });

  it("reasoning_effort 'ultra' is refused with the option list and 'high' is accepted", async () => {
    const bad = await putConfig("agent", { reasoning_effort: "ultra" });

    expect(bad.status).toBe(400);
    expect(await errorOf(bad)).toMatch(/must be one of/);
    expect(writtenConfig()).toBeNull();

    expect((await putConfig("agent", { reasoning_effort: "high" })).status).toBe(200);
    expect(writtenConfig()).toContain("reasoning_effort: high");
  });

  it("verbose 'yes' is refused and true is accepted", async () => {
    const bad = await putConfig("agent", { verbose: "yes" });

    expect(bad.status).toBe(400);
    expect(await errorOf(bad)).toMatch(/Verbose Mode/);
    expect(writtenConfig()).toBeNull();

    expect((await putConfig("agent", { verbose: true })).status).toBe(200);
    expect(writtenConfig()).toContain("verbose: true");
  });

  it("lists every problem, joined by '; '", async () => {
    const res = await putConfig("agent", { max_turns: 0, verbose: "yes" });

    expect(res.status).toBe(400);
    const error = await errorOf(res);
    expect(error).toContain("Max Turns must be between 1 and 500 (got 0)");
    expect(error).toMatch(/Verbose Mode/);
    expect(error).toContain("; ");
  });

  it("GREEN CONTROL: a nested complexKey patch is still a 200 with siblings preserved", async () => {
    // config-put-deep-merge's contract, restated here so the validator cannot
    // grow a "reject anything not in the field list" clause.
    mockReadFileSync.mockReturnValue(
      "agent:\n  max_turns: 100\n  personalities:\n    default: Hermes\n    custom: MyAgent\n",
    );

    const res = await putConfig("agent", { personalities: { default: "NewHermes" } });

    expect(res.status).toBe(200);
    expect(writtenConfig()).toMatch(/default: NewHermes/);
    expect(writtenConfig()).toMatch(/custom: MyAgent/);
  });

  it("GREEN CONTROL: max_turns null is not rejected by range validation", async () => {
    // null is D78's unset sentinel; a range check that saw it as "not a
    // number" would make the Clear button a 400.
    const res = await putConfig("agent", { max_turns: null });

    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════
// D78: null on the wire deletes the key
// ═══════════════════════════════════════════════════════════════
describe("PUT /api/config with a null value unsets the key", () => {
  it("deletes show_cost and keeps its sibling", async () => {
    mockReadFileSync.mockReturnValue("display:\n  show_cost: true\n  skin: mono\n");

    const res = await putConfig("display", { show_cost: null });

    expect(res.status).toBe(200);
    const written = writtenConfig();
    expect(written).toContain("skin: mono");
    // Neither `show_cost: null` nor `show_cost: false`: the key is gone.
    expect(written).not.toContain("show_cost");
    expect(writtenDoc()).toEqual({ display: { skin: "mono" } });
  });

  it("removes the section when its only key is unset, and the next GET has no display", async () => {
    mockReadFileSync.mockReturnValue("agent:\n  max_turns: 100\ndisplay:\n  show_cost: true\n");

    const res = await putConfig("display", { show_cost: null });

    expect(res.status).toBe(200);
    const doc = writtenDoc();
    expect("display" in doc).toBe(false);
    expect(doc).toEqual({ agent: { max_turns: 100 } });

    // The file as the route left it is what the index reads next; the
    // "configured" pill on Display must go with the section.
    mockReadFileSync.mockReturnValue(writtenConfig() as string);
    const body = (await (await GET(new NextRequest("http://localhost/api/config"))).json()) as {
      data: Record<string, unknown>;
    };
    expect("display" in body.data).toBe(false);
    expect(body.data).toEqual({ agent: { max_turns: 100 } });
  });

  it("is idempotent: unsetting a key that is already absent changes nothing", async () => {
    mockReadFileSync.mockReturnValue("display:\n  skin: mono\n");

    const res = await putConfig("display", { show_cost: null });

    expect(res.status).toBe(200);
    expect(writtenDoc()).toEqual({ display: { skin: "mono" } });
  });

  it("GREEN CONTROL: an explicit empty string still writes '' (only null unsets)", async () => {
    mockReadFileSync.mockReturnValue("display:\n  skin: mono\n");

    const res = await putConfig("display", { skin: "" });

    expect(res.status).toBe(200);
    expect(writtenConfig()).toContain("skin: ''");
    expect(writtenDoc()).toEqual({ display: { skin: "" } });
  });

  it("the writer's refresh carries the deletion into agent_root.config_yaml", async () => {
    // D76's other half, seen from D78: the row must lose the key too, or the
    // next push resurrects show_cost from the stale copy and the drift banner
    // wakes on a Clear the operator meant.
    mockReadFileSync.mockReturnValue("display:\n  show_cost: true\n  skin: mono\n");

    await putConfig("display", { show_cost: null });

    expect(mockUpdateAgentRoot).toHaveBeenCalledTimes(1);
    const patch = mockUpdateAgentRoot.mock.calls[0][0] as { configYaml?: string };
    expect(patch.configYaml).toBe(writtenConfig());
    expect(patch.configYaml).not.toContain("show_cost");
  });
});
