// ═══════════════════════════════════════════════════════════════
// Source-pattern test — `dispatchMissionAction` inner-payload unwrap
// ═══════════════════════════════════════════════════════════════
//
// Why this test exists:
//   The `dispatchMissionAction(action, body)` helper in
//   `src/hooks/success-message-for-dispatch.ts` is the canonical
//   "POST to /api/missions with `{ action, ...body }` and return a
//   safe-typed result" wrapper for the 5 mission actions
//   (dispatch, update, promote, delete, cancel). The route returns
//   `{ data: { mission: { id: string, ... } } }` (envelope). The
//   helper unwraps the outer `data` envelope so the 2 read sites in
//   `useMissionsPage.handleCreate` can read `body?.mission?.id` (one
//   level) instead of `body?.data?.mission?.id` (two levels).
//
//   The pre-session form returned the FULL envelope shape — callers
//   had to walk 2 levels of `.data?.X` indirection. The post-session
//   form returns the inner-payload shape directly. The change is
//   byte-equivalent at the wire (same `safeApiCall` call, same wire
//   response), but a future "let me re-instate the envelope return
//   shape" regression would silently break the 2 read sites
//   (`body?.mission?.id` would be `undefined` because the inner
//   `mission` is at `body?.data?.mission`, not `body?.mission`).
//
// This test pins the post-migration shape:
//   1. The helper returns `Promise<SafeApiCallResult<MissionActionPayload>>`
//      (NOT `SafeApiCallResult<MissionActionResponse>`).
//   2. The 2 read sites in `useMissionsPage.handleCreate` read the
//      inner payload at 1 level (`body?.mission?.id`, not
//      `body?.data?.mission?.id`).
//   3. The `MissionActionPayload` interface is exported from the
//      helper file (the canonical type for the unwrapped shape).
//   4. The `MissionActionResponse` interface is GONE from the helper
//      file (the pre-unwrap type would be a regression marker).
//   5. The other 5 call sites (update, promote, delete, cancel,
//      dashboard) still call the helper and don't read the inner
//      payload — they pass through unchanged.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");

const HELPER = join(REPO_ROOT, "src", "hooks", "success-message-for-dispatch.ts");
const USE_MISSIONS_PAGE = join(REPO_ROOT, "src", "hooks", "useMissionsPage.ts");
const DASHBOARD_PAGE = join(REPO_ROOT, "src", "app", "page.tsx");

