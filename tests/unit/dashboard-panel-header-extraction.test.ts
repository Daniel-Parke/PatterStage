/**
 * @jest-environment node
 *
 * Source-pattern test for the Panel / PanelHeader extraction in
 * src/components/dashboard/Panel.tsx (new file) +
 * src/app/page.tsx (5 inline sites migrated).
 *
 * Session 211 List 1 refactor — extracted 2 new components from the
 * dashboard page:
 *
 *   - `<Panel accent={AccentColor}>`         — outer rounded card shell
 *   - `<PanelHeader icon label accent [count] [rightSlot]>` — icon+label
 *     header bar with optional count (left, dim) + right slot
 *
 * The 5 inline "rounded card with icon-and-label header" sites in
 * src/app/page.tsx that used to inline the same 5-line shell are:
 *
 *   1. Active Missions (line ~633, accent=cyan,  count+link)
 *   2. Cron Jobs       (line ~695, accent=orange, link)
 *   3. Platforms       (line ~735, accent=cyan,  no right slot)
 *   4. Errors          (line ~793, accent=red,   severity pills)
 *   5. Rec Room        (line ~894, accent=purple, no right slot)
 *
 * Migration intent: collapse the duplicate 5-line header pattern
 * (the 4 nested `<div>`s that were the same shape at every site)
 * into a single 2-component helper. The visual output is byte-
 * equivalent — the only structural change is the JSX
 * `<div className="rounded-xl border border-neon-X/20 ...">` becomes
 * `<Panel accent="X">`, and the header's 4 nested `<div>`s become
 * `<PanelHeader icon={...} label="..." accent="X" ...>`.
 *
 * Why source-pattern instead of rendering the page:
 *   - The Dashboard page is 900+ LOC with 8+ API fetches, 3+ polls,
 *     20+ useState calls, and a wide variety of accent colours.
 *     Rendering it requires mocking `useApiData`, `useTwoStepConfirm`,
 *     `useInterval`, the full `/api/*` surface, and the timer/refresh
 *     hooks — the harness would dwarf the invariants being tested.
 *   - The "use the shared component, not the inline shell" shape is
 *     a byte-level contract: the dashboard literally calls
 *     `<Panel accent="cyan">` instead of inlining the 4-div shell.
 *
 * What this test locks:
 *   1. The shared `Panel` + `PanelHeader` component file exists
 *      with both exports
 *   2. The dashboard page imports both `Panel` and `PanelHeader`
 *      from `@/components/dashboard/Panel`
 *   3. The 5 inline "rounded-xl border border-X-500/20" panel shells
 *      in the page are GONE (the post-extraction form is the
 *      `<Panel accent="...">` JSX)
 *   4. The 5 inline "flex items-center justify-between px-4 py-2
 *      border-b border-white/10 bg-dark-800/50" panel headers in
 *      the page are GONE (replaced by `<PanelHeader ... />`)
 *   5. Each of the 5 sites still uses the correct accent colour
 *      and the correct right-slot content (the count text for
 *      Active Missions, the manage link for Cron Jobs, the
 *      severity pills for Errors)
 *   6. The 2 "similar but intentionally NOT migrated" sites stay
 *      unchanged: the Mission Dispatch accordion (uses a click-to-
 *      toggle `<button>` header, not the static 4-div shell) and
 *      the process-card grid (each card is `p-4` content with no
 *      header bar — a different visual element, not a panel)
 *
 * If a future PR re-introduces the inline 4-div shell at any of the
 * 5 sites, this test fails.
 */
import * as fs from "node:fs";
import * as path from "node:path";

const DASHBOARD_PATH = path.resolve(
  __dirname,
  "../../src/app/page.tsx",
);
const PANEL_PATH = path.resolve(
  __dirname,
  "../../src/components/dashboard/Panel.tsx",
);

