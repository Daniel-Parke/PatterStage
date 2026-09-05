/** @jest-environment node */

// ═══════════════════════════════════════════════════════════════
// T-0038 acceptance oracle (part 1 of 2): the nearest-match resolver
//
// Frozen before the implementation existed. The page half of the oracle
// lives in tests/unit/config-unknown-section-page.test.tsx.
//
// The dangerous half of this feature is not "does agent-settings find
// agent". It is the two ways a redirect can hurt: firing for a slug that
// is actually valid, and firing at a target that fires again. Both are
// checked exhaustively here rather than on a handful of examples, because
// the corpus that can trigger them is small enough to enumerate in full:
// every id, every id spelled with hyphens, every slugified label, every
// alias key, and every prefix of all of those.
//
// slugify() below is deliberately a second implementation. An oracle that
// imports the implementation's own slugifier grades the work with the
// ruler the work was cut against and cannot see a wrong ruler.
// ═══════════════════════════════════════════════════════════════

import {
  CONFIG_SECTIONS,
  SECTION_ALIASES,
  getSectionDef,
  resolveSectionRedirect,
} from "@/lib/config-schema";

const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");

const IDS = Object.keys(CONFIG_SECTIONS);
const LABEL_SLUGS = IDS.map((id) => slugify(CONFIG_SECTIONS[id].label));

/** Every prefix of `word`, shortest first, including the word itself. */
const prefixes = (word: string): string[] =>
  Array.from({ length: word.length }, (_, i) => word.slice(0, i + 1));

/**
 * Everything a redirect could plausibly be asked about. Deduped, because
 * many ids are their own label slug and their own hyphenated spelling.
 */
const CORPUS: string[] = Array.from(
  new Set([
    "",
    ...IDS,
    ...IDS.map((id) => id.replace(/_/g, "-")),
    ...LABEL_SLUGS,
    ...Object.keys(SECTION_ALIASES),
    ...IDS.flatMap(prefixes),
    ...IDS.flatMap((id) => prefixes(id.replace(/_/g, "-"))),
    ...LABEL_SLUGS.flatMap(prefixes),
    // Inherited Object.prototype keys. A plain object literal answers to
    // every one of these truthily, so an unguarded lookup treats them as
    // sections (INV-6).
    "constructor",
    "toString",
    "valueOf",
    "hasOwnProperty",
    "__proto__",
    // Sibling routes that are pages rather than sections, and plain junk.
    "models",
    "seed",
    "config",
    "nope",
    "zzzz",
    "agent-settings",
  ]),
);

/** The slug a `/agent/settings/<slug>` path would land on, or null if it leaves the route. */
const landingSlug = (path: string): string | null => {
  const prefix = "/agent/settings/";
  if (!path.startsWith(prefix)) return null;
  const rest = path.slice(prefix.length);
  return rest.includes("/") ? null : rest;
};

describe("resolveSectionRedirect: INV-1 a valid section never redirects", () => {
  it("returns null for every own key of CONFIG_SECTIONS", () => {
    const redirected = IDS.filter((id) => resolveSectionRedirect(id) !== null).map(
      (id) => `${id} -> ${resolveSectionRedirect(id)}`,
    );
    expect(redirected).toEqual([]);
  });

  it("returns null for the empty slug rather than guessing", () => {
    expect(resolveSectionRedirect("")).toBeNull();
  });
});

