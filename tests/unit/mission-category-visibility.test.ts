/** @jest-environment node */

import * as fs from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { NextRequest } from "next/server";
import { openBaselineDb } from "../helpers/baseline-db";

let testDb: import("better-sqlite3").Database | null = null;
let templateDir = "";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest hoists this mock.
jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => testDb));
jest.mock("@/lib/host/paths", () => ({ PATHS: { get templates() { return templateDir; } } }));
jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));

type ListedTemplate = { id: string; categoryId: string | null };

function writeTemplate(name: string, fields: Record<string, unknown>): string {
  const path = join(templateDir, `${name}.json`);
  fs.writeFileSync(path, JSON.stringify({
    id: `ct_${name}`,
    name,
    instruction: "Run the mission",
    ...fields,
  }), "utf-8");
  return path;
}

async function listTemplates(): Promise<ListedTemplate[]> {
  const { GET } = await import("@/app/api/templates/route");
  const response = await GET();
  expect(response.status).toBe(200);
  const body = await response.json() as { data: { templates: ListedTemplate[] } };
  return body.data.templates;
}

function listedCategory(templates: ListedTemplate[], id: string): string | null {
  const template = templates.find((item) => item.id === id);
  expect(template).toBeDefined();
  return template!.categoryId;
}

async function postTemplate(fields: Record<string, unknown>): Promise<void> {
  const { POST } = await import("@/app/api/templates/route");
  const response = await POST(new NextRequest("http://localhost/api/templates", {
    method: "POST",
    body: JSON.stringify(fields),
  }));
  expect(response.status).toBe(200);
}

function findDiskTemplate(name: string): Record<string, unknown> {
  const templates = fs.readdirSync(templateDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => JSON.parse(fs.readFileSync(join(templateDir, file), "utf-8")) as Record<string, unknown>);
  const template = templates.find((item) => item.name === name);
  expect(template).toBeDefined();
  return template!;
}

beforeEach(() => {
  jest.resetModules();
  testDb = openBaselineDb();
  templateDir = fs.mkdtempSync(join(tmpdir(), "patterstage-t0184-visibility-"));
  for (const [id, name] of [["source", "Source"], ["target", "Target"]]) {
    testDb.prepare("INSERT INTO mission_categories (id, name) VALUES (?, ?)").run(id, name);
  }
});

afterEach(() => {
  testDb?.close();
  testDb = null;
  fs.rmSync(templateDir, { recursive: true, force: true });
});

describe("category deletion visibility", () => {
  it.each(["malformed file", "directory"])(
    "deletes an unused category despite an unrelated .json %s and preserves it",
    async (entryKind) => {
      const unrelatedPath = join(templateDir, "unrelated.json");
      const malformedBytes = Buffer.from("{invalid json\r\n", "utf-8");
      if (entryKind === "malformed file") {
        fs.writeFileSync(unrelatedPath, malformedBytes);
      } else {
        fs.mkdirSync(unrelatedPath);
      }

      const { deleteCategory, getCategory } = await import("@/lib/missions/mission-category-repository");
      expect(deleteCategory("source", null)).toBe(true);
      expect(getCategory("source")).toBeNull();
      if (entryKind === "malformed file") {
        expect(fs.readFileSync(unrelatedPath)).toEqual(malformedBytes);
      } else {
        expect(fs.statSync(unrelatedPath).isDirectory()).toBe(true);
      }
    },
  );

  it("reads an explicit Uncategorized reassignment as null and keeps an unrelated General fallback", async () => {
    const movedPath = writeTemplate("moved", { categoryId: "source", category: "Source" });
    writeTemplate("legacy", {});
    const { deleteCategory } = await import("@/lib/missions/mission-category-repository");

    expect(deleteCategory("source", null)).toBe(true);

    const disk = JSON.parse(fs.readFileSync(movedPath, "utf-8")) as Record<string, unknown>;
    expect(Object.values(disk)).not.toContain("source");
    const templates = await listTemplates();
    expect(listedCategory(templates, "ct_legacy")).toBe("general");
    expect(listedCategory(templates, "ct_moved")).toBeNull();
  });

  it("refreshes a warm template list cache after moving disk and catalogue categories", async () => {
    writeTemplate("moved", { categoryId: "source", category: "Source" });
    testDb!.prepare("INSERT INTO catalog_templates (id, name, category_id) VALUES (?, ?, ?)")
      .run("catalog-moved", "Catalogue", "source");
    const before = await listTemplates();
    expect(listedCategory(before, "ct_moved")).toBe("source");
    expect(listedCategory(before, "catalog-moved")).toBe("source");
    const { getTemplatesCached } = await import("@/lib/templates-handlers/shared");
    expect(getTemplatesCached()).not.toBeNull();
    expect(JSON.stringify(getTemplatesCached())).toContain("source");
    const { deleteCategory } = await import("@/lib/missions/mission-category-repository");

    expect(deleteCategory("source", "target")).toBe(true);

    const after = await listTemplates();
    expect(listedCategory(after, "ct_moved")).toBe("target");
    expect(listedCategory(after, "catalog-moved")).toBe("target");
  });

  it("preserves explicit Uncategorized on create while an omitted category reads as General", async () => {
    await postTemplate({ action: "create", name: "Created without category", instruction: "Run" });
    await postTemplate({ action: "create", name: "Created Uncategorized", instruction: "Run", categoryId: null });

    const omitted = findDiskTemplate("Created without category");
    const explicitNull = findDiskTemplate("Created Uncategorized");
    const templates = await listTemplates();
    expect(listedCategory(templates, String(omitted.id))).toBe("general");
    expect(explicitNull).toHaveProperty("categoryId", null);
    expect(listedCategory(templates, String(explicitNull.id))).toBeNull();
  });

  it("preserves explicit Uncategorized on update while an omitted category reads as General", async () => {
    writeTemplate("ct_legacy-update", { id: "ct_legacy-update", name: "Legacy" });
    writeTemplate("ct_explicit-update", {
      id: "ct_explicit-update", name: "Explicit", categoryId: "source", category: "Source",
    });
    await postTemplate({ action: "update", templateId: "ct_legacy-update", name: "Legacy updated" });
    await postTemplate({ action: "update", templateId: "ct_explicit-update", categoryId: null });

    const templates = await listTemplates();
    expect(listedCategory(templates, "ct_legacy-update")).toBe("general");
    const disk = JSON.parse(fs.readFileSync(join(templateDir, "ct_explicit-update.json"), "utf-8")) as Record<string, unknown>;
    expect(disk).toHaveProperty("categoryId", null);
    expect(listedCategory(templates, "ct_explicit-update")).toBeNull();
  });
});
