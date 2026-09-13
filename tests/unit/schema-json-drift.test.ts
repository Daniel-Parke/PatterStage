// Drift gate for the JSON Schemas that leave the repository.
//
// src/lib/schema/json/*.schema.json are generated from Zod and committed.
// `npm run generate:schema-json` ran in no gate, so a Zod edit could ship while
// the published schema still described the old shape, and nothing anywhere
// would go red. This test regenerates both files in-process and fails on a
// diff, which is acceptance (1) of T-0015 and the commit-and-gate half of
// ADR-0002 decision 1.
//
// A jest test rather than a workflow step: it runs in every job that runs the
// suite, needs no CI edit, and fails the same way on a developer's machine.
//
// When this fails, the fix is `npm run generate:schema-json` and commit the
// result. Regenerating is only correct if the Zod change was intended; the
// schemas are a published contract, so a surprise diff here is a question to
// answer, not a file to overwrite.

import { readFileSync } from "fs";
import { join } from "path";

import { buildSchemaJsonArtefacts } from "@/lib/schema/generate";

const JSON_DIR = join(__dirname, "..", "..", "src", "lib", "schema", "json");

describe("committed JSON Schemas match their Zod sources", () => {
  const artefacts = buildSchemaJsonArtefacts();

  it("generates exactly the files that are committed", () => {
    expect(Object.keys(artefacts).sort()).toEqual([
      "mission-v1.schema.json",
      "template-pack-v1.schema.json",
    ]);
  });

  it.each(Object.keys(artefacts))(
    "%s is current (if this fails, run npm run generate:schema-json)",
    (name) => {
      // The repo stores and checks out LF (.gitattributes `* text=auto eol=lf`)
      // and the generator writes LF, so this is a byte comparison on both sides.
      const committed = readFileSync(join(JSON_DIR, name), "utf8");
      expect(committed).toBe(artefacts[name]);
    },
  );
});