describe("resolveSectionRedirect: INV-2 every result is a full path", () => {
  it("emits a SECTION_ALIASES value or /config/<known id>, never a bare id", () => {
    const aliasTargets = new Set(Object.values(SECTION_ALIASES));
    const bad: string[] = [];

    for (const slug of CORPUS) {
      const result = resolveSectionRedirect(slug);
      if (result === null) continue;
      if (typeof result !== "string" || !result.startsWith("/")) {
        bad.push(`${JSON.stringify(slug)} -> ${String(result)} (not a path)`);
        continue;
      }
      if (aliasTargets.has(result)) continue;
      const landing = landingSlug(result);
      if (landing === null || !Object.prototype.hasOwnProperty.call(CONFIG_SECTIONS, landing)) {
        bad.push(`${JSON.stringify(slug)} -> ${result} (not a known section)`);
      }
    }

    expect(bad).toEqual([]);
  });

  it("declares every alias as a full path", () => {
    for (const [key, target] of Object.entries(SECTION_ALIASES)) {
      expect(`${key}: ${target}`).toMatch(/: \//);
    }
  });
});

describe("resolveSectionRedirect: INV-3 one hop terminates, INV-4 no self-redirect", () => {
  it("never sends a slug to a target that redirects again", () => {
    const looping: string[] = [];

    for (const slug of CORPUS) {
      const first = resolveSectionRedirect(slug);
      if (first === null) continue;
      const landing = landingSlug(first);
      // A target outside /config/<slug> cannot re-enter this page at all.
      if (landing === null) continue;
      const second = resolveSectionRedirect(landing);
      if (second !== null) {
        looping.push(`${JSON.stringify(slug)} -> ${first} -> ${second}`);
      }
    }

    expect(looping).toEqual([]);
  });

  it("never redirects a slug to its own path", () => {
    const self = CORPUS.filter(
      (slug) => resolveSectionRedirect(slug) === `/agent/settings/${slug}`,
    );
    expect(self).toEqual([]);
  });
});

describe("resolveSectionRedirect: INV-5 an ambiguous prefix does not guess", () => {
  it.each([
    ["s", 6],
    ["se", 2],
    ["st", 2],
    ["co", 2],
  ])("leaves %s alone, because it prefixes %i sections", (slug, expectedMatches) => {
    const matches = IDS.filter((id) => id.startsWith(slug as string));
    expect(matches.length).toBe(expectedMatches);
    expect(resolveSectionRedirect(slug as string)).toBeNull();
  });

  it.each([
    ["sec", "/agent/settings/security"],
    ["sess", "/agent/settings/session_reset"],
    ["smart", "/agent/settings/smart_model_routing"],
    ["chec", "/agent/settings/checkpoints"],
    ["deleg", "/agent/settings/delegation"],
  ])("resolves the unique prefix %s to %s", (slug, expected) => {
    expect(resolveSectionRedirect(slug as string)).toBe(expected);
  });
});

describe("resolveSectionRedirect: INV-6 membership is own-key membership", () => {
  it.each(["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__"])(
    "treats the inherited key %s as an unknown section, not a valid one",
    (key) => {
      expect(getSectionDef(key)).toBeNull();
      expect(resolveSectionRedirect(key)).toBeNull();
    },
  );
});

describe("resolveSectionRedirect: the rescues this task was opened for", () => {
  it("rescues the reported slug: agent-settings is exactly slugify('Agent Settings')", () => {
    expect(slugify(CONFIG_SECTIONS.agent.label)).toBe("agent-settings");
    expect(resolveSectionRedirect("agent-settings")).toBe("/agent/settings/agent");
  });

  it.each([
    "session-reset",
    "platform-toolsets",
    "code-execution",
    "smart-model-routing",
    "human-delay",
    "hermes-md",
  ])("rescues %s by the hyphen-to-underscore swap alone", (slug) => {
    expect(resolveSectionRedirect(slug)).toBe(`/agent/settings/${slug.replace(/-/g, "_")}`);
  });

  it("keeps the pre-existing alias working: model goes to the models page", () => {
    expect(resolveSectionRedirect("model")).toBe("/agent/models");
  });

  it("rescues every slugified label that is not already an id", () => {
    const missed: string[] = [];
    for (const id of IDS) {
      const labelSlug = slugify(CONFIG_SECTIONS[id].label);
      if (labelSlug === id) continue;
      const result = resolveSectionRedirect(labelSlug);
      if (result !== `/agent/settings/${id}`) {
        missed.push(`${labelSlug} -> ${String(result)} (wanted /config/${id})`);
      }
    }
    expect(missed).toEqual([]);
  });

  it("has no two sections whose labels slugify the same, so the label map is unambiguous", () => {
    const seen = new Map<string, string>();
    const collisions: string[] = [];
    for (const id of IDS) {
      const labelSlug = slugify(CONFIG_SECTIONS[id].label);
      const prior = seen.get(labelSlug);
      if (prior) collisions.push(`${labelSlug}: ${prior} and ${id}`);
      else seen.set(labelSlug, id);
    }
    expect(collisions).toEqual([]);
  });
});
