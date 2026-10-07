/** @jest-environment node */
// ═══════════════════════════════════════════════════════════════
// The tokens the first-build lock-in sitting ruled (T-0028, 2026-08-24).
//
// org/LOCKBOOK.md's Tokens section names two homes for a design token, the
// @theme block in src/app/globals.css and the code mirror in src/lib/ui/theme.ts,
// and states that the two must agree. Two homes and a promise is not a contract:
// a class string in theme.ts naming a token nobody declared compiles, passes
// eslint, renders nothing, and looks exactly like a working style. That is the
// same failure mode the accent maps in theme.ts were already fixed for once.
//
// FIRST it PARSES the CSS, and that assertion exists because of a real
// incident. The first version of this test read globals.css as text and
// regexed for token declarations, so it passed green against a stylesheet
// that could not compile: a `*/` inside a glob in a comment terminated the
// comment early and `npm run build` failed, while lint, tsc, this test and
// the output canary all stayed green, because none of them parses CSS. A
// test that reads its subject as a string cannot tell you the subject is
// valid.
//
// So this reads the CSS and holds the mirror against it. It also holds the
// module-to-accent map to the shape WG-WEB-009 (B) rules: one registered map,
// one entry per module, four entries, and no state hue carrying an identity.
//
// What it does NOT check is that the values are the right ones. That argument is
// in the lock-book row and in the comments beside each token, where a reader can
// re-run the measurement. This checks only that the three files still say the
// same thing.
// ═══════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { MODULES, MODULE_ACCENTS } from "@/lib/modules/registry";
import { edgeClasses, measureClasses, surfaceClasses } from "@/lib/ui/theme";

const CSS = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf-8");

/** Every custom property globals.css declares, with its value. */
function declaredTokens(): Map<string, string> {
  const found = new Map<string, string>();
  for (const m of CSS.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gm)) {
    found.set(m[1], m[2].trim());
  }
  return found;
}

/** `bg-ps-surface-panel` -> `--color-ps-surface-panel`, per Tailwind's namespaces. */
function tokenForClass(cls: string): string {
  const utility = cls.replace(/^(bg|border|text)-/, "");
  if (utility.startsWith("ps-surface-") || utility.startsWith("ps-edge")) {
    return `--color-${utility}`;
  }
  const measure = cls.replace(/^(max-w|space-y)-/, "");
  if (cls.startsWith("space-y-")) return `--spacing-${measure}`;
  return `--container-${measure}`;
}

