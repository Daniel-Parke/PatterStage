/** @jest-environment node */

/**
 * Source-pattern test for the session 118 List-1 callback promotions
 * across 3 files:
 *
 *   1. `src/app/(main)/logs/page.tsx` (logs page)
 *      - `openSearchInput` (1-setter useCallback: setSearchVisible(true))
 *      - `closeSearchInput` (2-setter useCallback: setSearch("") +
 *        setSearchVisible(false))
 *      - `jumpToLatestLines` (2-step useCallback: setAutoScroll(true) +
 *        scroll terminal to top)
 *      - `dismissActionMessage` (1-setter useCallback: setActionMessage(null))
 *
 *   2. `src/components/memory/HindsightBrowser.tsx` (memory browser)
 *      - `openAddModal` / `closeAddModal` (AddMemory modal)
 *      - `openDirectiveModal` / `closeDirectiveModal` (Directive modal;
 *        close also resets `dirForm` to `EMPTY_DIR_FORM`)
 *      - `openModelModal` / `closeModelModal` (MentalModel modal;
 *        close also resets `modelForm` to `EMPTY_MODEL_FORM`)
 *
 *   3. `src/app/(main)/sessions/[id]/page.tsx` (session detail)
 *      - `clearRoleFilter` (1-setter useCallback: setRoleFilter(null))
 *      - `handleRoleBadgeClick` (1-parameter useCallback: toggle)
 *
 * All promotions follow the open/close sibling pattern from
 * session 116 P-7 (open/close naming) + session 118 P-7 (named
 * `useCallback` siblings with the stable setters listed in deps).
 *
 * This test is intentionally source-pattern based (rather than rendering
 * the components) for two reasons:
 *
 *  1. The byte-equivalence claim is about the *shape* of the helpers
 *     (which setters they call, with which values), not about React's
 *     `useCallback` behaviour. Source-pattern tests lock the shape
 *     invariant without coupling to React internals.
 *  2. Importing the components would require a full Next.js render
 *     harness (AppPageShell + sidebar providers + API mocks), which
 *     is overkill for 8 named useCallback helpers.
 *
 * If a future session removes any of the 8 helpers or re-introduces
 * the inline `() => setX(true)` / `() => setX(false)` form, the
 * corresponding `it()` block fails.
 */
import { readFileSync } from "fs";
import { join } from "path";

const REPO_ROOT = join(__dirname, "..", "..");
const logsPagePath = join(REPO_ROOT, "src", "app", "(main)", "logs", "page.tsx");
const hindsightPath = join(REPO_ROOT, "src", "components", "memory", "HindsightBrowser.tsx");
const sessionDetailPath = join(REPO_ROOT, "src", "app", "(main)", "sessions", "[id]", "page.tsx");

