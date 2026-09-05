/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- the new module is loaded inside the test that asks for it, so a missing file reds one test rather than the suite */

// ═══════════════════════════════════════════════════════════════
// B6 oracle, group defaults-and-diff, the D13 half (T-0100).
//
// Written before the product code moved. Contract section 2, "D13 a real
// diff": POST /api/models/[id]/diff answers { diffs, modelName, inSync, note }
// and every row is a real difference between the database row and the
// section the sync would touch.
//
//   PUSH compares the row against config.model (what
//        syncSingleModelToHermesConfig overwrites): in sync -> diffs [],
//        inSync true; default 'b' vs modelId 'a' -> exactly one row
//        { modelId, 'Model ID', 'b → a' }; no config.yaml -> four rows whose
//        detail starts '(none) → '; the credential row keeps id 'model-env'
//        and never counts for inSync.
//   PULL uses readHermesConfigModels().get(modelKey(provider, modelId)), the
//        same lookup the pull route applies, mapped through the same
//        diffModelAgainstHermes: an auxiliary section differing in baseUrl
//        -> one row { baseUrl, 'Base URL', 'u → v2' } and no modelId/provider
//        rows; no matching section -> the pull route's own sentence; a
//        contextLength difference -> 'Context length' '128000 → 200000'.
//   BOTH a config.yaml that exists but does not parse -> diffs [], inSync
//        false, note 'config.yaml did not parse. Repair it before pushing'.
//   The pull preview's field ids equal the pull route's diff fields for the
//        same fixture, because both call the new pure
//        src/modules/hermes/lib/model-diff.ts.
//
// THE DEFECT, in one line. The push branch lists the row's own values without
// ever reading `hermesModel`, so the modal says 'Confirm (3 changes)' when
// config.yaml already holds them; the pull branch reads only config.model, so
// a model living under auxiliary.vision previews a different model's rows and
// never shows the two fields the pull can actually change.
//
// Doubles, as models-pull-context-length.test.ts has them: the repository
// (getModelWithKey for the diff route, listModels/updateModel for the pull
// route it is compared against) and hermes-config-read. The Hermes home is a
// temp directory so `existsSync(paths.config)` is the real filesystem: the
// parse-note cases write a genuinely malformed file, the ordinary cases write
// the same document the read double answers with, and the no-file case writes
// nothing.
//
// Type-tolerance: `inSync` and `note` are read off the body through a loose
// interface (`DiffAnswer`) so tsconfig.tests stays clean before B6 lands.
// ═══════════════════════════════════════════════════════════════

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import * as yaml from "js-yaml";

const mockGetModelWithKey = jest.fn();
const mockListModels = jest.fn();
const mockUpdateModel = jest.fn();
jest.mock("@/lib/models-repository", () => ({
  getModelWithKey: (...a: unknown[]) => mockGetModelWithKey(...a),
  listModels: (...a: unknown[]) => mockListModels(...a),
  updateModel: (...a: unknown[]) => mockUpdateModel(...a),
}));

const mockReadHermesConfigModels = jest.fn();
const mockReadHermesYamlConfig = jest.fn();
jest.mock("@/modules/hermes/lib/hermes-config-read", () => ({
  ...(jest.requireActual("@/modules/hermes/lib/hermes-config-read") as Record<string, unknown>),
  readHermesConfigModels: (...a: unknown[]) => mockReadHermesConfigModels(...a),
  readHermesYamlConfig: (...a: unknown[]) => mockReadHermesYamlConfig(...a),
}));

jest.mock("@/modules/hermes/lib/agent-runtime", () => {
  const { buildHermesPathBundle } = jest.requireActual(
    "@/modules/hermes/lib/paths",
  ) as typeof import("@/modules/hermes/lib/paths");
  const home = () => (global as Record<string, unknown>).__B6_DIFF_HOME__ as string;
  return {
    getActiveHermesPaths: () => buildHermesPathBundle(home()),
    getActiveHermesHome: () => home(),
  };
});

