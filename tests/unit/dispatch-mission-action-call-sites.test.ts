// ═══════════════════════════════════════════════════════════════
// Source-pattern test — `/api/missions` POST action call sites
// ═══════════════════════════════════════════════════════════════
//
// Why this test exists:
//   The `dispatchMissionAction(action, body)` helper in
//   `src/hooks/success-message-for-dispatch.ts` composes the
//   `safeApiCall<MissionActionResponse>("/api/missions", { method: "POST",
//   body: { action, ...body } })` shape for all 5 mission actions
//   (dispatch, update, promote, delete, cancel). It was originally
//   extracted to consolidate 4 action sites in
//   `useMissionsPage.handleCreate` (session 180) — but `handleDelete`
//   and `handleCancel` in the same hook, plus the dashboard's
//   `handleCancelMission` in `src/app/page.tsx`, were still using the
//   inline `safeApiCall(...)` form. Session 189 migrated all 3 to the
//   helper, fixing a real type-annotation bug along the way:
//   `page.tsx:212` was typed `safeApiCall<{ missions: MissionBrief[] }>`,
//   but the cancel action returns `{ mission, cancel: { ... } }` (NOT a
//   list of missions). The destructure only reads `ok`/`error`, so the
//   type mismatch was invisible at runtime — but a maintenance trap.
//
// This test pins the post-migration shape:
//   1. The `dispatchMissionAction` helper is imported in each surface
//      file (positive).
//   2. The inline `safeApiCall("/api/missions", { method: "POST",
//      body: { action: "cancel"|"delete", missionId } })` form is
//      GONE from `useMissionsPage.ts` and `page.tsx` (negative — the
//      helper now owns the call shape).
//   3. Each surface file has at least one `dispatchMissionAction(...)`
//      call for both `cancel` and `delete` actions (positive — the
//      migrated sites).
//   4. The wrong-type annotation `safeApiCall<{ missions: MissionBrief[] }>`
//      is gone from `page.tsx` (negative — the bug fix).

import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");

const USE_MISSIONS_PAGE = join(REPO_ROOT, "src", "hooks", "useMissionsPage.ts");
const DASHBOARD_PAGE = join(REPO_ROOT, "src", "app", "page.tsx");

