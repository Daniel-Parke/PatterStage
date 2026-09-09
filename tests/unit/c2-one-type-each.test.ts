/**
 * C2 · One type each.
 *
 * Three shapes were spelled many times. The mission draft's ten optional
 * fields (references, skills, suggestedToolsets, goals, modelId, provider,
 * profileName, missionTimeMinutes, timeoutMinutes, schedule) in nine files,
 * each a different interface carrying the same list. The model's identity
 * (provider, modelId, baseUrl, contextLength) in seven, twice as an
 * `ApiModel` that two files each declared. A sync source's failure result
 * in seven sources, six lines each, identical. One type each now, extended
 * where an interface adds its own fields; one helper each for the sync
 * result, so a source says what happened in one line.
 *
 * The recon: org/reviews/2026-09-consolidation-recon.md §2. The census
 * measure `repeatedTypeShapeFiles` reads the spellings; this suite reads the
 * types and the helpers.
 */

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import type { Mission, MissionDraftFields } from "@/lib/missions/mission-types";
import type { ModelIdentity, ModelRow } from "@/lib/models/model-types";
import type { ModelRecord } from "@/lib/models-repository";
import { syncFailure, syncSuccess } from "@/lib/sync/types";

const ROOT = join(__dirname, "..", "..");
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}
const filesSpelling = (re: RegExp) => walk(join(ROOT, "src")).filter((f) => re.test(readFileSync(f, "utf8"))).map((f) => f.slice(ROOT.length + 1).replace(/\\/g, "/"));

describe("C2 · one type each", () => {
  it("the mission draft's fields are one type, and a Mission is one", () => {
    const draft: MissionDraftFields = {
      references: ["a"],
      skills: [],
      suggestedToolsets: ["fs"],
      goals: ["g"],
      modelId: "m",
      provider: "p",
      profileName: "bob",
      missionTimeMinutes: 10,
      timeoutMinutes: 20,
      schedule: "*/5 * * * *",
    };
    const mission: Mission = {
      id: "m1",
      name: "n",
      prompt: "p",
      status: "queued",
      createdAt: "2026-06-01T00:00:00Z",
      updatedAt: "2026-06-01T00:00:00Z",
      ...draft,
    };
    const again: MissionDraftFields = mission;
    expect(again.suggestedToolsets).toEqual(["fs"]);
    // Two lines: a template carries optional toolsets too, with required
    // goals under them; the draft is the one with optional goals.
    expect(filesSpelling(/suggestedToolsets\?: string\[\];\s*\n\s*goals\?: string\[\];/)).toEqual(["src/lib/missions/mission-types.ts"]);
  });

  it("the model's identity is one type, and a record is one", () => {
    const identity: ModelIdentity = { provider: "openai", modelId: "gpt", baseUrl: null, contextLength: 128_000 };
    const row: ModelRow = { id: "m", name: "GPT", credentialsId: null, ...identity };
    const record: ModelRecord = {
      ...row,
      apiStyle: null,
      origin: "manual",
      lastImportedName: null,
      lastImportedBaseUrl: null,
      createdAt: "2026-06-01T00:00:00Z",
      updatedAt: "2026-06-01T00:00:00Z",
    };
    const back: ModelIdentity = record;
    expect(back.contextLength).toBe(128_000);
    expect(filesSpelling(/contextLength: number \| null;/)).toEqual(["src/lib/models/model-types.ts"]);
  });

  it("a sync source says what happened in one line", () => {
    const start = performance.now() - 5;
    const failed = syncFailure("Env", new Error("boom"), start);
    expect(failed).toMatchObject({ sourceName: "Env", success: false, syncedCount: 0, error: "Error: boom" });
    expect(failed.durationMs).toBeGreaterThanOrEqual(0);
    const fine = syncSuccess("Env", 3, start);
    expect(fine).toMatchObject({ sourceName: "Env", success: true, syncedCount: 3 });
    expect(fine.error).toBeUndefined();
    expect(filesSpelling(/syncedCount: 0,\s*\n\s*error: String\(err\)/)).toEqual([]);
  });

  it("the census reads three files, one per shape", () => {
    const out = execFileSync(process.execPath, [join(ROOT, "scripts", "tooling", "line-census.mjs"), "--report"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    const report = JSON.parse(out) as { counts: { repeatedTypeShapeFiles: number } };
    expect(report.counts.repeatedTypeShapeFiles).toBeLessThanOrEqual(3);
  });
});