describe("List 1 callback promotions (session 118)", () => {
  const logsSource = readFileSync(logsPagePath, "utf-8");
  const hindsightSource = readFileSync(hindsightPath, "utf-8");
  const sessionDetailSource = readFileSync(sessionDetailPath, "utf-8");

  // ── Logs page ─────────────────────────────────────────────

  describe("logs/page.tsx (search input + jump-to-latest + action-message dismiss)", () => {
    it("declares openSearchInput as a useCallback that calls setSearchVisible(true)", () => {
      expect(logsSource).toMatch(
        /const\s+openSearchInput\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*setSearchVisible\(true\)\s*,\s*\[[^\]]*\]\s*,?\s*\)/s,
      );
    });

    it("declares closeSearchInput as a 2-setter useCallback (setSearch + setSearchVisible)", () => {
      // 2-setter close: setSearch("") + setSearchVisible(false)
      const match = logsSource.match(
        /const\s+closeSearchInput\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*\[[^\]]*\]\s*,?\s*\)/,
      );
      expect(match).not.toBeNull();
      const body = match![1];
      expect(body).toMatch(/setSearch\(\s*""\s*\)/);
      expect(body).toMatch(/setSearchVisible\(\s*false\s*\)/);
    });

    it("replaces the inline () => { setSearch(\"\"); setSearchVisible(false); } arrow on the X button", () => {
      // The X button on the visible search input used to have the
      // 2-setter inline arrow. Session 118 promoted it to
      // closeSearchInput.
      expect(logsSource).not.toMatch(
        /onClick=\{\(\)\s*=>\s*\{\s*setSearch\(\s*""\s*\)\s*;\s*setSearchVisible\(false\)\s*;\s*\}\s*\}/s,
      );
    });

    it("replaces the inline () => setSearchVisible(true) arrow on the Filter lines pill", () => {
      expect(logsSource).not.toMatch(
        /onClick=\{\(\)\s*=>\s*setSearchVisible\(true\)\s*\}/,
      );
    });

    it("threads closeSearchInput to the X button and openSearchInput to the Filter lines pill", () => {
      expect(logsSource).toMatch(/onClick=\{closeSearchInput\}/);
      expect(logsSource).toMatch(/onClick=\{openSearchInput\}/);
    });

    it("declares jumpToLatestLines as a 2-step useCallback (setAutoScroll(true) + scroll to top)", () => {
      const match = logsSource.match(
        /const\s+jumpToLatestLines\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*\[[^\]]*\]\s*,?\s*\)/,
      );
      expect(match).not.toBeNull();
      const body = match![1];
      expect(body).toMatch(/setAutoScroll\(\s*true\s*\)/);
      expect(body).toMatch(/terminalRef\.current\.scrollTop\s*=\s*0/);
    });

    it("replaces the inline () => { setAutoScroll(true); ... scrollTop = 0; } arrow on the Latest lines button", () => {
      expect(logsSource).not.toMatch(
        /onClick=\{\(\)\s*=>\s*\{\s*setAutoScroll\(\s*true\s*\)\s*;[\s\S]*?scrollTop\s*=\s*0\s*;?\s*\}\s*\}/s,
      );
    });

    it("threads jumpToLatestLines to the Latest lines button", () => {
      expect(logsSource).toMatch(/onClick=\{jumpToLatestLines\}/);
    });

    it("declares dismissActionMessage as a 1-setter useCallback", () => {
      expect(logsSource).toMatch(
        /const\s+dismissActionMessage\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*setActionMessage\(\s*null\s*\)\s*,\s*\[[^\]]*\]\s*,?\s*\)/s,
      );
    });

    it("replaces the inline () => setActionMessage(null) arrow on the action-message X button", () => {
      expect(logsSource).not.toMatch(
        /onClick=\{\(\)\s*=>\s*setActionMessage\(\s*null\s*\)\s*\}/,
      );
    });

    it("threads dismissActionMessage to the action-message X button", () => {
      expect(logsSource).toMatch(/onClick=\{dismissActionMessage\}/);
    });
  });

  // ── HindsightBrowser ───────────────────────────────────────

  describe("HindsightBrowser.tsx (AddMemory / Directive / MentalModel modal callbacks)", () => {
    it("declares openAddModal / closeAddModal as a 1-setter useCallback pair (setShowAddModal)", () => {
      expect(hindsightSource).toMatch(
        /const\s+openAddModal\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*setShowAddModal\(\s*true\s*\)\s*,\s*\[[^\]]*\]\s*,?\s*\)/s,
      );
      expect(hindsightSource).toMatch(
        /const\s+closeAddModal\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*setShowAddModal\(\s*false\s*\)\s*,\s*\[[^\]]*\]\s*,?\s*\)/s,
      );
    });

    it("declares openDirectiveModal as a 1-setter useCallback and closeDirectiveModal as a 2-setter (resets dirForm)", () => {
      expect(hindsightSource).toMatch(
        /const\s+openDirectiveModal\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*setShowDirectiveModal\(\s*true\s*\)\s*,\s*\[[^\]]*\]\s*,?\s*\)/s,
      );
      const closeMatch = hindsightSource.match(
        /const\s+closeDirectiveModal\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*\[[^\]]*\]\s*,?\s*\)/,
      );
      expect(closeMatch).not.toBeNull();
      const body = closeMatch![1];
      expect(body).toMatch(/setShowDirectiveModal\(\s*false\s*\)/);
      expect(body).toMatch(/setDirForm\(\s*EMPTY_DIR_FORM\s*\)/);
    });

    it("declares openModelModal as a 1-setter useCallback and closeModelModal as a 2-setter (resets modelForm)", () => {
      expect(hindsightSource).toMatch(
        /const\s+openModelModal\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*setShowModelModal\(\s*true\s*\)\s*,\s*\[[^\]]*\]\s*,?\s*\)/s,
      );
      const closeMatch = hindsightSource.match(
        /const\s+closeModelModal\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*\[[^\]]*\]\s*,?\s*\)/,
      );
      expect(closeMatch).not.toBeNull();
      const body = closeMatch![1];
      expect(body).toMatch(/setShowModelModal\(\s*false\s*\)/);
      expect(body).toMatch(/setModelForm\(\s*EMPTY_MODEL_FORM\s*\)/);
    });

    it("replaces the inline () => setShowAddModal(true) arrow on the Add Memory button", () => {
      expect(hindsightSource).not.toMatch(
        /onClick=\{\(\)\s*=>\s*setShowAddModal\(\s*true\s*\)\s*\}/,
      );
    });

    it("replaces the inline () => setShowDirectiveModal(true) on the DirectivesTab onCreateClick", () => {
      expect(hindsightSource).not.toMatch(
        /onCreateClick=\{\(\)\s*=>\s*setShowDirectiveModal\(\s*true\s*\)\s*\}/,
      );
    });

    it("replaces the inline () => setShowModelModal(true) on the MentalModelsTab onCreateClick", () => {
      expect(hindsightSource).not.toMatch(
        /onCreateClick=\{\(\)\s*=>\s*setShowModelModal\(\s*true\s*\)\s*\}/,
      );
    });

    it("replaces the inline 2-setter () => { setShowDirectiveModal(false); setDirForm(EMPTY_DIR_FORM); } onClose", () => {
      expect(hindsightSource).not.toMatch(
        /onClose=\{\(\)\s*=>\s*\{\s*setShowDirectiveModal\(\s*false\s*\)\s*;\s*setDirForm\(\s*EMPTY_DIR_FORM\s*\)\s*;?\s*\}\s*\}/s,
      );
    });

    it("replaces the inline 2-setter () => { setShowModelModal(false); setModelForm(EMPTY_MODEL_FORM); } onClose", () => {
      expect(hindsightSource).not.toMatch(
        /onClose=\{\(\)\s*=>\s*\{\s*setShowModelModal\(\s*false\s*\)\s*;\s*setModelForm\(\s*EMPTY_MODEL_FORM\s*\)\s*;?\s*\}\s*\}/s,
      );
    });

    it("replaces the inline () => setShowAddModal(false) on the AddMemoryModal onClose", () => {
      expect(hindsightSource).not.toMatch(
        /onClose=\{\(\)\s*=>\s*setShowAddModal\(\s*false\s*\)\s*\}/,
      );
    });

    it("replaces the inline () => setEditingDirective(null) on the edit DirectiveModal onClose", () => {
      expect(hindsightSource).not.toMatch(
        /onClose=\{\(\)\s*=>\s*setEditingDirective\(\s*null\s*\)\s*\}/,
      );
    });

    it("replaces the inline () => setEditingModel(null) on the edit MentalModelModal onClose", () => {
      expect(hindsightSource).not.toMatch(
        /onClose=\{\(\)\s*=>\s*setEditingModel\(\s*null\s*\)\s*\}/,
      );
    });

    it("declares closeEditDirective / closeEditModel as 1-setter useCallback siblings", () => {
      // The 2 edit-modals' close callbacks are 1-setter useCallbacks
      // (set to null) — they don't reset a form because the form is
      // overwritten by the next openEdit call. The pattern matches
      // the 1-setter open callbacks (openAddModal etc.) — deps array
      // lists the stable setter.
      expect(hindsightSource).toMatch(
        /const\s+closeEditDirective\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*setEditingDirective\(\s*null\s*\)\s*,\s*\[[^\]]*\]\s*,?\s*\)/s,
      );
      expect(hindsightSource).toMatch(
        /const\s+closeEditModel\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*setEditingModel\(\s*null\s*\)\s*,\s*\[[^\]]*\]\s*,?\s*\)/s,
      );
    });

    it("threads openAddModal to the Add Memory button and closeAddModal to the AddMemoryModal", () => {
      expect(hindsightSource).toMatch(/onClick=\{openAddModal\}/);
      expect(hindsightSource).toMatch(/onClose=\{closeAddModal\}/);
    });

    it("threads openDirectiveModal / closeDirectiveModal to the DirectivesTab + DirectiveModal", () => {
      expect(hindsightSource).toMatch(/onCreateClick=\{openDirectiveModal\}/);
      expect(hindsightSource).toMatch(/onClose=\{closeDirectiveModal\}/);
    });

    it("threads openModelModal / closeModelModal to the MentalModelsTab + MentalModelModal", () => {
      expect(hindsightSource).toMatch(/onCreateClick=\{openModelModal\}/);
      expect(hindsightSource).toMatch(/onClose=\{closeModelModal\}/);
    });
  });

  // ── Sessions detail ───────────────────────────────────────

  describe("sessions/[id]/page.tsx (role filter clear + badge click handler)", () => {
    it("declares clearRoleFilter as a 1-setter useCallback (setRoleFilter(null))", () => {
      expect(sessionDetailSource).toMatch(
        /const\s+clearRoleFilter\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*setRoleFilter\(\s*null\s*\)\s*,\s*\[[^\]]*\]\s*,?\s*\)/s,
      );
    });

    it("declares handleRoleBadgeClick as a 1-parameter useCallback that toggles setRoleFilter", () => {
      // Reads the current value via `setRoleFilter((prev) => ...)` so
      // the toggle is the canonical functional-setter form. The
      // closure-over-`role` is the 1-parameter that distinguishes it
      // from a plain `setRoleFilter(null)` callback. The body is
      // multi-line (the `(role: string) =>` body is on its own line)
      // — matched via the `s` flag.
      const match = sessionDetailSource.match(
        /const\s+handleRoleBadgeClick\s*=\s*useCallback\(\s*\(role[^)]*\)\s*=>\s*setRoleFilter\(\s*\(prev\)\s*=>\s*\(prev\s*===\s*role\s*\?\s*null\s*:\s*role\)\s*\)\s*,\s*\[[^\]]*\]\s*,?\s*\)/s,
      );
      expect(match).not.toBeNull();
    });

    it("replaces the inline () => setRoleFilter(null) arrow on the clear pill", () => {
      expect(sessionDetailSource).not.toMatch(
        /onClick=\{\(\)\s*=>\s*setRoleFilter\(\s*null\s*\)\s*\}/,
      );
    });

    it("replaces the inline () => setRoleFilter(isActive ? null : role) arrow on the role badge", () => {
      expect(sessionDetailSource).not.toMatch(
        /onClick=\{\(\)\s*=>\s*setRoleFilter\(\s*isActive\s*\?\s*null\s*:\s*role\s*\)\s*\}/,
      );
    });

    it("threads clearRoleFilter to the clear pill and handleRoleBadgeClick to the role badges", () => {
      expect(sessionDetailSource).toMatch(/onClick=\{clearRoleFilter\}/);
      // The badge is inside a .map() so the call site is `() =>
      // handleRoleBadgeClick(role)`. The point is the inline arrow is
      // gone, replaced by a 1-arg arrow that delegates.
      expect(sessionDetailSource).toMatch(
        /onClick=\{\(\)\s*=>\s*handleRoleBadgeClick\(role\)\s*\}/,
      );
    });
  });
});