// Strip block + line comments so the negative assertions don't false-
// positive on the "Migrated from the inline ..." explanatory notes
// inside the migrated sites. Same pre-filter pattern as the session
// 172 / 178 / 181 source-pattern tests.
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("dispatchMissionAction migration — inline /api/missions POST sites", () => {
  describe("useMissionsPage.ts", () => {
    const raw = readFileSync(USE_MISSIONS_PAGE, "utf-8");
    const code = stripComments(raw);

    it("imports dispatchMissionAction (positive)", () => {
      expect(code).toMatch(
        /import\s*\{[^}]*\bdispatchMissionAction\b[^}]*\}\s*from\s*["']@\/hooks\/success-message-for-dispatch["']/,
      );
    });

    it("does NOT contain an inline safeApiCall(\"/api/missions\", { method: \"POST\", body: { action: \"cancel\", ... } }) call (negative)", () => {
      // The pre-migration inline form. Both `useMissionsPage.handleCancel`
      // and `page.tsx.handleCancelMission` had this exact shape. The
      // helper now owns the call — a future regression that re-inlines
      // either site would fail this test.
      const matches = code.match(
        /safeApiCall\s*\(\s*["']\/api\/missions["']\s*,\s*\{[\s\S]*?body\s*:\s*\{\s*action\s*:\s*["']cancel["']/g,
      );
      expect(matches).toBeNull();
    });

    it("does NOT contain an inline safeApiCall(\"/api/missions\", { method: \"POST\", body: { action: \"delete\", ... } }) call (negative)", () => {
      // Same pattern as the cancel test, but for the `delete` action.
      // The only remaining `action: "delete"` site in useMissionsPage
      // (line 1035) targets `/api/templates`, not `/api/missions` —
      // the regex pins the exact `/api/missions` URL, so the templates
      // site doesn't false-positive.
      const matches = code.match(
        /safeApiCall\s*\(\s*["']\/api\/missions["']\s*,\s*\{[\s\S]*?body\s*:\s*\{\s*action\s*:\s*["']delete["']/g,
      );
      expect(matches).toBeNull();
    });

    it("calls dispatchMissionAction(\"cancel\", ...) at exactly 1 site (positive)", () => {
      // The migrated handleCancel site. A future 2nd cancel site
      // (e.g. an "abort all missions" button) should also use the
      // helper, so the count would naturally grow.
      const matches = code.match(/dispatchMissionAction\s*\(\s*["']cancel["']/g);
      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(1);
    });

    it("calls dispatchMissionAction(\"delete\", ...) at exactly 1 site (positive)", () => {
      // The migrated handleDelete site.
      const matches = code.match(/dispatchMissionAction\s*\(\s*["']delete["']/g);
      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(1);
    });
  });

  describe("page.tsx (dashboard)", () => {
    const raw = readFileSync(DASHBOARD_PAGE, "utf-8");
    const code = stripComments(raw);

    it("imports dispatchMissionAction (positive)", () => {
      expect(code).toMatch(
        /import\s*\{[^}]*\bdispatchMissionAction\b[^}]*\}\s*from\s*["']@\/hooks\/success-message-for-dispatch["']/,
      );
    });

    it("does NOT contain the wrong-type safeApiCall<{ missions: MissionBrief[] }>(\"/api/missions\", ...) annotation (negative)", () => {
      // The bug fix: the pre-migration type annotation claimed the
      // cancel action returns `{ missions: MissionBrief[] }`, but it
      // actually returns `{ mission, cancel: { accepted, processKillPending } }`.
      // The destructure only reads `ok`/`error` so the mismatch was
      // invisible at runtime. A future regression that re-types the
      // call to any `{ missions: ... }` annotation would fail this test.
      const matches = code.match(
        /safeApiCall\s*<\s*\{\s*missions\s*:\s*MissionBrief\s*\[\s*\]\s*\}\s*>\s*\(\s*["']\/api\/missions["']/g,
      );
      expect(matches).toBeNull();
    });

    it("does NOT contain an inline safeApiCall(\"/api/missions\", { method: \"POST\", body: { action: \"cancel\", ... } }) call (negative)", () => {
      // The pre-migration inline form. The handleCancelMission
      // migration collapsed this to `dispatchMissionAction("cancel", { missionId })`.
      const matches = code.match(
        /safeApiCall\s*\(\s*["']\/api\/missions["']\s*,\s*\{[\s\S]*?body\s*:\s*\{\s*action\s*:\s*["']cancel["']/g,
      );
      expect(matches).toBeNull();
    });

    it("calls dispatchMissionAction(\"cancel\", ...) at exactly 1 site (positive)", () => {
      // The migrated handleCancelMission site.
      const matches = code.match(/dispatchMissionAction\s*\(\s*["']cancel["']/g);
      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(1);
    });
  });

  describe("success-message-for-dispatch.ts helper", () => {
    const HELPER = join(REPO_ROOT, "src", "hooks", "success-message-for-dispatch.ts");
    const raw = readFileSync(HELPER, "utf-8");
    const code = stripComments(raw);

    it("declares the cancel action in the helper's action union (positive)", () => {
      // The pre-session-189 helper union was `"dispatch" | "update" | "promote" | "delete" | "cancel"`
      // — but the actual call sites for `delete` and `cancel` were
      // using the inline form. Session 189 migrated the call sites,
      // confirming the union members are actually used. The
      // positive regex pins the union inclusion so a future PR that
      // narrows the union to just the 3 currently-`dispatchMissionAction`-using
      // actions doesn't drop `delete` / `cancel` from the type (they
      // ARE used — by `useMissionsPage` and `page.tsx`).
      expect(code).toMatch(/["']dispatch["']\s*\|\s*["']update["']\s*\|\s*["']promote["']\s*\|\s*["']delete["']\s*\|\s*["']cancel["']/);
    });
  });
});