jest.mock("@/lib/api-logger", () => ({
  ...(jest.requireActual("@/lib/api-logger") as Record<string, unknown>),
  logApiError: jest.fn(),
}));

import { NextRequest } from "next/server";
import type { HermesConfigModelEntry } from "@/modules/hermes/lib/hermes-config-read";
import { POST as diffRoute } from "@/app/api/models/[id]/diff/route";
import { POST as pullRoute } from "@/app/api/models/sync/pull/route";

// ── fixtures ────────────────────────────────────────────────────

interface DiffRow {
  id: string;
  label: string;
  detail: string;
}

/** The answer after B6. `inSync`/`note` are optional only for the compiler. */
interface DiffAnswer {
  diffs: DiffRow[];
  modelName: string;
  inSync?: boolean;
  note?: string | null;
}

const DB_MODEL = {
  id: "m1",
  name: "Agent",
  provider: "p",
  modelId: "a",
  baseUrl: "u" as string | null,
  contextLength: 200000 as number | null,
  credentialsId: null as string | null,
  apiStyle: null,
  apiKey: null as string | null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

/** A config.model section that matches DB_MODEL field for field. */
const IN_SYNC_PRIMARY = { model: { default: "a", provider: "p", base_url: "u", context_length: 200000 } };

// Built by join so the literal carries no escape sequence.
const MALFORMED = ["agent:", "  max_turns: 100", "  max_turns: 200", ""].join("\n");

let home = "";

/**
 * Point every reader at one state. `disk` is what the file on disk holds
 * (absent, malformed, or the same document the yaml double answers with);
 * `models` is what readHermesConfigModels answers.
 */
function hermesState(opts: {
  disk: "absent" | "malformed" | Record<string, unknown>;
  models?: Array<[string, HermesConfigModelEntry]>;
}): void {
  const path = join(home, "config.yaml");
  if (opts.disk === "absent") {
    if (existsSync(path)) rmSync(path);
    mockReadHermesYamlConfig.mockReturnValue(null);
  } else if (opts.disk === "malformed") {
    writeFileSync(path, MALFORMED, "utf-8");
    mockReadHermesYamlConfig.mockReturnValue(null);
  } else {
    writeFileSync(path, yaml.dump(opts.disk, { lineWidth: -1 }), "utf-8");
    mockReadHermesYamlConfig.mockReturnValue(opts.disk);
  }
  mockReadHermesConfigModels.mockReturnValue(new Map(opts.models ?? []));
}

async function diff(direction: "push" | "pull", id = DB_MODEL.id): Promise<{ status: number; data: DiffAnswer }> {
  const res = await diffRoute(
    new NextRequest(`http://localhost/api/models/${id}/diff`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ direction }),
    }),
    { params: Promise.resolve({ id }) },
  );
  const body = (await res.json()) as { data: DiffAnswer };
  return { status: res.status, data: body.data };
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "b6-models-diff-"));
  (global as Record<string, unknown>).__B6_DIFF_HOME__ = home;
  jest.clearAllMocks();
  mockGetModelWithKey.mockReturnValue({ ...DB_MODEL });
  mockListModels.mockReturnValue([{ ...DB_MODEL }]);
});

afterEach(() => {
  if (home && existsSync(home)) rmSync(home, { recursive: true, force: true });
});

// ── the fuse ────────────────────────────────────────────────────

describe("FUSE: the config.yaml this file reads lives in the OS temp directory", () => {
  it("resolves the Hermes root under the mkdtemp prefix", () => {
    const { getActiveHermesPaths } = require("@/modules/hermes/lib/agent-runtime") as {
      getActiveHermesPaths: () => { root: string; config: string };
    };
    expect(getActiveHermesPaths().root).toContain("b6-models-diff-");
    expect(getActiveHermesPaths().config.endsWith("config.yaml")).toBe(true);
  });
});