describe("globals.css is valid CSS at all", () => {
  // The cheapest possible guard on the most expensive possible mistake: this
  // stylesheet is the only one src/app/layout.tsx imports, so if it does not
  // parse, nothing in it ships. Not the token ladder below, not the bloom
  // paint rule, not one colour.
  it("parses", async () => {
    const postcss = (await import("postcss")).default;
    expect(() => postcss.parse(CSS, { from: "globals.css" })).not.toThrow();
  });

  it("has no unterminated or prematurely closed block comment", () => {
    // The specific shape that bit: a `*/` appearing inside comment prose,
    // usually from writing a glob like src/ ** / *.tsx.
    const opens = (CSS.match(/\/\*/g) || []).length;
    const closes = (CSS.match(/\*\//g) || []).length;
    expect(closes).toBe(opens);
  });
});

describe("the surface ladder", () => {
  const tokens = declaredTokens();

  it("gives every semantic role a token globals.css declares", () => {
    for (const cls of Object.values(surfaceClasses)) {
      expect(tokens.has(tokenForClass(cls))).toBe(true);
    }
  });

  /**
   * The rules are a separate ladder from the fills, on a cooler and far less
   * saturated ray, because on the surface ray a 3:1 stroke comes out a blue
   * line rather than an edge (T-0116). Same rule, same reason: two homes with
   * nothing holding them together is how a mirror goes stale.
   */
  it("and gives every edge role one too", () => {
    const roles = Object.values(edgeClasses);
    expect(roles).toHaveLength(3);
    for (const cls of roles) {
      expect(tokens.has(tokenForClass(cls))).toBe(true);
    }
  });

  /**
   * Amended 2026-09-07 (T-0116), and the reason belongs here rather than in a
   * commit message.
   *
   * This used to assert that all four roles alias a `--color-dark-*` primitive:
   * that the semantic layer is a NAME for the appearance layer and not a second
   * source of truth. That is a good rule and it is why the test was written. It
   * is also the rule that kept the ladder flat, because the primitives it named
   * span 1.19:1 against the ground, and a semantic layer that can only rename
   * what is already there cannot fix a surface nobody can see.
   *
   * So the rule now applies to the roles that are still names, and the roles
   * that became values are asserted AS values, by measurement, in
   * u2-the-token-layer.test.ts. Nothing here is loosened: there are more
   * assertions than before, not fewer.
   */
  /**
   * `well` and `surface-hairline` were the last two rungs of the flat ladder,
   * kept alive through U2 so that DECLARING the new one repainted nothing.
   * U4 moved their call sites, so they are gone: `well` aliased dark-800,
   * which is LIGHTER than the card it sat inside, so every input in the
   * product read as a lift rather than a well; `surface-hairline` was white at
   * 10%, which is the 1.25:1 rule this programme exists to remove.
   */
  it("no longer declares the two rungs of the flat ladder", () => {
    expect(tokens.get("--color-ps-surface-well")).toBeUndefined();
    expect(tokens.get("--color-ps-surface-hairline")).toBeUndefined();
    // And what replaced them is declared, so this is a swap rather than a loss.
    expect(tokens.get("--color-ps-surface-inset")).toBe("var(--color-ps-surface-ground)");
    expect(tokens.get("--color-ps-edge-hairline")).toBe("#474f59");
  });

  it("and the roles that became values are hexes, not aliases of a flat ladder", () => {
    // A `var()` here would mean the ladder is back to renaming dark-900, which
    // is the state the walk measured at 1.06:1 against the page.
    expect(tokens.get("--color-ps-surface-ground")).toMatch(/^#[0-9a-f]{6}$/i);
    expect(tokens.get("--color-ps-surface-panel")).toMatch(/^#[0-9a-f]{6}$/i);
    expect(tokens.get("--color-ps-surface-panel")).not.toBe(tokens.get("--color-dark-900"));
  });
});

describe("the measures", () => {
  const tokens = declaredTokens();

  it("gives every measure a token globals.css declares", () => {
    for (const cls of Object.values(measureClasses)) {
      expect(tokens.has(tokenForClass(cls))).toBe(true);
    }
  });

  it("keeps the reading measure at the width the longform surfaces already use", () => {
    // 48rem is max-w-3xl: the Story Weaver reader, the research report and the
    // artifact viewer were all set to it during the UX pass. The lock-book
    // records that number; a second reading width would be the defect.
    expect(tokens.get("--container-ps-reading")).toBe("48rem");
    expect(tokens.get("--container-ps-wide")).toBe("56rem");
    expect(tokens.get("--container-ps-full")).toBe("80rem");
    expect(tokens.get("--spacing-ps-block")).toBe("1.5rem");
  });
});

describe("the module-to-accent map", () => {
  it("carries exactly one entry per registered module", () => {
    expect(Object.keys(MODULE_ACCENTS).sort()).toEqual(MODULES.map((m) => m.id).sort());
  });

  it("is four entries, which is what WG-WEB-009 (B) rules", () => {
    expect(Object.keys(MODULE_ACCENTS)).toHaveLength(4);
  });

  it("gives each module a hue of its own", () => {
    const accents = Object.values(MODULE_ACCENTS);
    expect(new Set(accents).size).toBe(accents.length);
  });

  it("spends no state hue on identity", () => {
    // --color-neon-green and --color-semantic-success are the same hex, so a
    // module wearing green would be indistinguishable from a finished run.
    const tokens = declaredTokens();
    expect(tokens.get("--color-neon-green")).toBe(tokens.get("--color-semantic-success"));
    expect(Object.values(MODULE_ACCENTS)).not.toContain("green");
  });

  it("names accents globals.css actually declares", () => {
    const tokens = declaredTokens();
    for (const accent of Object.values(MODULE_ACCENTS)) {
      expect(tokens.has(`--color-neon-${accent}`)).toBe(true);
    }
  });
});

describe("the RGB mirror tokens are usable by the rules that consume them", () => {
  /**
   * Every consumer writes `rgb(var(--ps-rgb-x) / <alpha>)`, which is CSS
   * Color 4 slash-alpha syntax and REQUIRES space-separated channels. Written
   * as a comma list, `rgb(51, 221, 255 / 0.07)` mixes legacy and modern syntax,
   * is invalid, and the browser drops the whole declaration.
   *
   * That is not theoretical. Until 2026-08-24 all six mirrors held comma lists,
   * so eighteen paint rules in this stylesheet rendered NOTHING: every
   * .text-glow-*, every .glow-* box-shadow, .scanlines and .grid-bg, plus
   * GlowSurface through --glow-surface-rgb. docs/contributing/design-tokens.md reserves
   * those for LIVE state and the lock-book's motif is "the only bright things
   * are live state", so the entire liveness signal was invisible and a running
   * session looked exactly like a finished one. Nothing failed, because a
   * dropped declaration is silent.
   */
  const mirrors = [...CSS.matchAll(/(--ps-rgb-[a-z-]+):\s*([^;]+);/g)];

  it("declares at least one mirror, so this test cannot pass vacuously", () => {
    expect(mirrors.length).toBeGreaterThan(0);
  });

  it.each(mirrors.map((m) => [m[1], m[2].trim()]))(
    "%s is space separated, not a comma list",
    (_name, value) => {
      expect(value).not.toContain(",");
      expect(value).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
    },
  );

  it("keeps the code mirror in the same form, since it feeds the same syntax", async () => {
    const theme = readFileSync(join(process.cwd(), "src/lib/ui/theme.ts"), "utf-8");
    const block = theme.slice(theme.indexOf("const GLOW_RGBS"));
    const values = [...block.slice(0, block.indexOf("} as const;")).matchAll(/"([^"]+)"/g)];
    expect(values.length).toBeGreaterThan(0);
    for (const [, v] of values) expect(v).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
  });
});
