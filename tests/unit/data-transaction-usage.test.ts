/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- independent oracle and singleton fixture */
// T-0189: authored from the ruled brief, public contracts and historical tests.
// The absent proposed parser is infrastructure, never behavioural red evidence.
import { existsSync } from "fs";
import { join } from "path";
import { openBaselineDb, type RealDb } from "../helpers/baseline-db";
import {
  applyDeepResearchMigration,
  applySpendPolicyMigration,
  applyResearchUsageMigration,
} from "@/lib/db/sql-migrations";
import type { RunUsage } from "@/lib/runtime/types";

let testDb: RealDb | null = null;
jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => testDb));

import { getRun, listActiveRuns } from "@/lib/runs/runs-repository";
import { getModelUsage, getTopMissions } from "@/lib/analytics/run-aggregates";
import { getDashboardStats } from "@/lib/stats/stats-repository";
import { getAgentPerformance } from "@/lib/stats/agent-stats";
import { recordedSpendSince } from "@/lib/spend/spend-window";
import { getSpendSummary } from "@/lib/spend/spend-summary";
import { checkUnattendedSpend } from "@/lib/spend/spend-guard";
import { writeSpendPolicy } from "@/lib/spend/spend-repository";
import { UNSET_SPEND_POLICY } from "@/lib/spend/spend-law";

type UsageCase = { label: string; raw: string | null; expected: RunUsage | null };
const counts = (inputTokens: number, outputTokens: number, totalTokens = inputTokens + outputTokens): RunUsage =>
  ({ inputTokens, outputTokens, totalTokens });
const cases: UsageCase[] = [
  { label: "missing", raw: null, expected: null },
  { label: "empty", raw: "", expected: null },
  { label: "whitespace", raw: "  ", expected: null },
  { label: "malformed", raw: "{broken", expected: null },
  { label: "null root", raw: "null", expected: null },
  { label: "number root", raw: "7", expected: null },
  { label: "boolean root", raw: "true", expected: null },
  { label: "string root", raw: '"usage"', expected: null },
  { label: "array root", raw: '[{"inputTokens":8}]', expected: null },
  { label: "empty array root", raw: "[]", expected: null },
  { label: "empty object", raw: "{}", expected: counts(0, 0) },
  { label: "omitted total", raw: '{"inputTokens":13,"outputTokens":7}', expected: counts(13, 7) },
  { label: "explicit zero", raw: '{"inputTokens":13,"outputTokens":7,"totalTokens":0}', expected: counts(13, 7, 0) },
  { label: "explicit different total", raw: '{"inputTokens":13,"outputTokens":7,"totalTokens":91}', expected: counts(13, 7, 91) },
  { label: "numeric strings", raw: '{"inputTokens":"13","outputTokens":"7","totalTokens":"91"}', expected: counts(13, 7, 91) },
  { label: "missing input", raw: '{"outputTokens":7}', expected: counts(0, 7) },
  { label: "missing output", raw: '{"inputTokens":13}', expected: counts(13, 0) },
  { label: "invalid input", raw: '{"inputTokens":"bad","outputTokens":7}', expected: counts(0, 7) },
  { label: "invalid output", raw: '{"inputTokens":13,"outputTokens":{}}', expected: counts(13, 0) },
  { label: "invalid total", raw: '{"inputTokens":13,"outputTokens":7,"totalTokens":"bad"}', expected: counts(13, 7) },
  { label: "nonfinite input", raw: '{"inputTokens":1e309,"outputTokens":7}', expected: counts(0, 7) },
  { label: "nonfinite output", raw: '{"inputTokens":13,"outputTokens":"Infinity"}', expected: counts(13, 0) },
  { label: "nonfinite total", raw: '{"inputTokens":13,"outputTokens":7,"totalTokens":1e309}', expected: counts(13, 7) },
  { label: "finite negatives", raw: '{"inputTokens":-3,"outputTokens":7,"totalTokens":-9}', expected: counts(-3, 7, -9) },
  { label: "boolean fields", raw: '{"inputTokens":true,"outputTokens":7,"totalTokens":false}', expected: counts(0, 7) },
  { label: "array fields", raw: '{"inputTokens":[13],"outputTokens":7,"totalTokens":[91]}', expected: counts(0, 7) },
  { label: "object fields", raw: '{"inputTokens":13,"outputTokens":{},"totalTokens":{}}', expected: counts(13, 0) },
  { label: "blank numeric strings", raw: '{"inputTokens":" ","outputTokens":7,"totalTokens":""}', expected: counts(0, 7) },
  { label: "null total", raw: '{"inputTokens":13,"outputTokens":7,"totalTokens":null}', expected: counts(13, 7) },
  { label: "derived sum overflow", raw: '{"inputTokens":1e308,"outputTokens":1e308}', expected: counts(1e308, 1e308, Infinity) },
  { label: "overflow with finite explicit total", raw: '{"inputTokens":1e308,"outputTokens":1e308,"totalTokens":0}', expected: counts(1e308, 1e308, 0) },
];