// ── push: the row against config.model ──────────────────────────

describe("POST /api/models/[id]/diff { direction: 'push' }", () => {
  it("in sync answers diffs [] and inSync true", async () => {
    hermesState({ disk: IN_SYNC_PRIMARY });

    const { status, data } = await diff("push");

    expect(status).toBe(200);
    expect(data.diffs).toEqual([]);
    expect(data.inSync).toBe(true);
    expect(data.modelName).toBe("Agent");
  });

  it("config default 'b' vs DB 'a' answers exactly one row { modelId, 'Model ID', 'b → a' }", async () => {
    hermesState({ disk: { model: { ...IN_SYNC_PRIMARY.model, default: "b" } } });

    const { data } = await diff("push");

    expect(data.diffs).toEqual([{ id: "modelId", label: "Model ID", detail: "b → a" }]);
    expect(data.inSync).toBe(false);
    expect(data.diffs.some((d) => d.id === "baseUrl")).toBe(false);
  });

  it("no config.yaml answers the four field rows, each starting '(none) → '", async () => {
    hermesState({ disk: "absent" });

    const { data } = await diff("push");

    expect(data.diffs.map((d) => d.id)).toEqual(["modelId", "provider", "baseUrl", "contextLength"]);
    for (const row of data.diffs) {
      expect({ id: row.id, detail: row.detail }).toEqual({
        id: row.id,
        detail: expect.stringMatching(/^\(none\) → /),
      });
    }
    expect(data.diffs.find((d) => d.id === "modelId")?.detail).toBe("(none) → a");
    expect(data.diffs.find((d) => d.id === "baseUrl")?.label).toBe("Base URL");
    expect(data.diffs.find((d) => d.id === "contextLength")?.detail).toBe("(none) → 200000");
    expect(data.inSync).toBe(false);
  });

  it("a config.model with no base_url against a DB baseUrl answers only { baseUrl, 'Base URL', '(none) → u' }", async () => {
    hermesState({ disk: { model: { default: "a", provider: "p", context_length: 200000 } } });

    const { data } = await diff("push");

    expect(data.diffs).toEqual([{ id: "baseUrl", label: "Base URL", detail: "(none) → u" }]);
  });

  it("a differing context_length answers { contextLength, 'Context length', '128000 → 200000' }", async () => {
    hermesState({ disk: { model: { ...IN_SYNC_PRIMARY.model, context_length: 128000 } } });

    const { data } = await diff("push");

    expect(data.diffs).toEqual([{ id: "contextLength", label: "Context length", detail: "128000 → 200000" }]);
  });

  it("the credential row keeps id 'model-env' and does not count against inSync", async () => {
    mockGetModelWithKey.mockReturnValue({
      ...DB_MODEL,
      provider: "anthropic",
      credentialsId: "c1",
      apiKey: "sk-ant-abcdefghijklmnop",
    });
    hermesState({ disk: { model: { default: "a", provider: "anthropic", base_url: "u", context_length: 200000 } } });

    const { data } = await diff("push");

    expect(data.diffs.map((d) => d.id)).toEqual(["model-env"]);
    expect(data.diffs[0].label).toBe("Credential");
    expect(data.inSync).toBe(true);
  });

  it("a config.yaml that exists but does not parse answers the parse note, not four '(none)' rows", async () => {
    hermesState({ disk: "malformed" });

    const { status, data } = await diff("push");

    expect(status).toBe(200);
    expect(data.diffs).toEqual([]);
    expect(data.inSync).toBe(false);
    expect(data.note).toBe("config.yaml did not parse. Repair it before pushing");
  });
});

// ── pull: the row against the matching section, wherever it lives ──

