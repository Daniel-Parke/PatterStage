/**
 * B9 oracle, the server half (T-0103, D80, D81, D82, and decision 11).
 *
 * Written before the product code moved.
 *
 *   D80  Enabling a granular toolset beside hermes-cli does nothing. The write
 *        path normalises it away, which is correct, but the READ path
 *        normalises too and persists the result, so a GET rewrites the row.
 *        Normalisation belongs on the write; a value that came out of the
 *        database was already normalised when it went in.
 *   D81  The standalone skill viewer is the catalogue's destination, so a
 *        skill the catalogue knows about must answer even when SKILL.md is
 *        not on disk, with the thinner payload the page then has to tolerate.
 *   D82  A skill on disk but not in SQLite can never be toggled: the route
 *        refuses it as "not in catalog" although the list the operator
 *        clicked it from shows it.
 *   d11  Personalities folds into Agents. /api/personalities and PUT
 *        /api/agent/personality go; the SOUL.md door on /api/agent/files
 *        is the one write path, and it is the one that records the ledger.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

// ═══════════════════════════════════════════════════════════════
// D80: normalisation is a write-path job
// ═══════════════════════════════════════════════════════════════

describe("the toolset coverage rule is one function", () => {
  it("names the bundle that already provides a granular toolset", async () => {
    const mod = (await import("@/modules/hermes/lib/toolset-coverage" as string)) as {
      bundleCovering?: (enabled: string[], toolsetId: string) => string | null;
    };
    if (typeof mod.bundleCovering !== "function") {
      throw new Error("src/modules/hermes/lib/toolset-coverage.ts exports no bundleCovering (contract D80)");
    }

    expect(mod.bundleCovering(["hermes-cli"], "terminal")).toBe("hermes-cli");
    expect(mod.bundleCovering(["hermes-cli"], "file")).toBe("hermes-cli");
  });

  it("a bundle does not cover itself, and covers nothing it does not contain", async () => {
    const { bundleCovering } = (await import("@/modules/hermes/lib/toolset-coverage" as string)) as {
      bundleCovering: (enabled: string[], toolsetId: string) => string | null;
    };

    expect(bundleCovering(["hermes-cli"], "hermes-cli")).toBeNull();
    // hermes-discord is a gateway bundle, not the CLI one.
    expect(bundleCovering(["hermes-cli"], "hermes-discord")).toBeNull();
    // Nothing is covered when the bundle is off.
    expect(bundleCovering(["terminal"], "terminal")).toBeNull();
    expect(bundleCovering([], "terminal")).toBeNull();
  });

  it("the covered set is the one the normaliser drops, not a second list", async () => {
    const { bundleCovering } = (await import("@/modules/hermes/lib/toolset-coverage" as string)) as {
      bundleCovering: (enabled: string[], toolsetId: string) => string | null;
    };
    const { normalizePlatformToolsets } = await import("@/modules/hermes/lib/toolset-normalize");

    // Whatever the normaliser would drop beside hermes-cli, the grid must
    // already be showing as covered. Two lists that can drift apart is how
    // the operator got a button that turns itself off.
    for (const id of ["terminal", "file", "web", "browser", "skills", "cronjob", "memory"]) {
      const kept = normalizePlatformToolsets({ cli: ["hermes-cli", id, "custom-thing"] }).cli;
      const dropped = !kept.includes(id);
      expect([id, dropped]).toEqual([id, bundleCovering(["hermes-cli"], id) !== null]);
    }
  });
});

describe("a read of the toolsets does not rewrite them", () => {
  it("hydration normalises what came from config.yaml or the seed, not what came from the database", () => {
    const src = readFileSync(
      join(__dirname, "..", "..", "src", "modules", "hermes", "lib", "profiles-repository.ts"),
      "utf-8",
    );

    // Two call sites (the root and a named profile), both guarded.
    const guarded = src.match(/resolved\.source === "database"\s*\?\s*resolved\.toolsets/g) ?? [];
    expect(guarded.length).toBe(2);
    // And no unguarded normalise left behind.
    expect(src).not.toMatch(/const toolsets = normalizePlatformToolsets\(resolved\.toolsets\);/);
  });
});

// ═══════════════════════════════════════════════════════════════
// D82: a skill the operator can see is a skill they can toggle
// ═══════════════════════════════════════════════════════════════

describe("toggling a skill that is on disk but not in the catalogue", () => {
  it("the refusal is not reached by a name the agent actually has", () => {
    const src = readFileSync(
      join(__dirname, "..", "..", "src", "app", "api", "skills", "[name]", "toggle", "route.ts"),
      "utf-8",
    );

    // The guard must consider the disk as well as the catalogue. The exact
    // helper is the contract's: skillIsKnown(name).
    expect(src).toMatch(/skillIsKnown\(/);
    expect(src).not.toMatch(/if \(!getSkill\(name\)\) \{/);
  });

  it("skillIsKnown answers for a catalogue row and for a directory on disk", async () => {
    const mod = (await import("@/modules/hermes/lib/skills-known" as string)) as {
      skillIsKnown?: (name: string) => boolean;
    };
    if (typeof mod.skillIsKnown !== "function") {
      throw new Error("src/modules/hermes/lib/skills-known.ts exports no skillIsKnown (contract D82)");
    }
    // A name that is in neither place is still refused.
    expect(mod.skillIsKnown("definitely-not-a-skill-anywhere")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// D81: the viewer is the catalogue's destination
// ═══════════════════════════════════════════════════════════════

describe("the skill viewer's payload", () => {
  it("is built in one place, disk first and catalogue second", () => {
    const src = readFileSync(
      join(__dirname, "..", "..", "src", "modules", "hermes", "lib", "skill-view.ts"),
      "utf-8",
    );

    // The disk answer names its source too, so the page never has to guess.
    expect(src).toMatch(/source: "disk"/);
    expect(src).toMatch(/source: "catalog"/);
  });

  it("is the payload BOTH routes send, because a top-level key does not reach the catch-all", () => {
    const base = join(__dirname, "..", "..", "src", "app", "api", "skills");
    const catchAll = readFileSync(join(base, "[...path]", "route.ts"), "utf-8");
    const single = readFileSync(join(base, "[name]", "route.ts"), "utf-8");

    // /api/skills/writing is matched by [name]; /api/skills/office/pdf by the
    // catch-all. Answering different shapes is what made the viewer throw for
    // every top-level skill key (T-0103, D81).
    expect(catchAll).toMatch(/readSkillView\(/);
    expect(single).toMatch(/readSkillView\(/);
    // Both still refuse a name neither place knows.
    expect(catchAll).toMatch(/notFound\(/);
    expect(single).toMatch(/notFound\(/);
  });
});

// ═══════════════════════════════════════════════════════════════
// Decision 11: the fold
// ═══════════════════════════════════════════════════════════════

describe("Personalities folds into Agents", () => {
  const root = join(__dirname, "..", "..");

  it("the standalone page is gone", () => {
    expect(existsSync(join(root, "src", "app", "agent", "personalities", "page.tsx"))).toBe(false);
  });

  it("its two routes are gone with it", () => {
    expect(existsSync(join(root, "src", "app", "api", "personalities", "route.ts"))).toBe(false);
    expect(existsSync(join(root, "src", "app", "api", "agent", "personality", "route.ts"))).toBe(false);
  });

  it("the rail no longer carries it", () => {
    const src = readFileSync(
      join(root, "src", "lib", "modules", "registry.ts"),
      "utf-8",
    );
    const links = src.slice(src.indexOf("NAV_GROUPS"));
    expect(links).not.toMatch(/href: "\/agent\/personalities"/);
  });

  it("both old paths land on the Identity tab", () => {
    const src = readFileSync(join(root, "next.config.ts"), "utf-8");

    expect(src).toMatch(/temporary\("\/agent\/personalities", "\/agent\/profiles\?tab=identity"\)/);
    expect(src).toMatch(/temporary\("\/operations\/personalities", "\/agent\/profiles\?tab=identity"\)/);
    // 307, never 308: the destination is ours to change again.
    expect(src).toMatch(/permanent: false/);
  });

  it("the one write path that remains is the SOUL.md door, and it keeps the ledger", () => {
    const src = readFileSync(
      join(root, "src", "app", "api", "agent", "files", "[key]", "route.ts"),
      "utf-8",
    );

    expect(src).toMatch(/recordEvent\("personality\.changed"/);
  });
});
