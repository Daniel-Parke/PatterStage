/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */
// Story Weaver's reusable character + theme library (real SQLite; the @/lib/db
// singleton is mocked to a fresh in-memory DB per test).
//
// This library is the storage the Characters and Themes pages have been posting
// to since V3 without anything answering: /api/stories handled only
// create|list|load|update|delete|continue|extend, so both pages 400'd on every
// request and swallowed the error.

import { join } from "path";
import { execBaselineSchema } from "../helpers/baseline-db";
import { applyRecroomLibraryMigration } from "@/lib/db/apply-recroom-library-migration";

let testDb: import("better-sqlite3").Database | null = null;

jest.mock("@/lib/db", () => ({
  getDb: () => testDb!,
  now: () => new Date().toISOString(),
  ensureDb: () => undefined,
}));

import {
  createCharacter,
  createTheme,
  deleteCharacter,
  deleteTheme,
  getCharacter,
  listCharacters,
  listThemes,
  updateCharacter,
  updateTheme,
} from "@/modules/rec-room/lib/library-repository";

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

const character = (over: Partial<Parameters<typeof createCharacter>[0]> = {}) => ({
  name: "Vex",
  role: "Antagonist",
  description: "A retired courier who knows too much.",
  personality: ["wary", "dry"],
  backstory: "Ran the outer routes for a decade.",
  appearance: "Weathered flight jacket.",
  speechPatterns: "Clipped. Rarely finishes a sentence.",
  relationships: "Owes Dax a favour.",
  tags: ["noir", "sci-fi"],
  ...over,
});

const theme = (over: Partial<Parameters<typeof createTheme>[0]> = {}) => ({
  name: "Rain-slick Orbital",
  premise: "A station where it always rains, and nobody asks why.",
  genre: ["noir", "sci-fi"],
  era: "far future",
  setting: "orbital station",
  mood: ["melancholy", "tense"],
  notes: "Keep the weather as a character.",
  ...over,
});

beforeEach(() => {
  // jest.config maps `better-sqlite3` to a stub, so reach the real driver by its
  // inner path (the same trick artifacts-repository.test.ts uses).
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(
    ":memory:",
  );
  execBaselineSchema(testDb!);
  applyRecroomLibraryMigration(testDb!, migrationsDir);
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe("character library", () => {
  it("round-trips every field, including the JSON list columns", () => {
    const created = createCharacter(character());
    const fetched = getCharacter(created.id);
    expect(fetched).toEqual(created);
    expect(fetched!.personality).toEqual(["wary", "dry"]);
    expect(fetched!.tags).toEqual(["noir", "sci-fi"]);
    expect(fetched!.speechPatterns).toBe("Clipped. Rarely finishes a sentence.");
  });

  it("lists alphabetically, case-insensitively", () => {
    createCharacter(character({ name: "zara" }));
    createCharacter(character({ name: "Ada" }));
    createCharacter(character({ name: "mo" }));
    expect(listCharacters().map((c) => c.name)).toEqual(["Ada", "mo", "zara"]);
  });

  it("updates in place and keeps the id", () => {
    const created = createCharacter(character());
    const updated = updateCharacter(created.id, character({ name: "Vex the Elder", tags: ["noir"] }));
    expect(updated!.id).toBe(created.id);
    expect(updated!.name).toBe("Vex the Elder");
    expect(updated!.tags).toEqual(["noir"]);
    expect(listCharacters()).toHaveLength(1);
  });

  it("soft-deletes: gone from the list, and not resurrected by update", () => {
    const created = createCharacter(character());
    expect(deleteCharacter(created.id)).toBe(true);
    expect(listCharacters()).toEqual([]);
    expect(getCharacter(created.id)).toBeNull();
    expect(updateCharacter(created.id, character())).toBeNull();
    expect(deleteCharacter(created.id)).toBe(false);
  });

  it("returns null rather than throwing for an unknown id", () => {
    expect(getCharacter("nope")).toBeNull();
    expect(updateCharacter("nope", character())).toBeNull();
    expect(deleteCharacter("nope")).toBe(false);
  });

  it("tolerates empty list fields", () => {
    const created = createCharacter(character({ personality: [], tags: [] }));
    expect(created.personality).toEqual([]);
    expect(created.tags).toEqual([]);
  });
});

describe("theme library", () => {
  it("round-trips every field", () => {
    const created = createTheme(theme());
    const [fetched] = listThemes();
    expect(fetched).toEqual(created);
    expect(fetched.genre).toEqual(["noir", "sci-fi"]);
    expect(fetched.mood).toEqual(["melancholy", "tense"]);
  });

  it("updates and soft-deletes", () => {
    const created = createTheme(theme());
    expect(updateTheme(created.id, theme({ name: "Dry Orbital", mood: [] }))!.name).toBe("Dry Orbital");
    expect(listThemes()[0].mood).toEqual([]);
    expect(deleteTheme(created.id)).toBe(true);
    expect(listThemes()).toEqual([]);
    expect(deleteTheme(created.id)).toBe(false);
  });

  it("keeps characters and themes in separate stores", () => {
    createCharacter(character());
    createTheme(theme());
    expect(listCharacters()).toHaveLength(1);
    expect(listThemes()).toHaveLength(1);
    deleteCharacter(listCharacters()[0].id);
    expect(listThemes()).toHaveLength(1);
  });
});
