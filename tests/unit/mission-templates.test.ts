import { readFileSync } from "fs";
import { join } from "path";

const packPath = join(
  __dirname,
  "..",
  "..",
  "data/seed/template-packs/patterstage-professional-v1.json",
);

describe("professional mission template pack", () => {
  const pack = JSON.parse(readFileSync(packPath, "utf-8")) as {
    templates: Array<{ id: string; outputFormat: string; constraints: string }>;
  };

  it("ships the professional template set", () => {
    expect(pack.templates.length).toBeGreaterThanOrEqual(10);
  });

  it("has unique ids", () => {
    const ids = pack.templates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes outputFormat and constraints on every template", () => {
    for (const t of pack.templates) {
      expect(t.outputFormat.length).toBeGreaterThan(0);
      expect(t.constraints.length).toBeGreaterThan(0);
    }
  });
});