// Strip block + line comments so the assertions don't false-positive
// on the JSDoc + inline `// ...` explanatory notes that describe the
// pre- and post-unwrap forms. Same pre-filter pattern as the session
// 172 / 178 / 181 / 195 / 199 source-pattern tests.
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("dispatchMissionAction inner-payload unwrap — List 2 source pattern", () => {
  describe("success-message-for-dispatch.ts (helper)", () => {
    const raw = readFileSync(HELPER, "utf-8");
    const code = stripComments(raw);

    it("exports MissionActionPayload (the inner-payload type, positive)", () => {
      // The post-unwrap type alias. The pre-unwrap form was
      // `MissionActionResponse = { data?: { mission?: ... } }` —
      // the regression would re-introduce the outer envelope here.
      expect(code).toMatch(/export\s+interface\s+MissionActionPayload\b/);
    });

    it("does NOT export MissionActionResponse (the pre-unwrap envelope type, negative)", () => {
      // The pre-session form declared `MissionActionResponse = { data?:
      // { mission?: { id: string } & Record<string, unknown> } }`.
      // The post-session form renames it to `MissionActionPayload` (no
      // outer `data` envelope). A future "let me re-instate the
      // envelope return" regression would re-add this export, which
      // would be the signature of the unwrap being reverted.
      expect(code).not.toMatch(/export\s+interface\s+MissionActionResponse\b/);
    });

    it("declares the helper's return type as SafeApiCallResult<MissionActionPayload> (positive)", () => {
      // The post-unwrap form. The pre-unwrap form was
      // `Promise<SafeApiCallResult<MissionActionResponse>>` — the
      // `MissionActionResponse` type is now gone, and the helper
      // returns the inner-payload shape directly.
      expect(code).toMatch(
        /Promise<SafeApiCallResult<MissionActionPayload>>/,
      );
    });

    it("does NOT use the pre-unwrap SafeApiCallResult<MissionActionResponse> return (negative)", () => {
      // The pre-unwrap form. A regression that re-introduces the
      // envelope return shape would fail this test.
      expect(code).not.toMatch(
        /SafeApiCallResult<MissionActionResponse>/,
      );
    });

    it("unwraps the outer envelope inside the helper body (data?.data walk, positive)", () => {
      // The unwrap walk. The pre-unwrap form just returned the
      // `safeApiCall<...>(...)` result directly; the post-unwrap
      // form does `data: data?.data` to walk the outer envelope.
      // The `as SafeApiCallResult<MissionActionPayload>` cast on
      // the return is the same shape `safeApiCallData` uses
      // internally for the same walk.
      expect(code).toMatch(/data:\s*data\?\.data\b/);
    });
  });

  describe("useMissionsPage.ts (2 read sites)", () => {
    const raw = readFileSync(USE_MISSIONS_PAGE, "utf-8");
    const code = stripComments(raw);

    it("reads the inner payload at 1 level (body?.mission?.id) at exactly 2 sites (positive)", () => {
      // The 2 read sites in `handleCreate` (re-dispatch-completed
      // + dispatch-new branches) collapse from 2 levels to 1.
      // The pre-unwrap form had `body?.data?.mission?.id` (2
      // levels) at these 2 sites; the post-unwrap form has
      // `body?.mission?.id` (1 level).
      const matches = code.match(/body\?\.mission\?\.id\b/g);
      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(2);
    });

    it("does NOT read the inner payload at 2 levels (body?.data?.mission?.id) (negative)", () => {
      // The pre-unwrap form. The post-unwrap form collapses the
      // 2 read sites to 1 level. A regression that re-instates
      // the 2-level walk would fail this test.
      const matches = code.match(/body\?\.data\?\.mission\?\.id\b/g);
      expect(matches).toBeNull();
    });

    it("the 2 read sites use `body` (the destructure of result.data or of {data}), not `result.data?.data` directly (positive)", () => {
      // The 2 sites destructure the unwrapped payload into a `body`
      // local and then read `body?.mission?.id` (1 level). The
      // pre-unwrap form was `body?.data?.mission?.id` (where `body`
      // was the full envelope, not the inner payload). Site 1 uses
      // `const body = result.data` (direct property access) and
      // site 2 uses `const body = data` (destructured from
      // `const { ok, error, data } = await ...`). Both patterns
      // match `const body = (result\.data|data)\b` — the regex
      // pins the destructure + 1-level access pattern.
      const matches = code.match(/const\s+body\s*=\s*(?:result\.data|data)\b/g);
      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(2);
    });
  });

  describe("page.tsx (dashboard — call site that only reads ok/error)", () => {
    const raw = readFileSync(DASHBOARD_PAGE, "utf-8");
    const code = stripComments(raw);

    it("still calls dispatchMissionAction(\"cancel\", ...) at exactly 1 site (positive)", () => {
      // The dashboard's `handleCancelMission` is the 1 call site in
      // `page.tsx`. It only reads `ok`/`error` (doesn't read the
      // inner payload), so it's unaffected by the unwrap. This
      // test pins the call site to confirm the unwrap migration
      // didn't accidentally drop it.
      const matches = code.match(/dispatchMissionAction\s*\(\s*["']cancel["']/g);
      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(1);
    });
  });

  describe("byte-equivalence sanity", () => {
    it("the 2 read sites in useMissionsPage still read the same `mission.id` value (positive)", () => {
      // The unwrap is byte-equivalent at the read site:
      //   Pre: `body?.data?.mission?.id` where `body: MissionActionResponse | undefined`
      //   Post: `body?.mission?.id` where `body: MissionActionPayload | undefined`
      // Both produce `string | undefined` for the same wire response
      // (`{ data: { mission: { id: "abc" } } }` → `id: "abc"`). This
      // test pins the read-site shape (`.mission.id`) so a future
      // regression that drops the `.mission` access would fail.
      const raw = readFileSync(USE_MISSIONS_PAGE, "utf-8");
      const code = stripComments(raw);
      const matches = code.match(/body\.mission\.id\b/g);
      expect(matches).not.toBeNull();
      // 4 matches: 2 sites × 2 reads each (the `if` check + 2 setters).
      // Pre-unwrap form was `body.data.mission.id` (4 matches).
      expect(matches?.length).toBe(4);
    });
  });
});
