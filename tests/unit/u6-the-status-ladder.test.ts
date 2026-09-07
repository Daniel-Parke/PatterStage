/**
 * U6 (T-0120), part two: one ladder for colour that means something.
 *
 * Measured across src/: 34 ad-hoc status-colour sites in 26 files - 15 object
 * literals keyed by a state word and 19 if/ternary chains over one. The
 * reconnaissance said 22 across ~20 files and named 18 exemplars, of which only
 * 7 are keyed on a state word at all; the other 11 are CATEGORICAL maps (an
 * artifact's source kind, a research step's kind, a notification's tone) that a
 * status ladder must not absorb. So the count was both an undercount and padded
 * with the wrong things.
 *
 * What the survey found that the recon missed is the sharpest case:
 * `ProcessesPanel` paints a Hermes process whose status is `running` in GREEN,
 * while every other screen in the product paints `running` cyan. Two screens
 * away, `failed` is `text-neon-pink` on both the composer and research - pink,
 * not the declared danger token.
 *
 * The fix is not a colour codemod. The product already has a module whose whole
 * job is that a status wears ONE word - `src/lib/status-labels.ts`, thirteen
 * ratified words, typed with `satisfies` so a new enum member without a word is
 * a compile error. The colour belongs to the word, so a thing cannot be called
 * Failed and painted green: `STATUS_TONE` is `Record<StatusLabel, StatusTone>`
 * and is exhaustive by the same mechanism.
 *
 * What it deliberately does NOT absorb, each with a reason:
 *   - log SEVERITY (error/warn/info/debug) is not a run state
 *   - a notification's tone (success/error/info) is not an entity's status
 *   - `RUN_TONE_TEXT.good` is a deliberate NEUTRAL: an on-time duration is not
 *     a success, it is an absence of news
 *   - the workflow canvas's pending/skipped are structural EDGE tokens
 *   - an artifact's source kind and a research step's kind are categorical
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { blockCommentLines } from "../../scripts/tooling/design-lint.mjs";

import {
  STATUS_TONE,
  STATUS_VOCABULARY,
  statusTone,
  type StatusLabel,
} from "@/lib/status-labels";
import { statusToneClasses } from "@/lib/theme";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf-8").replace(/\r\n/g, "\n");

const TONES = ["idle", "queued", "running", "ok", "warn", "fail", "blocked"] as const;

/** Every .ts/.tsx under src/, keyed by its repo-relative path. */
function sources(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const base = join(ROOT, "src");
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) {
        out.push([
          `src/${full.slice(base.length + 1).split("\\").join("/")}`,
          readFileSync(full, "utf-8").replace(/\r\n/g, "\n"),
        ]);
      }
    }
  };
  walk(base);
  return out;
}


describe("the word decides the colour", () => {
  it("gives every ratified word a tone, and no word is missed", () => {
    expect(STATUS_VOCABULARY.length).toBe(13);
    for (const word of STATUS_VOCABULARY) {
      expect(TONES).toContain(STATUS_TONE[word as StatusLabel]);
    }
  });

  /**
   * The point of hanging tone off the WORD rather than off each screen's enum:
   * a thing cannot be called Failed on one screen and painted the colour of
   * Completed on the next. Two screens did exactly that.
   */
  it.each([
    ["Running", "running"],
    ["Completed", "ok"],
    ["Failed", "fail"],
    ["Queued", "queued"],
    ["Draft", "idle"],
    ["Healthy", "ok"],
    ["Degraded", "warn"],
    ["Not running", "fail"],
    ["Waiting for you", "blocked"],
  ])("%s is %s", (word, tone) => {
    expect(statusTone(word as StatusLabel)).toBe(tone);
  });

  /**
   * Cancelled keeps the orange it has, and keeps it for the reason a signed
   * comment in the composer already gives: orange separates "the gate the
   * operator turned down" from a failure. `blocked` IS neon-orange, so the
   * distinction survives the migration and so does the pixel.
   */
  it("keeps Cancelled apart from Failed, as the composer's comment asks", () => {
    expect(statusTone("Cancelled")).toBe("blocked");
    expect(statusTone("Failed")).toBe("fail");
    expect(statusTone("Cancelled")).not.toBe(statusTone("Failed"));
  });
});

describe("a tone is a set of literal classes", () => {
  it("has one entry per rung", () => {
    expect(Object.keys(statusToneClasses).sort()).toEqual([...TONES].sort());
  });

  /**
   * Literal, because Tailwind scans source. `text-status-${tone}` generates
   * nothing at all, which is the defect T-0120's first half is about.
   */
  it.each(TONES)("%s names the status token in every slot", (tone) => {
    const entry = statusToneClasses[tone];
    expect(entry.text).toBe(`text-status-${tone}`);
    expect(entry.dot).toBe(`bg-status-${tone}`);
    expect(entry.fill).toBe(`bg-status-${tone}/10`);
    expect(entry.border).toBe(`border-status-${tone}/30`);
  });
});

