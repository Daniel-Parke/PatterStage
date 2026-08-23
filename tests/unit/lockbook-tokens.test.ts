/** @jest-environment node */
// ═══════════════════════════════════════════════════════════════
// The tokens the first-build lock-in sitting ruled (T-0028, 2026-08-24).
//
// docs/LOCKBOOK.md's Tokens section names two homes for a design token, the
// @theme block in src/app/globals.css and the code mirror in src/lib/theme.ts,
// and states that the two must agree. Two homes and a promise is not a contract:
// a class string in theme.ts naming a token nobody declared compiles, passes
// eslint, renders nothing, and looks exactly like a working style. That is the
// same failure mode the accent maps in theme.ts were already fixed for once.
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
import { measureClasses, surfaceClasses } from "@/lib/theme";

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
  if (utility.startsWith("ps-surface-")) return `--color-${utility}`;
  const measure = cls.replace(/^(max-w|space-y)-/, "");
  if (cls.startsWith("space-y-")) return `--spacing-${measure}`;
  return `--container-${measure}`;
}

describe("the surface ladder", () => {
  const tokens = declaredTokens();

  it("gives every semantic role a token globals.css declares", () => {
    for (const cls of Object.values(surfaceClasses)) {
      expect(tokens.has(tokenForClass(cls))).toBe(true);
    }
  });

  it("aliases the primitives the tree already paints, minting no new colour", () => {
    // Three of the four roles are an alias, not a value: changing --color-dark-900
    // must move the panel with it, or the semantic layer is a second source of
    // truth rather than a name for the first.
    expect(tokens.get("--color-ps-surface-ground")).toBe("var(--color-dark-950)");
    expect(tokens.get("--color-ps-surface-panel")).toBe("var(--color-dark-900)");
    expect(tokens.get("--color-ps-surface-well")).toBe("var(--color-dark-800)");
    // The hairline is the exception, and it is recorded rather than invented:
    // the tree draws its rules as border-white/10, which matches no dark-* rung.
    expect(tokens.get("--color-ps-surface-hairline")).toBe("rgb(255 255 255 / 0.10)");
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
