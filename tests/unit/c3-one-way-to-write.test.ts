/**
 * C3 · One way to write.
 *
 * A screen that wrote to the API said the same six things around the call
 * in four different helpers and by hand: mark busy, call, say what happened,
 * reload, say why on a throw, clear busy. `runSyncAction` said them for the
 * sync pages (T-0047), `runMutation` for the dashboard and the hindsight
 * hooks, `hindsightMutate` for the rest of hindsight, `runFallbackMutation`
 * for the fallback chain, and `toastFromResult` + try/catch/finally for the
 * mission and model hooks. One helper now, `runWrite` in lib/api-write.ts;
 * the others are gone, and every named writer is the call and its words.
 * react-query's `useMutation` stays for the hooks that own query keys and
 * invalidate them; that is the other sanctioned way, and the lint rule
 * says so.
 *
 * On the read side, the Story Weaver pages listed themes, characters and
 * stories in a hand-rolled effect around a POST read; they read through
 * useApiResource with a body, the way every other screen reads (T-0129).
 * The census's read measure walks the AST for a fetch reachable from a
 * useEffect callback, so a loader called from an effect is seen and a write
 * in a click handler is not.
 *
 * The recon: org/reviews/2026-09-consolidation-recon.md §3.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { RULES, violationsIn } from "../../scripts/tooling/design-lint.mjs";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

/** Fetch calls that carry a method, outside a runWrite( or useMutation( span. */
function rawWrites(src: string): number[] {
  const spanEnd = (from: number): number => {
    let depth = 0;
    for (let i = from; i < src.length; i++) {
      if (src[i] === "(") depth += 1;
      else if (src[i] === ")" && --depth === 0) return i;
    }
    return src.length;
  };
  const sanctioned: [number, number][] = [];
  for (const m of src.matchAll(/\b(?:runWrite|useMutation)\s*(?:<[^(]*>)?\(/g)) {
    const open = m.index + m[0].length - 1;
    sanctioned.push([open, spanEnd(open)]);
  }
  const hits: number[] = [];
  for (const m of src.matchAll(/\b(?:apiFetch|safeApiCall|safeApiCallData)\s*(?:<[^(]*>)?\(/g)) {
    const open = m.index + m[0].length - 1;
    const span = src.slice(open, spanEnd(open));
    if (!/\bmethod\s*:/.test(span)) continue;
    if (sanctioned.some(([a, b]) => open > a && open < b)) continue;
    hits.push(src.slice(0, open).split("\n").length);
  }
  return hits;
}

const WRITERS = [
  "src/hooks/useModelActions.ts",
  "src/hooks/useMissionDispatch.ts",
  "src/hooks/useMissionTemplateActions.ts",
  "src/hooks/useModelFallbackChain.ts",
  "src/hooks/useModelFallbackConfig.ts",
  "src/hooks/useMissionCategories.ts",
  "src/hooks/success-message-for-dispatch.ts",
  "src/app/page.tsx",
  "src/app/agent/profiles/page.tsx",
  "src/app/agent/skills/page.tsx",
  "src/app/agent/tools/page.tsx",
  "src/components/memory/hindsight/useHindsightDirectives.ts",
  "src/components/memory/hindsight/useHindsightMemories.ts",
  "src/components/memory/hindsight/useHindsightModels.ts",
];

describe("C3 · one way to write", () => {
  it("the four helpers are one, and the fifth idiom is gone with them", () => {
    expect(existsSync(join(ROOT, "src/lib/api-write.ts"))).toBe(true);
    for (const gone of [
      "src/lib/operation-sync-action.ts",
      "src/lib/run-mutation.ts",
      "src/lib/memory/hindsight-mutate.ts",
      "src/lib/dashboard/toast-from-result.ts",
    ]) {
      expect({ gone, exists: existsSync(join(ROOT, gone)) }).toEqual({ gone, exists: false });
    }
    expect(read("src/hooks/useModelFallbackChain.ts")).not.toMatch(/runFallbackMutation/);
  });

  it("every named writer writes through the helper and carries no write of its own", () => {
    for (const f of WRITERS) {
      const src = read(f);
      expect({ f, through: /\b(?:runWrite|dispatchMission)\(/.test(src) }).toEqual({ f, through: true });
      expect({ f, raw: rawWrites(src) }).toEqual({ f, raw: [] });
    }
  });

  it("a hook whose calls are all writes says nothing about a failure itself", () => {
    for (const f of [
      "src/hooks/useModelActions.ts",
      "src/hooks/useMissionDispatch.ts",
      "src/hooks/useMissionTemplateActions.ts",
      "src/hooks/useModelFallbackChain.ts",
      "src/hooks/useModelFallbackConfig.ts",
      "src/hooks/success-message-for-dispatch.ts",
      "src/app/page.tsx",
    ]) {
      const src = read(f);
      expect({ f, ownCatch: /toastError\(|toastFromResult\(/.test(src) }).toEqual({ f, ownCatch: false });
    }
  });

  it("the Story Weaver pages read through the hook", () => {
    const create = read("src/app/recroom/story-weaver/create/page.tsx");
    const library = read("src/app/recroom/story-weaver/page.tsx");
    expect(create).toMatch(/useApiResource</);
    expect(library).toMatch(/useApiResource</);
    // The list reads: no fetch call carries a `list` sub-action or action.
    expect(create).not.toMatch(/safeApiCall[^;]*subAction: "list"/s);
    expect(library).not.toMatch(/safeApiCall[^;]*action: "list"/s);
  });

  it("the census sees a loader called from an effect, not a write in a click handler", () => {
    const out = execFileSync(process.execPath, [join(ROOT, "scripts", "tooling", "line-census.mjs"), "--report"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    const report = JSON.parse(out) as { counts: { handRolledReadHooks: number; writeHooksWithoutMutation: number }; reads: { files: string[] } };
    expect(report.reads.files).toContain("src/app/agent/skills/page.tsx");
    expect(report.reads.files).not.toContain("src/app/work/composer/page.tsx");
    expect(report.reads.files).not.toContain("src/app/recroom/story-weaver/create/page.tsx");
    expect(report.reads.files).not.toContain("src/app/recroom/story-weaver/page.tsx");
    expect(report.counts.handRolledReadHooks).toBe(report.reads.files.length);
    expect(report.counts.writeHooksWithoutMutation).toBe(0);
  });

  it("design-lint refuses a write outside the helper, and knows the helper's own request and a useMutation", () => {
    const rule = RULES.find((r: { id: string }) => r.id === "no-raw-write-outside-the-helper");
    expect(rule).toBeDefined();
    const planted = violationsIn("src/components/Planted.tsx", [
      'import { apiFetch } from "@/lib/api-fetch";',
      "async function save() {",
      '  await apiFetch("/api/x", {',
      '    method: "PUT",',
      "    body: JSON.stringify({ a: 1 }),",
      "  });",
      "}",
    ]);
    expect([...planted.keys()]).toContain("no-raw-write-outside-the-helper::src/components/Planted.tsx");
    const quiet = violationsIn("src/components/Quiet.tsx", [
      "const res = await apiFetch(`/api/x/${id}`);",
      "await runWrite({",
      "  showToast,",
      '  request: () => Promise.all(ids.map((id) => apiFetch("/api/x", { method: "PUT", body: JSON.stringify({ id }) }))),',
      '  successMessage: "Saved",',
      '  errorMessage: "Save failed",',
      "});",
      "const write = useMutation({",
      '  mutationFn: (body: Body) => safeApiCall("/api/y", { method: "POST", body }),',
      "});",
    ]);
    expect([...quiet.keys()].filter((k) => k.startsWith("no-raw-write-outside-the-helper"))).toEqual([]);
    // A real site each way: the composer page still writes by hand (held by
    // the baseline), the model actions hook does not.
    const composer = violationsIn("src/app/work/composer/page.tsx", read("src/app/work/composer/page.tsx").split(/\r?\n/));
    expect([...composer.keys()]).toContain("no-raw-write-outside-the-helper::src/app/work/composer/page.tsx");
    const models = violationsIn("src/hooks/useModelActions.ts", read("src/hooks/useModelActions.ts").split(/\r?\n/));
    expect([...models.keys()].filter((k) => k.startsWith("no-raw-write-outside-the-helper"))).toEqual([]);
  });
});
