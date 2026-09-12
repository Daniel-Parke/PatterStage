/**
 * Tests for buildDriftDetails — pure function that projects a
 * DriftReport (lib shape) into the flat `string[]` consumed by the
 * ModelsDriftBanner component (UI shape).
 *
 * These tests pin the byte-equivalent contract used by the
 * /api/models/sync/drift route handler. The route used to spell this
 * transformation out inline (3 separate if/for blocks); the helper
 * preserves the exact string format, the exact ordering (primary first,
 * then Hermes-only, then DB-only), and the exact empty-return shape.
 *
 * The helper is pure — no DB, no filesystem, no globals — so the test
 * mocks nothing and exercises the full input space:
 *   1. Empty drift report → empty string[]
 *   2. Primary only (no list diffs) → 1 string in the primary slot
 *   3. Hermes-only models → N strings in the Hermes-only slot
 *   4. DB-only models → N strings in the DB-only slot
 *   5. All three populated → all 3 sections in the canonical order
 *   6. Multiple entries in a list section → all entries appended in
 *      the order they appear in the input array
 *   7. Exact string format (pinned byte-for-byte)
 */

import { buildDriftDetails } from "@/modules/hermes/lib/sync-manager";
import type { DriftReport } from "@/modules/hermes/lib/sync-manager";

const emptyDrift: DriftReport = {
  modelsInHermesNotInDb: [],
  modelsInDbNotInHermes: [],
  primaryDiffers: null,
};

describe("buildDriftDetails", () => {
  it("returns an empty array for an empty drift report", () => {
    expect(buildDriftDetails(emptyDrift)).toEqual([]);
  });

  it("returns a single primary-drift line when only primaryDiffers is set", () => {
    const drift: DriftReport = {
      ...emptyDrift,
      primaryDiffers: { dbModel: "openai/gpt-4o", hermesModel: "openai/gpt-4o-mini" },
    };
    expect(buildDriftDetails(drift)).toEqual([
      'Primary model drift: DB has "openai/gpt-4o", Hermes has "openai/gpt-4o-mini"',
    ]);
  });

  it("returns Hermes-only lines for modelsInHermesNotInDb", () => {
    const drift: DriftReport = {
      ...emptyDrift,
      modelsInHermesNotInDb: [
        { name: "claude-3-5-sonnet", provider: "anthropic", modelId: "claude-3-5-sonnet" },
      ],
    };
    expect(buildDriftDetails(drift)).toEqual([
      'Model "claude-3-5-sonnet" (anthropic) is in Hermes but not in PatterStage',
    ]);
  });

  it("returns DB-only lines for modelsInDbNotInHermes", () => {
    const drift: DriftReport = {
      ...emptyDrift,
      modelsInDbNotInHermes: [
        { name: "gpt-4o", provider: "openai", modelId: "gpt-4o" },
      ],
    };
    expect(buildDriftDetails(drift)).toEqual([
      'Model "gpt-4o" (openai) is in PatterStage but not pushed to Hermes',
    ]);
  });

  it("returns primary first, then Hermes-only, then DB-only (canonical order)", () => {
    const drift: DriftReport = {
      primaryDiffers: { dbModel: "openai/gpt-4o", hermesModel: "openai/gpt-4o-mini" },
      modelsInHermesNotInDb: [
        { name: "claude-3-5-sonnet", provider: "anthropic", modelId: "claude-3-5-sonnet" },
      ],
      modelsInDbNotInHermes: [
        { name: "gpt-4o", provider: "openai", modelId: "gpt-4o" },
      ],
    };
    expect(buildDriftDetails(drift)).toEqual([
      'Primary model drift: DB has "openai/gpt-4o", Hermes has "openai/gpt-4o-mini"',
      'Model "claude-3-5-sonnet" (anthropic) is in Hermes but not in PatterStage',
      'Model "gpt-4o" (openai) is in PatterStage but not pushed to Hermes',
    ]);
  });

  it("appends multiple Hermes-only entries in input order", () => {
    const drift: DriftReport = {
      ...emptyDrift,
      modelsInHermesNotInDb: [
        { name: "model-a", provider: "prov-a", modelId: "model-a" },
        { name: "model-b", provider: "prov-b", modelId: "model-b" },
        { name: "model-c", provider: "prov-c", modelId: "model-c" },
      ],
    };
    expect(buildDriftDetails(drift)).toEqual([
      'Model "model-a" (prov-a) is in Hermes but not in PatterStage',
      'Model "model-b" (prov-b) is in Hermes but not in PatterStage',
      'Model "model-c" (prov-c) is in Hermes but not in PatterStage',
    ]);
  });

  it("appends multiple DB-only entries in input order", () => {
    const drift: DriftReport = {
      ...emptyDrift,
      modelsInDbNotInHermes: [
        { name: "x", provider: "px", modelId: "x" },
        { name: "y", provider: "py", modelId: "y" },
      ],
    };
    expect(buildDriftDetails(drift)).toEqual([
      'Model "x" (px) is in PatterStage but not pushed to Hermes',
      'Model "y" (py) is in PatterStage but not pushed to Hermes',
    ]);
  });

  it("pins the exact byte-level string format (regression guard for UI consumers)", () => {
    // The ModelsDriftBanner component renders these strings as plain
    // text inside a <li>. A single-character drift (extra space, missing
    // quote, different colon) would not break the build but would
    // change the user-visible message. Pin the format explicitly.
    const drift: DriftReport = {
      ...emptyDrift,
      primaryDiffers: { dbModel: "a/b", hermesModel: "c/d" },
    };
    const [line] = buildDriftDetails(drift);
    // The exact format from the pre-refactor inline form in
    // src/app/api/models/sync/drift/route.ts:21-23.
    expect(line).toBe('Primary model drift: DB has "a/b", Hermes has "c/d"');
    // And the "Hermes-only" / "DB-only" forms from the original
    // route.ts:25-30.
    const drift2: DriftReport = {
      ...emptyDrift,
      modelsInHermesNotInDb: [
        { name: "h", provider: "ph", modelId: "h" },
      ],
      modelsInDbNotInHermes: [
        { name: "d", provider: "pd", modelId: "d" },
      ],
    };
    expect(buildDriftDetails(drift2)).toEqual([
      'Model "h" (ph) is in Hermes but not in PatterStage',
      'Model "d" (pd) is in PatterStage but not pushed to Hermes',
    ]);
  });
});
