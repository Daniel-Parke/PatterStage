/**
 * @jest-environment node
 *
 * Source-pattern test for the session 214 dead-state removal in
 * src/hooks/useMissionsPage.ts + src/components/missions/MissionCreateForm.tsx.
 *
 * The pre-session source declared two `useState` slots that were
 * NEVER READ by any consumer:
 *
 *   - `scheduleType` (line 191) — useState<"interval" | "wall-clock"
 *     | "post-run">("interval"). Written 3 times: declaration,
 *     setFormField entry, and the 2 setScheduleType calls inside
 *     populateFormFromMission. Read 0 times in any consumer
 *     (grep \.scheduleType returns 0 hits in src/ or tests/).
 *
 *   - `scheduleStartTime` (line 192) — useState("00:00"). Written
 *     2 times: declaration and setFormField entry. Read 0 times.
 *     The state was initialized to "00:00" and never mutated
 *     to anything else.
 *
 * Both fields were exposed on the `formState` getter object
 * (which has type `MissionFormState` from MissionCreateForm.tsx)
 * and on the interface itself (lines 36-37 of MissionCreateForm.tsx),
 * but no consumer ever destructured `formState.scheduleType` or
 * `formState.scheduleStartTime`. The SchedulePicker uses only
 * `value` + `onChange` strings, not the type.
 *
 * The two dead setters on the hook's return object
 * (`setShowCategoryManager` and `setShowTemplateManager`) are also
 * removed in the same refactor — neither is destructured by the
 * page (the page uses the `openCategoryManager` / `closeCategoryManager`
 * / `openTemplateManager` / `closeTemplateManager` named callbacks
 * instead). The setter's only internal use is inside the hook
 * itself (the corresponding `openX` callbacks call them).
 *
 * After the refactor:
 *   - `useMissionsPage.ts` no longer declares the 2 useState slots
 *   - `formState` no longer exposes them
 *   - `setFormField` no longer has entries for them
 *   - `populateFormFromMission` no longer calls `setScheduleType`
 *   - `MissionFormState` no longer declares the fields
 *   - The hook's return object no longer exposes
 *     `setShowCategoryManager` or `setShowTemplateManager`
 *   - The 2 test mock `baseFormState` objects lose the 2 fields
 *
 * Why source-pattern instead of rendering the hook:
 *   - `useMissionsPage` is a 1500-line hook that consumes 7+ other
 *     hooks. Rendering it requires mocking all of those — overkill
 *     for a deletion. The byte-level contract is: the names
 *     `scheduleType` and `scheduleStartTime` are GONE from the
 *     hook's source, and the names `setShowCategoryManager` and
 *     `setShowTemplateManager` are GONE from the hook's return
 *     object.
 *
 * What this test does NOT lock:
 *   - The exact useState count or ordering beyond the 2 removed ones.
 *   - The setFormField's other 19 entries (untouched).
 *   - The form-state interface's other 19 fields (untouched).
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "node:child_process";

const HOOK_PATH = path.resolve(
  __dirname,
  "../../src/hooks/useMissionsPage.ts",
);
const FORM_PATH = path.resolve(
  __dirname,
  "../../src/components/missions/MissionCreateForm.tsx",
);
const COMPOSER_TEST_PATH = path.resolve(
  __dirname,
  "./mission-composer-actions.test.tsx",
);
const GATE_TEST_PATH = path.resolve(
  __dirname,
  "./mission-dispatch-gate.test.tsx",
);

describe("dead-state removal in useMissionsPage (session 214)", () => {
  const hookSource = fs.readFileSync(HOOK_PATH, "utf8");
  const formSource = fs.readFileSync(FORM_PATH, "utf8");
  const composerTestSource = fs.readFileSync(COMPOSER_TEST_PATH, "utf8");
  const gateTestSource = fs.readFileSync(GATE_TEST_PATH, "utf8");

  // ── Hook: scheduleType + scheduleStartTime state slots are gone ────

  describe("useMissionsPage.ts — scheduleType", () => {
    it("does not declare scheduleType as a useState slot", () => {
      // The pre-session source had:
      //   const [scheduleType, setScheduleType] = useState<...>("interval");
      // After removal, no `useState<...>` declaration references
      // `scheduleType` as the value name.
      const useStateSlots = hookSource.match(
        /const \[\s*(\w+)\s*,\s*(\w+)\s*\]\s*=\s*useState/g,
      );
      expect(useStateSlots).not.toBeNull();
      const declaredValueNames = useStateSlots!.map((m) => m.match(/^\s*const \[\s*(\w+)/)![1]);
      expect(declaredValueNames).not.toContain("scheduleType");
    });

    it("does not expose scheduleType in the formState getter", () => {
      // The pre-session formState object literal had
      //   scheduleType,
      //   scheduleStartTime,
      // as standalone shorthand-property entries. After removal,
      // neither is in the formState object.
      const formStateMatch = hookSource.match(
        /const formState:\s*MissionFormState\s*=\s*\{([\s\S]*?)\n\s*\};/,
      );
      expect(formStateMatch).not.toBeNull();
      const formStateBody = formStateMatch![1];
      // Match a shorthand property by itself on a line:
      //   "  scheduleType,"
      // but not inside a key:value pair (the scheduleType is only
      // ever a shorthand here — there's no `scheduleType: ...` form).
      expect(formStateBody).not.toMatch(/^\s*scheduleType\s*,?\s*$/m);
    });

    it("does not have a setFormField entry for scheduleType", () => {
      // The pre-session setFormField map had:
      //   scheduleType: (v) => setScheduleType(v),
      // After removal, no `scheduleType: (v) =>` entry exists in
      // the setFormField setters map.
      const settersMapMatch = hookSource.match(
        /const setters:\s*\{[\s\S]*?\}\s*=\s*\{([\s\S]*?)\n\s*\};/,
      );
      expect(settersMapMatch).not.toBeNull();
      expect(settersMapMatch![1]).not.toMatch(/scheduleType\s*:/);
    });

    it("does not call setScheduleType in populateFormFromMission", () => {
      // The pre-session source had 2 setScheduleType calls inside
      // populateFormFromMission (one in the `m.schedule` branch and
      // one in the `else` branch). After removal, neither call
      // exists in the hook.
      expect(hookSource).not.toMatch(/setScheduleType\s*\(/);
    });
  });

  describe("useMissionsPage.ts — scheduleStartTime", () => {
    it("does not declare scheduleStartTime as a useState slot", () => {
      const useStateSlots = hookSource.match(
        /const \[\s*(\w+)\s*,\s*(\w+)\s*\]\s*=\s*useState/g,
      );
      expect(useStateSlots).not.toBeNull();
      const declaredValueNames = useStateSlots!.map((m) => m.match(/^\s*const \[\s*(\w+)/)![1]);
      expect(declaredValueNames).not.toContain("scheduleStartTime");
    });

    it("does not expose scheduleStartTime in the formState getter", () => {
      const formStateMatch = hookSource.match(
        /const formState:\s*MissionFormState\s*=\s*\{([\s\S]*?)\n\s*\};/,
      );
      expect(formStateMatch).not.toBeNull();
      const formStateBody = formStateMatch![1];
      expect(formStateBody).not.toMatch(/^\s*scheduleStartTime\s*,?\s*$/m);
    });

    it("does not have a setFormField entry for scheduleStartTime", () => {
      const settersMapMatch = hookSource.match(
        /const setters:\s*\{[\s\S]*?\}\s*=\s*\{([\s\S]*?)\n\s*\};/,
      );
      expect(settersMapMatch).not.toBeNull();
      expect(settersMapMatch![1]).not.toMatch(/scheduleStartTime\s*:/);
    });
  });

  // ── Hook return: setShowCategoryManager + setShowTemplateManager
  //    are no longer exposed ────────────────────────────────────────

  describe("useMissionsPage.ts — unused setter returns", () => {
    it("does not expose setShowCategoryManager on the return object", () => {
      // The pre-session return object had:
      //   setShowCategoryManager,
      // After removal, the hook's return object no longer has it.
      // The hook's return object is the trailing `return { ... }`
      // statement at the bottom of the hook (after the last
      // `useCallback` declaration). Match the closing `};` of the
      // hook body.
      const returnMatch = hookSource.match(
        /return\s*\{([\s\S]*?)\n\s*\};\s*\n\s*\}/,
      );
      expect(returnMatch).not.toBeNull();
      const returnBody = returnMatch![1];
      expect(returnBody).not.toMatch(/^\s*setShowCategoryManager\s*,?\s*$/m);
    });

    it("does not expose setShowTemplateManager on the return object", () => {
      const returnMatch = hookSource.match(
        /return\s*\{([\s\S]*?)\n\s*\};\s*\n\s*\}/,
      );
      expect(returnMatch).not.toBeNull();
      const returnBody = returnMatch![1];
      expect(returnBody).not.toMatch(/^\s*setShowTemplateManager\s*,?\s*$/m);
    });

    it("still uses setShowCategoryManager inside openCategoryManager callback", () => {
      // Anti-migration guard: the setter is still USED internally
      // (by the `openCategoryManager` callback that does
      // `setShowCategoryManager(true)`). The removal only affects
      // the return-object exposure, not the internal usage.
      expect(hookSource).toMatch(/setShowCategoryManager\s*\(\s*true\s*\)/);
    });

    it("still uses setShowTemplateManager inside openTemplateManager callback", () => {
      // Anti-migration guard: same as above for templateManager.
      expect(hookSource).toMatch(/setShowTemplateManager\s*\(\s*true\s*\)/);
    });
  });

  // ── Form state interface: 2 fields removed ────────────────────────

  describe("MissionCreateForm.tsx — MissionFormState interface", () => {
    it("does not declare scheduleType in MissionFormState", () => {
      const interfaceMatch = formSource.match(
        /export interface MissionFormState\s*\{([\s\S]*?)\n\s*\}/,
      );
      expect(interfaceMatch).not.toBeNull();
      expect(interfaceMatch![1]).not.toMatch(/^\s*scheduleType\s*:/m);
    });

    it("does not declare scheduleStartTime in MissionFormState", () => {
      const interfaceMatch = formSource.match(
        /export interface MissionFormState\s*\{([\s\S]*?)\n\s*\}/,
      );
      expect(interfaceMatch).not.toBeNull();
      expect(interfaceMatch![1]).not.toMatch(/^\s*scheduleStartTime\s*:/m);
    });
  });

  // ── Test mocks: 2 fields removed from base formState objects ──────

  describe("Test mocks — mission-composer-actions + mission-dispatch-gate", () => {
    it("mission-composer-actions.test.tsx does not include scheduleType", () => {
      expect(composerTestSource).not.toMatch(/^\s*scheduleType\s*:/m);
    });

    it("mission-composer-actions.test.tsx does not include scheduleStartTime", () => {
      expect(composerTestSource).not.toMatch(/^\s*scheduleStartTime\s*:/m);
    });

    it("mission-dispatch-gate.test.tsx does not include scheduleType", () => {
      expect(gateTestSource).not.toMatch(/^\s*scheduleType\s*:/m);
    });

    it("mission-dispatch-gate.test.tsx does not include scheduleStartTime", () => {
      expect(gateTestSource).not.toMatch(/^\s*scheduleStartTime\s*:/m);
    });
  });

  // ── Other public API surface (anti-regression) ────────────────────

  describe("Other API surface (anti-regression)", () => {
    it("scheduleType and scheduleStartTime are completely absent from src/", () => {
      // Source-wide grep: the names should be gone from production
      // source. (Tests no longer reference them either, so the
      // test-side check would also be 0, but the production-side
      // check is the load-bearing one.)
      const grepResult = execSync(
        "grep -rnE 'scheduleType|scheduleStartTime' " +
          path.resolve(__dirname, "../../src/") +
          " 2>/dev/null || true",
      )
        .toString()
        .trim();
      expect(grepResult).toBe("");
    });

    it("showTemplateManager + showCategoryManager state slots are still present", () => {
      // Anti-migration guard: the corresponding STATE values
      // (showCategoryManager, showTemplateManager) are still
      // declared — only the setters were removed from the return.
      // The state is consumed via the showCategoryManager /
      // showTemplateManager getters in the return.
      const useStateSlots = hookSource.match(
        /const \[\s*(\w+)\s*,\s*(\w+)\s*\]\s*=\s*useState/g,
      );
      const declaredValueNames = useStateSlots!.map((m) => m.match(/^\s*const \[\s*(\w+)/)![1]);
      expect(declaredValueNames).toContain("showCategoryManager");
      expect(declaredValueNames).toContain("showTemplateManager");
    });
  });
});