const parserPresent = existsSync(join(process.cwd(), "src/lib/runs/parse-stored-usage.ts"));
function parse(raw: string | null | undefined): RunUsage | null {
  const parserModule = require("@/lib/runs/parse-stored-usage") as {
    parseStoredUsage: (value: string | null | undefined) => RunUsage | null;
  };
  return parserModule.parseStoredUsage(raw);
}

it("INFRASTRUCTURE: proposed parseStoredUsage module is available", () => {
  if (!parserPresent) {
    throw new Error("INFRASTRUCTURE: proposed parseStoredUsage module is unavailable: src/lib/runs/parse-stored-usage.ts");
  }
});


(parserPresent ? describe : describe.skip)("T-0189 pure stored usage parser", () => {
  it.each(cases)("normalises $label", ({ raw, expected }) => {
    expect(parse(raw)).toEqual(expected);
  });
  it("treats undefined as unavailable usage", () => {
    expect(parse(undefined)).toBeNull();
  });
  it("derived overflow preserves both components and existing JSON serialisation", () => {
    const parsed = parse('{"inputTokens":1e308,"outputTokens":1e308}');
    expect(parsed).toEqual(counts(1e308, 1e308, Infinity));
    expect(JSON.stringify(parsed)).toBe('{"inputTokens":1e+308,"outputTokens":1e+308,"totalTokens":null}');
  });
  it.each(Array.from({ length: 32 }, (_, index) => ({
    index,
    input: index * 17 - 51,
    output: index * index + 0.25,
    total: index % 4 === 0 ? 0 : 400 - index * 7,
  })))("metamorphic finite counts case $index", ({ input, output, total }) => {
    const fields = { inputTokens: input, outputTokens: output };
    expect(parse(JSON.stringify(fields))).toEqual(counts(input, output));
    expect(parse(JSON.stringify({ ...fields, totalTokens: total }))).toEqual(counts(input, output, total));
    expect(parse(JSON.stringify({ inputTokens: String(input), outputTokens: String(output), totalTokens: String(total) })))
      .toEqual(counts(input, output, total));
  });
});

beforeEach(() => {
  testDb = openBaselineDb([applyDeepResearchMigration, applySpendPolicyMigration, applyResearchUsageMigration]);
  testDb.prepare("INSERT INTO missions (id, name, prompt, model_id) VALUES ('oracle-mission', 'Oracle mission', 'fixture', 'oracle-unknown-model')").run();
});
afterEach(() => {
  testDb?.close();
  testDb = null;
});

function seed(raw: string | null, status: "started" | "completed" = "completed", id = "oracle-run"): void {
  testDb!.prepare(`INSERT INTO runs (id, mission_id, status, usage_json, submitted_at, completed_at)
    VALUES (?, 'oracle-mission', ?, ?, datetime('now'), datetime('now'))`).run(id, status, raw);
}

