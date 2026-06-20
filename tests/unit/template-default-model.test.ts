import { readFileSync } from "fs";
import { join } from "path";

const packPath = join(
  __dirname,
  "..",
  "..",
  "data/seed/template-packs/patterstage-professional-v1.json",
);

describe("professional template pack", () => {
  const raw = JSON.parse(readFileSync(packPath, "utf-8"));

  it("omits explicit defaultModel on catalog entries", () => {
    const templates = raw.templates as Array<Record<string, unknown>>;
    expect(templates.length).toBeGreaterThan(0);
    for (const t of templates) {
      expect(t.defaultModel).toBeUndefined();
      expect(t.defaultProvider).toBeUndefined();
    }
  });
});