describe("POST /api/models/[id]/diff { direction: 'pull' }", () => {
  const AUX_V2: [string, HermesConfigModelEntry] = [
    "p::a",
    { modelId: "a", provider: "p", baseUrl: "v2", contextLength: null },
  ];
  const AUX_V2_DISK = {
    model: { default: "other", provider: "q" },
    auxiliary: { vision: { model: "a", provider: "p", base_url: "v2" } },
  };

  it("an auxiliary section differing in baseUrl answers one row { baseUrl, 'Base URL', 'u → v2' } and no modelId/provider rows", async () => {
    hermesState({ disk: AUX_V2_DISK, models: [AUX_V2] });

    const { status, data } = await diff("pull");

    expect(status).toBe(200);
    expect(data.diffs).toEqual([{ id: "baseUrl", label: "Base URL", detail: "u → v2" }]);
    expect(data.diffs.some((d) => d.id === "modelId" || d.id === "provider")).toBe(false);
    expect(data.inSync).toBe(false);
  });

  it("no matching section answers diffs [], inSync false and the pull route's own sentence", async () => {
    hermesState({ disk: { model: { default: "other", provider: "q" } } });

    const { data } = await diff("pull");

    expect(data.diffs).toEqual([]);
    expect(data.inSync).toBe(false);
    expect(data.note).toBe("No matching section in config.yaml for p/a");
  });

  it("a hermes contextLength of 200000 against a DB 128000 answers { contextLength, 'Context length', '128000 → 200000' }", async () => {
    mockGetModelWithKey.mockReturnValue({ ...DB_MODEL, contextLength: 128000 });
    hermesState({
      disk: { model: { default: "a", provider: "p", base_url: "u", context_length: 200000 } },
      models: [["p::a", { modelId: "a", provider: "p", baseUrl: "u", contextLength: 200000 }]],
    });

    const { data } = await diff("pull");

    expect(data.diffs).toEqual([{ id: "contextLength", label: "Context length", detail: "128000 → 200000" }]);
  });

  it("a Hermes section with no base_url against a DB one reads 'u → (none)', not 'u → '", async () => {
    // Sweep survivor `diff-fmt-ignores-empty`. diffModelAgainstHermes answers
    // `after: ""` for an absent base_url (that is what the apply writes), so
    // the formatter is the only thing standing between the operator and a row
    // whose right-hand side is blank.
    hermesState({
      disk: { auxiliary: { vision: { model: "a", provider: "p" } } },
      models: [["p::a", { modelId: "a", provider: "p", baseUrl: null, contextLength: null }]],
    });

    const { data } = await diff("pull");

    expect(data.diffs).toEqual([{ id: "baseUrl", label: "Base URL", detail: "u → (none)" }]);
  });

  it("a section equal to the row answers diffs [], inSync true and names the model in the note", async () => {
    hermesState({
      disk: IN_SYNC_PRIMARY,
      models: [["p::a", { modelId: "a", provider: "p", baseUrl: "u", contextLength: 200000 }]],
    });

    const { data } = await diff("pull");

    expect(data.diffs).toEqual([]);
    expect(data.inSync).toBe(true);
    expect(data.note).toBe("Agent is already in sync with config.yaml");
  });

  it("a config.yaml that exists but does not parse answers the parse note, not 'No matching section'", async () => {
    hermesState({ disk: "malformed" });

    const { data } = await diff("pull");

    expect(data.diffs).toEqual([]);
    expect(data.inSync).toBe(false);
    expect(data.note).toBe("config.yaml did not parse. Repair it before pushing");
  });

  it("the preview's field ids equal the pull route's diff fields for the same fixture", async () => {
    // Both must call the same diffModelAgainstHermes, so the ids the modal
    // lets the operator exclude are the ids the pull will honour.
    mockGetModelWithKey.mockReturnValue({ ...DB_MODEL, contextLength: 128000 });
    mockListModels.mockReturnValue([{ ...DB_MODEL, contextLength: 128000 }]);
    hermesState({
      disk: { auxiliary: { vision: { model: "a", provider: "p", base_url: "v2", context_length: 200000 } } },
      models: [["p::a", { modelId: "a", provider: "p", baseUrl: "v2", contextLength: 200000 }]],
    });

    const preview = await diff("pull");
    const pulled = await pullRoute(
      new NextRequest("http://localhost/api/models/sync/pull", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ modelId: DB_MODEL.id }),
      }),
    );
    const pulledBody = (await pulled.json()) as { data: { diffs: Array<{ field: string }> } };

    const previewIds = preview.data.diffs.map((d) => d.id).sort();
    const pullFields = pulledBody.data.diffs.map((d) => d.field).sort();
    expect(previewIds).toEqual(["baseUrl", "contextLength"]);
    expect(previewIds).toEqual(pullFields);
  });
});