describe("T-0189 existing usage consumers", () => {
  it.each(cases)("getRun preserves the contract for $label", ({ raw, expected }) => {
    seed(raw);
    expect(getRun("oracle-run")?.usage).toEqual(expected);
    expect(testDb!.prepare("SELECT usage_json FROM runs WHERE id = 'oracle-run'").get()).toEqual({ usage_json: raw });
  });
  it.each(cases)("listActiveRuns preserves the contract for $label", ({ raw, expected }) => {
    seed(raw, "started");
    const runs = listActiveRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0].usage).toEqual(expected);
  });

  it.each(cases)("model aggregation handles $label without contaminating valid rows", ({ raw, expected }) => {
    seed(raw);
    seed('{"inputTokens":2,"outputTokens":3,"totalTokens":5}', "completed", "control");
    const model = getModelUsage().find((row) => row.model === "oracle-unknown-model");
    expect(model).toMatchObject({
      inputTokens: 2 + (expected?.inputTokens ?? 0),
      outputTokens: 3 + (expected?.outputTokens ?? 0),
      totalTokens: 5 + (expected?.totalTokens ?? 0),
    });
  });
  it.each(cases)("mission aggregation handles $label without contaminating valid rows", ({ raw, expected }) => {
    seed(raw);
    seed('{"inputTokens":2,"outputTokens":3,"totalTokens":5}', "completed", "control");
    expect(getTopMissions().find((row) => row.missionId === "oracle-mission"))
      .toMatchObject({ runs: 2, totalTokens: 5 + (expected?.totalTokens ?? 0) });
  });
  it.each(cases)("dashboard aggregation handles $label", ({ raw, expected }) => {
    seed(raw);
    expect(getDashboardStats().runs).toMatchObject({
      inputTokens: expected?.inputTokens ?? 0,
      outputTokens: expected?.outputTokens ?? 0,
      totalTokens: expected?.totalTokens ?? 0,
    });
  });
  it.each(cases)("agent aggregation handles $label", ({ raw, expected }) => {
    seed(raw);
    expect(getAgentPerformance().find((row) => row.slug === "default"))
      .toMatchObject({ totalTokens: expected?.totalTokens ?? 0 });
  });

  // Negative counts are pinned at parsing/aggregate boundaries above. No new
  // negative-cost accounting policy is imposed on the spend layer here.
  it.each(cases.filter((entry) => entry.label !== "finite negatives"))(
    "spend window preserves finite observations for $label", ({ raw, expected }) => {
      seed(raw);
      const window = recordedSpendSince("2000-01-01 00:00:00");
      const source = window.sources.find((row) => row.source === "agent");
      const input = expected?.inputTokens ?? 0;
      const output = expected?.outputTokens ?? 0;
      expect(source).toMatchObject({ inputTokens: input, outputTokens: output });
      const expectedCost = input / 1_000_000 + output / 1_000_000 * 3;
      if (expectedCost > 0) {
        expect(window.totalUsd / expectedCost).toBeCloseTo(1, 12);
        expect(window.basis.estimatedUsd / expectedCost).toBeCloseTo(1, 12);
      } else {
        expect(window.totalUsd).toBe(0);
        expect(window.basis.estimatedUsd).toBe(0);
      }
    },
  );
  it("unknown model usage retains fallback provenance and its model name", () => {
    seed('{"inputTokens":1000000,"outputTokens":1000000,"totalTokens":0}');
    const window = recordedSpendSince("2000-01-01 00:00:00");
    expect(window.totalUsd).toBeCloseTo(4, 10);
    expect(window.basis).toMatchObject({ knownUsd: 0, estimatedUsd: 4, unknownModels: ["oracle-unknown-model"] });
  });
  it("unrecorded Deep Research remains distinct from measured zero usage", () => {
    testDb!.prepare("INSERT INTO research_runs (id, query, prompt_tokens, completion_tokens) VALUES ('unknown', 'fixture', NULL, NULL), ('zero', 'fixture', 0, 0)").run();
    const window = recordedSpendSince("2000-01-01 00:00:00");
    expect(window.unrecordedResearchRuns).toBe(1);
    expect(window.sources.find((row) => row.source === "research")).toMatchObject({ runs: 2, costUsd: 0 });
    expect(getSpendSummary().unmeasured.join(" ")).toMatch(/1.*Deep Research|Deep Research.*1/i);
  });
  it("an armed hard stop refuses when real SQLite cannot read spend", () => {
    writeSpendPolicy({ ...UNSET_SPEND_POLICY, limitUsd: 10, hardStop: true, period: "month" });
    testDb!.exec("DROP TABLE runs");
    expect(() => recordedSpendSince("2000-01-01 00:00:00")).toThrow();
    expect(checkUnattendedSpend()).toMatchObject({ allowed: false, reason: expect.stringMatching(/could not be measured|unable/i) });
  });
  it("overflowing derived token sum preserves finite component cost and the armed guard refusal", () => {
    seed('{"inputTokens":1e308,"outputTokens":1e308}');
    writeSpendPolicy({ ...UNSET_SPEND_POLICY, limitUsd: 10, hardStop: true, period: "month" });
    const window = recordedSpendSince("2000-01-01 00:00:00");
    expect(Number.isFinite(window.totalUsd)).toBe(true);
    expect(window.totalUsd / 4e302).toBeCloseTo(1, 12);
    expect(checkUnattendedSpend().allowed).toBe(false);
  });
});

// Amendment 2026-10-02, Planck 01a0fd1f-516a-7323-af9c-0682d6bbbe6c:
// Missing proposed parser throws infrastructure evidence, never a matcher assertion.
// Authorised by committed T-0189-oracle-amendment.md; original freeze retained.
