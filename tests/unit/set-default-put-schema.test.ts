/** @jest-environment node */

/**
 * Tests for setDefaultPutSchema — verifies the framework field was added
 * to the Zod schema to fix bulk auxiliary update failures.
 */

import { readFileSync } from "fs";
import { join } from "path";

const repoRoot = join(__dirname, "..", "..");

describe("setDefaultPutSchema accepts framework field", () => {
  it("schema file exists", () => {
    const p = join(repoRoot, "src", "lib", "api-schemas.ts");
    expect(readFileSync(p, "utf-8")).toBeTruthy();
  });

  test("framework field present in schema block", () => {
    const p = join(repoRoot, "src", "lib", "api-schemas.ts");
    const content = readFileSync(p, "utf-8");
    // Check that framework: z.string().optional() appears
    // between setDefaultPutSchema and the closing strict()
    const startIdx = content.indexOf("export const setDefaultPutSchema");
    expect(startIdx).toBeGreaterThan(-1);
    const slice = content.slice(startIdx, startIdx + 300);
    expect(slice).toContain("framework: z.string().optional()");
    expect(slice).toContain(".strict()");
  });

  test("required fields taskType and modelId still present", () => {
    const p = join(repoRoot, "src", "lib", "api-schemas.ts");
    const content = readFileSync(p, "utf-8");
    const startIdx = content.indexOf("export const setDefaultPutSchema");
    const slice = content.slice(startIdx, startIdx + 300);
    expect(slice).toContain("taskType: taskTypeSchema");
    expect(slice).toContain("modelId: z.string().nullable()");
  });
});
