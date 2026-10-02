/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- hoisted singleton fixture */
import { openBaselineDb, type RealDb } from "../helpers/baseline-db";
let testDb: RealDb | null = null;
jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => testDb));
import { createModel, getModelDefaults, getModel, setDefaultModel } from "@/lib/models/models-repository";

beforeEach(() => { testDb = openBaselineDb(); });
afterEach(() => { testDb?.close(); testDb = null; });
const model = (name: string) => ({ name, provider: "oracle-provider", modelId: `oracle-${name}` });
function snapshot() {
  return {
    models: testDb!.prepare("SELECT * FROM models ORDER BY id").all(),
    defaults: testDb!.prepare("SELECT * FROM model_defaults ORDER BY task_type").all(),
  };
}
function seed() {
  const old = createModel(model("old"));
  const unrelated = createModel(model("unrelated"));
  setDefaultModel("agent", old.id);
  setDefaultModel("vision", old.id);
  setDefaultModel("hindsight", unrelated.id);
  return { old, unrelated };
}

describe("T-0189 atomic model creation and defaults", () => {
  it("creates a model and replaces requested defaults while preserving unrelated slots", () => {
    const { unrelated } = seed();
    const next = createModel({ ...model("next"), apiStyle: "openai", defaults: { agent: true, vision: true } });
    expect(getModel(next.id)).toEqual(next);
    expect(next.apiStyle).toBe("openai");
    expect(getModelDefaults()).toMatchObject({ agent: next.id, vision: next.id, hindsight: unrelated.id });
    expect(testDb!.prepare("SELECT COUNT(*) AS count FROM models").get()).toEqual({ count: 3 });
  });
  it("validation failure preserves models and defaults before any write", () => {
    seed();
    const before = snapshot();
    expect(() => createModel({ ...model("invalid"), name: "", defaults: { agent: true, vision: true } })).toThrow(/name/i);
    expect(snapshot()).toEqual(before);
  });
  it.each(["agent", "vision"])("failure replacing %s rolls back the new model and all default changes", (slot) => {
    seed();
    const before = snapshot();
    // At vision, an earlier requested slot has already been replaced. ABORT
    // cancels only the failing statement, so the caller must supply atomicity.
    testDb!.exec(`CREATE TRIGGER oracle_default_failure BEFORE INSERT ON model_defaults
      WHEN NEW.task_type = '${slot}' BEGIN SELECT RAISE(ABORT, 'oracle default insert'); END;`);
    expect(() => createModel({ ...model("next"), defaults: { agent: true, vision: true } }))
      .toThrow(/oracle default insert/);
    expect(snapshot()).toEqual(before);
    testDb!.exec("DROP TRIGGER oracle_default_failure");
    const next = createModel({ ...model("retry"), defaults: { agent: true, vision: true } });
    expect(getModelDefaults()).toMatchObject({ agent: next.id, vision: next.id });
  });
});
