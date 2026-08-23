/** @jest-environment node */

import { execBaselineSchema } from "../helpers/baseline-db";

let testDb: import("better-sqlite3").Database | null = null;

function loadRealBetterSqlite3(): typeof import("better-sqlite3") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
}

jest.mock("@/lib/db", () => ({
  getDb: () => testDb!,
  ensureDb: () => undefined,
  now: () => "2026-01-01T00:00:00.000Z",
}));

import {
  countSkills,
  getSkill,
  listSkillCatalog,
  listSkillKeys,
  listSkills,
  parseSkillFrontmatter,
  stripSkillFrontmatter,
  upsertSkill,
} from "@/lib/skills-repository";

beforeEach(() => {
  const Database = loadRealBetterSqlite3();
  testDb = new Database(":memory:");
  execBaselineSchema(testDb);
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe("skills-repository", () => {
  it("upserts and lists skills by key", () => {
    upsertSkill({
      skillKey: "github/git-workflow",
      displayName: "Git Workflow",
      description: "Git helpers",
      category: "github",
      content: "---\nname: git-workflow\n---\n",
      source: "custom",
    });

    const row = getSkill("github/git-workflow");
    expect(row?.displayName).toBe("Git Workflow");
    expect(listSkills().some((s) => s.skillKey === "github/git-workflow")).toBe(true);
  });
});

describe("skills-repository metadata reads", () => {
  // These three exist so callers that never read a SKILL.md body do not drag
  // every body out of SQLite. They must therefore agree with listSkills() on
  // everything EXCEPT the body, or a caller that switches changes behaviour.
  const seed = () => {
    upsertSkill({
      skillKey: "beta/second",
      displayName: "Second",
      description: "second skill",
      category: "beta",
      content: "0123456789",
      source: "custom",
    });
    upsertSkill({
      skillKey: "alpha/first",
      displayName: "First",
      description: "first skill",
      category: "alpha",
      content: "abc",
      source: "bundled",
    });
  };

  it("listSkillCatalog matches listSkills on order, keys and metadata", () => {
    seed();
    const full = listSkills();
    const meta = listSkillCatalog();

    expect(meta.map((s) => s.skillKey)).toEqual(full.map((s) => s.skillKey));
    expect(meta.map((s) => s.category)).toEqual(full.map((s) => s.category));
    expect(meta.map((s) => s.description)).toEqual(full.map((s) => s.description));
    expect(meta.map((s) => s.source)).toEqual(full.map((s) => s.source));
    expect(meta.map((s) => s.updatedAt)).toEqual(full.map((s) => s.updatedAt));
  });

  it("listSkillCatalog reports the body length and not the body", () => {
    seed();
    const meta = listSkillCatalog();
    const byKey = Object.fromEntries(meta.map((s) => [s.skillKey, s]));

    expect(byKey["alpha/first"].contentLength).toBe("abc".length);
    expect(byKey["beta/second"].contentLength).toBe("0123456789".length);
    expect(meta[0]).not.toHaveProperty("content");
  });

  it("listSkillKeys and countSkills agree with listSkills", () => {
    seed();
    expect(listSkillKeys()).toEqual(listSkills().map((s) => s.skillKey));
    expect(countSkills()).toBe(listSkills().length);
  });

  it("countSkills is 0 and listSkillKeys empty on an empty catalog", () => {
    expect(countSkills()).toBe(0);
    expect(listSkillKeys()).toEqual([]);
    expect(listSkillCatalog()).toEqual([]);
  });
});

describe("stripSkillFrontmatter", () => {
  it("returns the body trimmed when frontmatter is present", () => {
    const content = "---\nname: x\n---\n\nHello body\n";
    expect(stripSkillFrontmatter(content)).toBe("Hello body");
  });

  it("returns the content verbatim when no frontmatter is present", () => {
    const content = "Just body, no frontmatter\n  leading indent\n";
    // Mirrors the previous inline implementation byte-for-byte:
    // no-trim on the no-frontmatter path was a deliberate choice
    // because callers (e.g. the skills route) compose the result
    // into a larger payload and don't expect mutation.
    expect(stripSkillFrontmatter(content)).toBe(content);
  });

  it("handles CRLF line endings", () => {
    const content = "---\r\nname: x\r\n---\r\n\r\nBody\r\n";
    expect(stripSkillFrontmatter(content)).toBe("Body");
  });

  it("returns an empty string for empty input", () => {
    expect(stripSkillFrontmatter("")).toBe("");
  });
});

describe("parseSkillFrontmatter", () => {
  it("extracts name, description, and first tag as category", () => {
    const content =
      "---\nname: git-workflow\ndescription: Git helpers\ntags: [github, git]\n---\n\nBody\n";
    expect(parseSkillFrontmatter(content)).toEqual({
      name: "git-workflow",
      description: "Git helpers",
      category: "github",
    });
  });
});