describe("Panel / PanelHeader extraction (List 1 dashboard panels)", () => {
  const pageSource = fs.readFileSync(DASHBOARD_PATH, "utf8");
  const panelSource = fs.readFileSync(PANEL_PATH, "utf8");

  describe("shared component file", () => {
    it("exists at src/components/dashboard/Panel.tsx", () => {
      // The 2 components live in a single file under
      // src/components/dashboard/, the established home for
      // dashboard-shared components (StatPill, StatusBadge are
      // siblings in the same directory).
      expect(fs.existsSync(PANEL_PATH)).toBe(true);
    });

    it("exports `Panel` as a named export", () => {
      // `export function Panel({...})` — the outer card shell.
      expect(panelSource).toMatch(/export\s+function\s+Panel\s*\(/);
    });

    it("exports `PanelHeader` as a named export", () => {
      // `export function PanelHeader({...})` — the icon+label header
      // bar. The signature exposes `icon`, `label`, `accent`, the
      // optional `count`, and the optional `rightSlot`.
      expect(panelSource).toMatch(/export\s+function\s+PanelHeader\s*\(/);
    });
  });

  describe("dashboard page imports", () => {
    it("imports Panel and PanelHeader from @/components/dashboard/Panel", () => {
      // The page must import BOTH components in a single line — the
      // pattern matches `import { Panel, PanelHeader } from
      // "@/components/dashboard/Panel"` (the canonical named-imports
      // form for a multi-export sibling file).
      expect(pageSource).toMatch(
        /import\s*\{\s*Panel\s*,\s*PanelHeader\s*\}\s*from\s*["']@\/components\/dashboard\/Panel["']/,
      );
    });
  });

  describe("inline panel-shell replacement", () => {
    it("removes all 5 inline 'rounded-xl border border-X-500/20 bg-dark-900/50 overflow-hidden' panel shells", () => {
      // The pre-extraction outer shell was the literal class string
      // `rounded-xl border border-X-500/20 bg-dark-900/50 overflow-hidden`
      // at 5 sites (Active Missions, Cron Jobs, Platforms, Errors,
      // Rec Room). After extraction, NONE of these inline shells
      // should remain in the page — every site now uses
      // `<Panel accent="...">`.
      //
      // The Mission Dispatch panel (line ~558) does still inline
      // `rounded-xl border border-neon-cyan/20 bg-dark-900/50
      // overflow-hidden` because its header is a click-to-toggle
      // `<button>`, not the static 4-div shell. We allow that
      // single remaining site (the test below pins it as the
      // accordion exception). The process-card grid (lines ~841,
      // ~848) uses `rounded-xl border border-neon-purple/20
      // bg-dark-900/50` WITHOUT `overflow-hidden` (different
      // padding, different content shape — these are process
      // cards, not panels), so the exact `overflow-hidden` form
      // should match at exactly 1 site (Mission Dispatch).
      const inlineShellPattern =
        /rounded-xl border border-(?:neon-[a-z]+|red|purple|blue|yellow)(?:-500)?\/20 bg-dark-900\/50 overflow-hidden/g;
      const matches = pageSource.match(inlineShellPattern);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBe(1); // Only Mission Dispatch remains (accordion exception)
    });

    it("Mission Dispatch accordion stays inline (different shape — click-to-toggle header)", () => {
      // Pin the exception: the Mission Dispatch panel uses a
      // `<button>` for its header (toggleable accordion), with
      // larger `w-4 h-4` icons and a `py-2.5` padding — different
      // from the 5 static-header sites. It is intentionally NOT
      // migrated to Panel/PanelHeader.
      expect(pageSource).toMatch(
        /onClick=\{toggleDispatchPanel\}[\s\S]{0,200}Rocket className="w-4 h-4 text-neon-cyan"/,
      );
    });
  });

  describe("inline panel-header replacement", () => {
    it("removes all 5 inline 'flex items-center justify-between px-4 py-2 border-b border-white/10 bg-dark-800/50' panel headers", () => {
      // The pre-extraction header was the literal class string
      // `flex items-center justify-between px-4 py-2 border-b border-white/10 bg-dark-800/50`
      // at 5 sites. After extraction, NONE of these inline headers
      // should remain in the page — every site now uses
      // `<PanelHeader icon={...} label="..." accent="..." ... />`.
      //
      // The Mission Dispatch panel uses a different
      // `w-full flex items-center justify-between px-4 py-2.5`
      // header (on a `<button>` with `py-2.5` not `py-2`), so the
      // exact `py-2` pattern should not match anywhere in the file.
      const inlineHeaderPattern =
        /flex items-center justify-between px-4 py-2 border-b border-white\/10 bg-dark-800\/50/g;
      const matches = pageSource.match(inlineHeaderPattern);
      expect(matches).toBeNull();
    });
  });

  describe("5 migrated sites use Panel + PanelHeader", () => {
    // Pin each of the 5 migrated sites to its specific
    // (icon, label, accent, right-slot) shape so a future refactor
    // that drops the right-slot content (e.g. a "simplification"
    // that removes the severity pills from the Errors panel) is
    // caught.
    it("Active Missions: <Panel accent='cyan'> + PanelHeader with Rocket + count + all-missions link", () => {
      // The count is rendered as a `(${N})` template literal; we
      // pin the literal `($` opening so a future regression that
      // changes the format (e.g. removes the parens) is caught.
      expect(pageSource).toMatch(
        /<Panel\s+accent="cyan">[\s\S]*?<PanelHeader\s+icon=\{Rocket\}\s+label="Active Missions"\s+accent="cyan"\s+count=\{\`\(\$\{activeMissions\.length\}\)\`\}[\s\S]*?all missions/,
      );
    });

    it("Cron Jobs: <Panel accent='orange'> + PanelHeader with ListTodo + manage link", () => {
      expect(pageSource).toMatch(
        /<Panel\s+accent="orange">[\s\S]*?<PanelHeader\s+icon=\{ListTodo\}\s+label="Cron Jobs"\s+accent="orange"[\s\S]*?manage →/,
      );
    });

    it("Platforms: <Panel accent='cyan'> + PanelHeader with Globe (no rightSlot)", () => {
      // The Platforms panel has no rightSlot (the only right-side
      // content is the Sync now button at the panel BODY, not the
      // header). Pin the absence of rightSlot so a future "let me
      // just add a refresh button to the header" PR is caught.
      expect(pageSource).toMatch(
        /<Panel\s+accent="cyan">[\s\S]*?<PanelHeader\s+icon=\{Globe\}\s+label="Platforms"\s+accent="cyan"\s*\/>/,
      );
    });

    it("Errors: <Panel accent='red'> + PanelHeader with AlertTriangle + severity pills", () => {
      // The severity pills (all / error / warning) are the
      // right-slot content. Pin the rightSlot presence + the
      // 3-pill array so a future "consolidate the pills" PR
      // changes the right-slot shape is caught.
      expect(pageSource).toMatch(
        /<Panel\s+accent="red">[\s\S]*?<PanelHeader\s+icon=\{AlertTriangle\}\s+label="Errors"\s+accent="red"[\s\S]*?rightSlot=\{[\s\S]*?\["all", "error", "warning"\] as const/,
      );
    });

    it("Rec Room: <Panel accent='purple'> + PanelHeader with Gamepad2 (no rightSlot)", () => {
      expect(pageSource).toMatch(
        /<Panel\s+accent="purple">[\s\S]*?<PanelHeader\s+icon=\{Gamepad2\}\s+label="Rec Room"\s+accent="purple"\s*\/>/,
      );
    });
  });

  describe("anti-migration guards (what this refactor did NOT change)", () => {
    it("Mission Dispatch accordion header is NOT a <PanelHeader> (uses a click-to-toggle <button>)", () => {
      // The Mission Dispatch panel's header is a `<button>` with
      // `onClick={toggleDispatchPanel}` — different shape from the
      // static 4-div header. Pin the negative so a future "let me
      // make this consistent" PR doesn't silently break the
      // accordion behavior.
      expect(pageSource).not.toMatch(
        /<PanelHeader[\s\S]*?Mission Dispatch/,
      );
    });

    it("process-card grid (No Active Processes / per-process card) is NOT a <Panel>", () => {
      // The "No Active Processes Detected" empty state (line ~841)
      // and the per-process card (line ~848) both have
      // `rounded-xl border border-neon-purple/20 bg-dark-900/50`
      // but they are different visual elements (no header bar,
      // different padding, different content shape) — not
      // candidates for Panel. Pin the negative so a future "let
      // me migrate these too" PR is caught.
      //
      // The grep matches a `<Panel>` JSX tag that's followed (within
      // ~200 chars) by "No Active Processes" or by the per-process
      // card structure. We use a strict negative lookahead pattern
      // (a Panel followed by either of those strings) so the
      // assertion is "no Panel wraps a process-card or empty-state".
      expect(pageSource).not.toMatch(
        /<Panel[\s\S]{0,500}No Active Processes Detected/,
      );
      expect(pageSource).not.toMatch(
        /<Panel[\s\S]{0,500}proc\.status === "running" \? "text-neon-green pulse-glow"/,
      );
    });
  });
});
