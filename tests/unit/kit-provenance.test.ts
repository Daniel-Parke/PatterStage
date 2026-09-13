/**
 * ADR-0003 Part 1 requires that a vendored file stays the file it was copied
 * from, and that the copy carries a PROVENANCE.md naming its source. This is
 * the half of that check CI can actually run.
 *
 * What it catches: an in-place edit of src/kit/BloomField.tsx. A vendored file
 * that someone "just tweaked" is no longer vendored, it is a fork wearing a
 * provenance record, and the record becomes a lie the moment the bytes move.
 *
 * What it does NOT catch: drift in the source repository. PatterTech_Website is
 * private and lives on one developer's filesystem, so CI cannot read it. A
 * check that quietly passes because it could not see its subject is worse than
 * no check, so this one does not pretend. Closing that half needs the source
 * reachable from CI, which is ADR-0003 Part 2.
 *
 * The SHA below is of the LF bytes, which is what the repository stores. The
 * working copy on Windows is CRLF (.gitattributes: `* text=auto eol=lf`), so
 * the test normalises before hashing rather than asserting a checkout
 * convention it does not control.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const KIT = join(ROOT, "src", "kit");

/** The recorded identity of the vendored copy. Also in src/kit/PROVENANCE.md. */
const VENDORED = {
  file: "BloomField.tsx",
  sourceRepo: "PatterTech_Website",
  sourcePath: "src/components/ui/BloomField.tsx",
  commit: "6a86bc25087e00508cb4e63a52d3a1cd9585a1b4",
  sha256Lf: "0317e253dab48d07775261b20e915f461360e5f12c76718fcfdce8a403bdfde8",
};

/** Read a file as the repository stores it: LF, no BOM. */
function readNormalised(path: string): string {
  return readFileSync(path, "utf-8").replace(/^﻿/, "").replace(/\r\n/g, "\n");
}

describe("src/kit/ vendored copies (ADR-0003 Part 1)", () => {
  it("BloomField.tsx still matches the bytes recorded in PROVENANCE.md", () => {
    const bytes = readNormalised(join(KIT, VENDORED.file));
    const sha = createHash("sha256").update(bytes, "utf-8").digest("hex");
    expect(sha).toBe(VENDORED.sha256Lf);
  });

  it("PROVENANCE.md names the source repository, path and commit of every vendored file", () => {
    const provenance = readNormalised(join(KIT, "PROVENANCE.md"));
    expect(provenance).toContain(VENDORED.file);
    expect(provenance).toContain(VENDORED.sourceRepo);
    expect(provenance).toContain(VENDORED.sourcePath);
    expect(provenance).toContain(VENDORED.commit);
    // The recorded hash has to be IN the record, not only in this test, or the
    // record cannot be checked by a human reading it.
    expect(provenance).toContain(VENDORED.sha256Lf);
  });

  it("BloomField.tsx carries no PatterStage-local edit", () => {
    const source = readNormalised(join(KIT, VENDORED.file));
    // The three things a well-meaning edit would most likely add: a repo path
    // alias, a local token, or a local import. None belong in a vendored file;
    // the component is deliberately self-contained and imports only React.
    expect(source).not.toMatch(/@\/(components|lib|kit|modules|app)\//);
    expect(source).not.toContain("--ps-");
    const imports = source.match(/^import .*$/gm) ?? [];
    expect(imports).toEqual(['import { useEffect } from "react";']);
  });
});
