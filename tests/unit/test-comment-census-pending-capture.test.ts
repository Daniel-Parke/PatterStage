/** @jest-environment node */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { commentCensusFixture } from "../helpers/comment-census-fixture";

it("refuses baseline recapture before the initial capture is committed", () => {
  const root = join(__dirname, "..", "..");
  const f = commentCensusFixture(root, "pending-capture");
  const existing = "export const existing = true;\n";
  writeFileSync(join(f.root, "tests/unit/existing.test.ts"), existing);
  f.git("add", ".");
  f.git("commit", "--quiet", "-m", "Owned initial source");
  const initialHead = f.git("rev-parse", "HEAD").trim();
  expect(f.census("--capture", "--reason", "Independent pending capture fixture").status).toBe(0);
  const initialBytes = readFileSync(join(f.root, f.baseline), "utf8");
  expect(f.git("ls-tree", "-r", "--name-only", "HEAD", "--", f.baseline).trim()).toBe("");
  const essay = Array.from({ length: 60 }, (_, index) => index < 24 ? `// rationale ${index}` : `const value${index} = ${index};`).join("\n") + "\n";
  writeFileSync(join(f.root, "tests/unit/planted.test.ts"), essay);
  const recapture = f.census("--capture", "--reason", "Attempt to replace pending capture");
  expect({
    refused: recapture.status !== 0,
    baselineUnchanged: readFileSync(join(f.root, f.baseline), "utf8") === initialBytes,
    sourceUnchanged: readFileSync(join(f.root, "tests/unit/existing.test.ts"), "utf8") === existing && readFileSync(join(f.root, "tests/unit/planted.test.ts"), "utf8") === essay,
    head: f.git("rev-parse", "HEAD").trim(),
  }).toEqual({ refused: true, baselineUnchanged: true, sourceUnchanged: true, head: initialHead });
}, 30_000);
