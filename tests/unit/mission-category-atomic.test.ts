/** @jest-environment node */
/* Jest hoists the database mock. */

import * as fs from "fs";
import { tmpdir } from "os";
import { join, resolve, sep } from "path";
import { openBaselineDb } from "../helpers/baseline-db";

let testDb: import("better-sqlite3").Database | null = null;
let templateDir = "";
let mockArmTemplateWriteFailure = false;
let mockTemplateWriteAttempts = 0;
let mockFailedWriteAttempts = 0;

jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => testDb));
jest.mock("@/lib/host/paths", () => ({ PATHS: { get templates() { return templateDir; } } }));
jest.mock("fs", () => {
  const actual = jest.requireActual("fs") as typeof import("fs");
  return {
    ...actual,
    writeFileSync: (...args: Parameters<typeof actual.writeFileSync>) => {
      if (mockArmTemplateWriteFailure && resolve(String(args[0])).startsWith(resolve(templateDir) + sep)) {
        mockTemplateWriteAttempts += 1;
        if (mockTemplateWriteAttempts === 2) {
          mockFailedWriteAttempts += 1;
          throw new Error("Injected template write failure");
        }
      }
      return actual.writeFileSync(...args);
    },
  };
});

import { deleteCategory, getCategory } from "@/lib/missions/mission-category-repository";

type CategoryState = {
  category: Record<string, unknown> | undefined;
  mission: Record<string, unknown> | undefined;
  catalog: Record<string, unknown> | undefined;
  files: Record<string, Buffer>;
};

function seedCategoryData(): void {
  for (const [id, name] of [
    ["source", "Source"],
    ["target", "Target"],
    ["other", "Other"],
  ]) {
    testDb!.prepare("INSERT INTO mission_categories (id, name) VALUES (?, ?)").run(id, name);
  }
  testDb!.prepare("INSERT INTO missions (id, name, prompt, category_id) VALUES (?, ?, ?, ?)")
    .run("mission-1", "Mission", "Original prompt", "source");
  testDb!.prepare("INSERT INTO catalog_templates (id, name, category_id) VALUES (?, ?, ?)")
    .run("catalog-1", "Catalogue", "source");
}

function writeTemplate(name: string, value: Record<string, unknown>): string {
  const path = join(templateDir, `${name}.json`);
  fs.writeFileSync(path, JSON.stringify(value, null, 2), "utf-8");
  return path;
}

function readTemplate(name: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(join(templateDir, `${name}.json`), "utf-8")) as Record<string, unknown>;
}

function currentState(): CategoryState {
  const files: Record<string, Buffer> = {};
  for (const name of fs.readdirSync(templateDir).sort()) {
    files[name] = fs.readFileSync(join(templateDir, name));
  }
  return {
    category: testDb!.prepare("SELECT * FROM mission_categories WHERE id = 'source'").get() as Record<string, unknown> | undefined,
    mission: testDb!.prepare("SELECT * FROM missions WHERE id = 'mission-1'").get() as Record<string, unknown> | undefined,
    catalog: testDb!.prepare("SELECT * FROM catalog_templates WHERE id = 'catalog-1'").get() as Record<string, unknown> | undefined,
    files,
  };
}

beforeEach(() => {
  testDb = openBaselineDb();
  templateDir = fs.mkdtempSync(join(tmpdir(), "patterstage-t0184-category-"));
  mockArmTemplateWriteFailure = false;
  mockTemplateWriteAttempts = 0;
  mockFailedWriteAttempts = 0;
  seedCategoryData();
});

afterEach(() => {
  mockArmTemplateWriteFailure = false;
  testDb?.close();
  testDb = null;
  fs.rmSync(templateDir, { recursive: true, force: true });
});

describe("category deletion with reassignment", () => {
  it("moves mission, catalogue and matching disk references together", () => {
    writeTemplate("explicit", { name: "Explicit", categoryId: "source", category: "Source" });
    writeTemplate("legacy", { name: "Legacy", category: "Source" });

    expect(deleteCategory("source", "target")).toBe(true);

    expect(getCategory("source")).toBeNull();
    expect(testDb!.prepare("SELECT category_id FROM missions WHERE id = 'mission-1'").get())
      .toEqual({ category_id: "target" });
    expect(testDb!.prepare("SELECT category_id FROM catalog_templates WHERE id = 'catalog-1'").get())
      .toEqual({ category_id: "target" });
    expect(readTemplate("explicit")).toMatchObject({ categoryId: "target" });
    expect(readTemplate("legacy")).toMatchObject({ categoryId: "target" });
  });

  it("replaces a legacy category_id without leaving the deleted ID in the file", () => {
    writeTemplate("snake-case", { name: "Snake case", category_id: "source" });

    expect(deleteCategory("source", "target")).toBe(true);

    const template = readTemplate("snake-case");
    expect(template.categoryId ?? template.category_id).toBe("target");
    expect(Object.values(template)).not.toContain("source");
  });

  it("keeps a different explicit category ID despite matching legacy text", () => {
    const conflict = writeTemplate("conflict", {
      name: "Other category", categoryId: "other", category: "Source",
    });
    const before = fs.readFileSync(conflict);

    expect(deleteCategory("source", "target")).toBe(true);

    expect(fs.readFileSync(conflict)).toEqual(before);
    expect(readTemplate("conflict").categoryId).toBe("other");
  });

  it("refuses self-reassignment and preserves the category, rows and file bytes", () => {
    writeTemplate("source", { name: "Source template", categoryId: "source" });
    const before = currentState();

    expect(() => deleteCategory("source", "source")).toThrow();
    expect(currentState()).toEqual(before);
  });

  it("reports a template write failure and restores the category, rows and all file bytes", () => {
    writeTemplate("first", { name: "First", categoryId: "source" });
    writeTemplate("second", { name: "Second", category: "Source" });
    writeTemplate("untouched", { name: "Untouched", categoryId: "other" });
    const before = currentState();
    mockArmTemplateWriteFailure = true;

    let failure: unknown;
    try {
      deleteCategory("source", "target");
    } catch (error) {
      failure = error;
    }

    expect(mockFailedWriteAttempts).toBe(1);
    expect(failure).toBeInstanceOf(Error);
    expect(currentState()).toEqual(before);
  });

  it("reports a database write failure without changing the category, rows or files", () => {
    writeTemplate("source", { name: "Source template", categoryId: "source" });
    const before = currentState();
    testDb!.exec(`
      CREATE TRIGGER reject_catalog_move BEFORE UPDATE OF category_id ON catalog_templates
      BEGIN SELECT RAISE(ABORT, 'injected catalogue update failure'); END;
    `);

    let failure: unknown;
    try {
      deleteCategory("source", "target");
    } catch (error) {
      failure = error;
    }

    expect(failure).toHaveProperty("message", "injected catalogue update failure");
    expect(currentState()).toEqual(before);
  });
});