describe("and the screens ask the ladder", () => {
  /**
   * The one the reconnaissance missed. A Hermes process that is `running`
   * painted `text-neon-green` and `bg-neon-green/10`, while every other screen
   * in the product paints `running` cyan. The panel is on the front door.
   */
  it("the dashboard's process rows no longer paint running green", () => {
    const source = read("src/components/dashboard/ProcessesPanel.tsx");
    expect(source).not.toMatch(/text-neon-green/);
    expect(source).toMatch(/statusToneClasses|statusTone/);
  });

  it.each([
    ["the composer's run list", "src/app/work/composer/page.tsx"],
    ["the research run list", "src/app/work/research/page.tsx"],
    ["the mission board", "src/components/missions/mission-page-constants.tsx"],
  ])("%s takes its colour from the ladder", (_what, path) => {
    expect(read(path)).toMatch(/statusToneClasses|statusTone/);
  });

  /**
   * `failed` was `text-neon-pink` on two screens: pink, which is an accent, not
   * the declared danger token. Nothing in the product should still say so.
   */
  it("nothing paints a failure pink any more", () => {
    for (const path of [
      "src/app/work/composer/page.tsx",
      "src/app/work/research/page.tsx",
      "src/components/missions/mission-page-constants.tsx",
    ]) {
      const code = read(path)
        .split("\n")
        .filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("*"))
        .join("\n");
      expect(code).not.toMatch(/failed:\s*"[^"]*neon-pink/);
    }
  });
});

describe("what the ladder does NOT absorb, and why", () => {
  /**
   * Each of these is a map the reconnaissance counted as a status map and which
   * is not one. Folding them in would make the product worse: a log at severity
   * `info` is not an entity that is idle, and an on-time duration is not a
   * success.
   */
  it.each([
    ["log severity", "src/components/logs/constants.ts", /severity/i],
    ["a notification's tone", "src/components/ui/Toast.tsx", /notification|not an entity/i],
    ["a neutral duration", "src/components/missions/mission-page-constants.tsx", /neutral|absence of news/i],
  ])("%s stays its own scale, and says so", (_what, path, reason) => {
    expect(read(path)).toMatch(reason);
  });
});

/**
 * The seam that stops there ever being a thirty-fifth map.
 *
 * T-0116's record says `status-colour-through-helper` was dropped from
 * design-lint deliberately - "a state-to-colour map is an object literal over
 * many lines and a line-oriented regex cannot see it without guessing" - and
 * deferred to a source-seam test in U6. This is it.
 *
 * It does NOT refuse a state word beside any colour. The workflow canvas
 * outlines `pending` with `border-ps-edge-emphasis` and that is right: a stage
 * nobody has reached yet is not in a state, it is merely outlined. What it
 * refuses is a state word painted an ACCENT or a raw Tailwind ramp step, which
 * is exactly how thirty-four sites came to disagree about what running looks
 * like.
 */
describe("a state word is never painted an accent directly", () => {
  const STATE_WORDS =
    "running|failed|completed|complete|successful|succeeded|queued|pending|cancelled|" +
    "rejected|skipped|draft|dispatched|idle|error|warn|warning|degraded|healthy|down|" +
    "ok|success|blocked|awaiting_approval|active|stopped|online|offline|generating";

  /** An accent or a raw ramp step: the two vocabularies a status must not use. */
  const FORBIDDEN =
    "neon-[a-z]+|semantic-[a-z]+|red|green|blue|yellow|orange|purple|pink|cyan|emerald|" +
    "amber|rose|lime|teal|sky|indigo|violet|fuchsia|slate|gray|grey|zinc|stone";

  const KEYED = new RegExp(
    `^\\s*["']?(?:${STATE_WORDS})["']?\\s*:\\s*(?:\`|")[^"\`]*\\b(?:text|bg|border|ring|from|to|divide)-(?:${FORBIDDEN})(?:-\\d{2,3})?(?:/\\d{1,3})?\\b`,
    "i",
  );

  /**
   * The scales that are deliberately not the status ladder. Each names WHY in
   * its own file, and the test that checks those reasons are written down is
   * above; this list is the second half of that bargain.
   */
  const NOT_STATUS: Record<string, string> = {
    "src/components/logs/constants.ts": "log severity is not a run state",
    "src/components/ui/Toast.tsx": "a notification's tone is not an entity's status",
  };

  it("has state words to look for, so none of this passes vacuously", () => {
    expect(KEYED.test('  running: "text-neon-cyan",')).toBe(true);
    expect(KEYED.test('  failed: "bg-red-500/10 text-red-400",')).toBe(true);
    // And the forms it must leave alone.
    expect(KEYED.test("  running: statusToneClasses.running.text,")).toBe(false);
    expect(KEYED.test('  pending: "border-ps-edge-emphasis",')).toBe(false);
    expect(KEYED.test('  idle: "text-ps-text-muted",')).toBe(false);
  });

  it("no map keys an accent off a state word", () => {
    const offenders: string[] = [];
    for (const [path, source] of sources()) {
      if (NOT_STATUS[path]) continue;
      const lines = source.split("\n");
      const commented = blockCommentLines(lines);
      lines.forEach((line, i) => {
        if (commented[i]) return;
        const t = line.trimStart();
        if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
        if (KEYED.test(line)) offenders.push(`${path}:${i + 1}  ${line.trim().slice(0, 76)}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it("and the two that are exempt say why in their own file", () => {
    for (const [path, reason] of Object.entries(NOT_STATUS)) {
      const source = read(path).toLowerCase();
      const keyword = reason.split(" ")[0];
      expect(source).toContain(keyword);
    }
  });
});