// ── the pure helper both routes share ───────────────────────────

describe("src/modules/hermes/lib/model-diff.ts", () => {
  type DiffModelAgainstHermes = (
    model: { modelId: string; provider: string; baseUrl: string | null; contextLength: number | null },
    hermes: HermesConfigModelEntry,
  ) => { diffs: Array<{ field: string; before: unknown; after: unknown }>; updates: Record<string, unknown> };

  function loadHelper(): DiffModelAgainstHermes {
    return (require("@/modules/hermes/lib/model-diff") as { diffModelAgainstHermes: DiffModelAgainstHermes })
      .diffModelAgainstHermes;
  }

  it("exports diffModelAgainstHermes, the computeDiffs logic moved out of the pull route", () => {
    const diffModelAgainstHermes = loadHelper();

    const out = diffModelAgainstHermes(
      { modelId: "a", provider: "p", baseUrl: "u", contextLength: 128000 },
      { modelId: "a", provider: "p", baseUrl: "v2", contextLength: 200000 },
    );

    expect(out.diffs).toEqual([
      { field: "baseUrl", before: "u", after: "v2" },
      { field: "contextLength", before: 128000, after: 200000 },
    ]);
    expect(out.updates).toEqual({ baseUrl: "v2", contextLength: 200000 });
  });

  it("keeps the pull route's baseUrl rule: a Hermes null against a DB value writes ''", () => {
    const diffModelAgainstHermes = loadHelper();

    const out = diffModelAgainstHermes(
      { modelId: "a", provider: "p", baseUrl: "u", contextLength: null },
      { modelId: "a", provider: "p", baseUrl: null, contextLength: null },
    );

    expect(out.diffs).toEqual([{ field: "baseUrl", before: "u", after: "" }]);
    expect(out.updates).toEqual({ baseUrl: "" });
  });

  it("imports no repository, so the pull route's narrow mock set keeps working", () => {
    const source = readFileSync(join(__dirname, "..", "..", "src", "modules", "hermes", "lib", "model-diff.ts"), "utf-8");

    // Import statements, not any mention: the reason this module must stay
    // pure belongs in its own header, and a header that says so is not an import.
    expect(source).not.toMatch(/^\s*import[^\n]*["']@\/lib\/(models|credentials)-repository["']/m);
  });

  it("is what the pull route calls now, in place of its private computeDiffs", () => {
    const source = readFileSync(
      join(__dirname, "..", "..", "src", "app", "api", "models", "sync", "pull", "route.ts"),
      "utf-8",
    );

    expect(source).toMatch(/model-diff/);
    expect(source).not.toMatch(/function computeDiffs/);
  });
});

// ── kept ────────────────────────────────────────────────────────

describe("GREEN CONTROL: what the rewrite keeps", () => {
  it("an unknown model is still a 404", async () => {
    mockGetModelWithKey.mockReturnValue(null);
    hermesState({ disk: IN_SYNC_PRIMARY });

    const { status } = await diff("push", "no-such");

    expect(status).toBe(404);
  });

  it("the body still carries modelName", async () => {
    hermesState({ disk: IN_SYNC_PRIMARY });

    const { data } = await diff("pull");

    expect(data.modelName).toBe("Agent");
  });
});
