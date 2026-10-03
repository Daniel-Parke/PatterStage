/** @jest-environment node */

import * as fs from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { openBaselineDb } from "../helpers/baseline-db";
import type { TemplateLike } from "@/lib/missions/mission-categories";

let testDb: import("better-sqlite3").Database | null = null;
let templateDir = "";
let mockReadFailurePath = "";
let mockReadFailureArmed = false;
let mockReadFailureCount = 0;

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest hoists this database mock.
jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => testDb));
jest.mock("@/lib/host/paths", () => ({ PATHS: { get templates() { return templateDir; } } }));
jest.mock("fs", () => {
  const actual = jest.requireActual("fs") as typeof import("fs");
  return {
    ...actual,
    readFileSync: (...args: Parameters<typeof actual.readFileSync>) => {
      if (mockReadFailureArmed && resolve(String(args[0])) === resolve(mockReadFailurePath)) {
        mockReadFailureCount += 1;
        throw Object.assign(new Error("Injected template read EIO"), {
          code: "EIO",
          syscall: "read",
          path: mockReadFailurePath,
        });
      }
      return actual.readFileSync(...args);
    },
  };
});

beforeEach(() => {
  jest.resetModules();
  testDb = openBaselineDb();
  templateDir = fs.mkdtempSync(join(tmpdir(), "patterstage-t0184-final-"));
  mockReadFailurePath = "";
  mockReadFailureArmed = false;
  mockReadFailureCount = 0;
  for (const [id, name] of [["source", "Source"], ["target", "Target"]]) {
    testDb.prepare("INSERT INTO mission_categories (id, name) VALUES (?, ?)").run(id, name);
  }
});

afterEach(() => {
  mockReadFailureArmed = false;
  testDb?.close();
  testDb = null;
  fs.rmSync(templateDir, { recursive: true, force: true });
});

describe("final category boundaries", () => {
  it("reports a matching template read failure and preserves category, database references and file bytes", async () => {
    testDb!.prepare("INSERT INTO missions (id, name, prompt, category_id) VALUES (?, ?, ?, ?)")
      .run("mission-1", "Mission", "Run", "source");
    testDb!.prepare("INSERT INTO catalog_templates (id, name, category_id) VALUES (?, ?, ?)")
      .run("catalog-1", "Catalogue", "source");
    const templatePath = join(templateDir, "source-template.json");
    const originalBytes = Buffer.from(
      '{\r\n  "id": "ct_source",\r\n  "name": "Source template",\r\n  "categoryId": "source",\r\n  "category": "Source"\r\n}\r\n',
      "utf-8",
    );
    fs.writeFileSync(templatePath, originalBytes);
    const before = {
      category: testDb!.prepare("SELECT * FROM mission_categories WHERE id = 'source'").get(),
      mission: testDb!.prepare("SELECT * FROM missions WHERE id = 'mission-1'").get(),
      catalog: testDb!.prepare("SELECT * FROM catalog_templates WHERE id = 'catalog-1'").get(),
      bytes: fs.readFileSync(templatePath),
    };
    mockReadFailurePath = templatePath;
    mockReadFailureArmed = true;
    const { deleteCategory } = await import("@/lib/missions/mission-category-repository");

    let failure: unknown;
    try {
      deleteCategory("source", "target");
    } catch (error) {
      failure = error;
    } finally {
      mockReadFailureArmed = false;
    }

    expect(mockReadFailureCount).toBeGreaterThan(0);
    expect(failure).toHaveProperty("message", "Injected template read EIO");
    expect({
      category: testDb!.prepare("SELECT * FROM mission_categories WHERE id = 'source'").get(),
      mission: testDb!.prepare("SELECT * FROM missions WHERE id = 'mission-1'").get(),
      catalog: testDb!.prepare("SELECT * FROM catalog_templates WHERE id = 'catalog-1'").get(),
      bytes: fs.readFileSync(templatePath),
    }).toEqual(before);
  });

  it("groups an explicit null category as Uncategorized despite stale legacy text and retains absent-ID fallback", async () => {
    const { groupTemplatesByCategory } = await import("@/lib/missions/mission-categories");
    const explicitNull = {
      id: "explicit-null", name: "Uncategorized", categoryId: null, category: "Source",
    } as unknown as TemplateLike;
    const legacy = { id: "legacy", name: "Legacy", category: "Source" };

    const groups = groupTemplatesByCategory(
      [explicitNull, legacy],
      [{ id: "source", name: "Source", color: "cyan" }],
    );

    expect(groups.find((group) => group.categoryId === "source")?.items.map((item) => item.id))
      .toEqual(["legacy"]);
    expect(groups.find((group) => group.categoryId === null)?.items.map((item) => item.id))
      .toEqual(["explicit-null"]);
  });
});
