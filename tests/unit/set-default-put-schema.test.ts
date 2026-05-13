/** @jest-environment node */

/**
 * Tests for setDefaultPutSchema — verifies the required fields
 * for setting model defaults are present in the Zod schema.
 */

import { readFileSync } from "fs";
import { join } from "path";

const repoRoot = join(__dirname, "..", "..");

describe("setDefaultPutSchema validates required fields", () => {
  it("schema file exists", () => {
    const p = join(repoRoot, "src", "lib", "api-schemas.ts");
    expect(readFileSync(p, "utf-8")).toBeTruthy();
  });

  test("required taskType field present in schema block", () => {
    const p = join(repoRoot, "src", "lib", "api-schemas.ts");
    const content = readFileSync(p, "utf-8");
    const startIdx = content.indexOf("export const setDefaultPutSchema");
    expect(startIdx).toBeGreaterThan(-1);
    const slice = content.slice(startIdx, startIdx + 300);
    expect(slice).toContain("taskType: taskTypeSchema");
  });

  test("required modelId field present in schema block", () => {
    const p = join(repoRoot, "src", "lib", "api-schemas.ts");
    const content = readFileSync(p, "utf-8");
    const startIdx = content.indexOf("export const setDefaultPutSchema");
    expect(startIdx).toBeGreaterThan(-1);
    const slice = content.slice(startIdx, startIdx + 300);
    expect(slice).toContain("modelId: z.string().nullable()");
  });

  test("schema uses .strict() to reject unknown fields", () => {
    const p = join(repoRoot, "src", "lib", "api-schemas.ts");
    const content = readFileSync(p, "utf-8");
    const startIdx = content.indexOf("export const setDefaultPutSchema");
    expect(startIdx).toBeGreaterThan(-1);
    const slice = content.slice(startIdx, startIdx + 300);
    expect(slice).toContain(".strict()");
  });
});
