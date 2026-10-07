/** @jest-environment node */
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { commentCensusFixture } from "../helpers/comment-census-fixture";

it("refuses baseline recapture after working deletion when HEAD already contains the initial capture", () => {
  const root = join(__dirname, "..", "..");
  const f = commentCensusFixture(root, "history");
  writeFileSync(join(f.root, "tests/unit/existing.test.ts"), "export const existing = true;\n");
  f.git("add", ".");
  f.git("commit", "--quiet", "-m", "Owned initial source");
  expect(f.census("--capture", "--reason", "Independent capture history fixture").status).toBe(0);
  const initialBytes = readFileSync(join(f.root, f.baseline), "utf8");
  f.git("add", f.baseline);
  f.git("commit", "--quiet", "-m", "Owned initial captured baseline");
  const initialHead = f.git("rev-parse", "HEAD").trim();
  const essay = Array.from({ length: 60 }, (_, index) => index < 24 ? `// rationale ${index}` : `const value${index} = ${index};`).join("\n") + "\n";
  writeFileSync(join(f.root, "tests/unit/planted.test.ts"), essay);
  const check = f.census();
  expect(check.status).toBe(1);
  expect(JSON.parse(check.stdout)).toMatchObject({ baselineSource: "HEAD", violations: [{ path: "tests/unit/planted.test.ts", reason: "new" }] });
  unlinkSync(join(f.root, f.baseline));
  expect(existsSync(join(f.root, f.baseline))).toBe(false);
  const recapture = f.census("--capture", "--reason", "Attempt to replace committed history");
  expect(f.git("show", `HEAD:${f.baseline}`)).toBe(initialBytes);
  expect(readFileSync(join(f.root, "tests/unit/planted.test.ts"), "utf8")).toBe(essay);
  expect({ refused: recapture.status !== 0, recreated: existsSync(join(f.root, f.baseline)), head: f.git("rev-parse", "HEAD").trim() })
    .toEqual({ refused: true, recreated: false, head: initialHead });
}, 30_000);
