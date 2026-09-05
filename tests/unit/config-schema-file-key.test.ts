/** @jest-environment node */

// Tests for the fileKeyForFilePath helper in src/lib/config-schema.ts.
// This helper maps a SectionDef's `filePath` (e.g. ".env") to the file
// key used by /api/agent/files/[key] (e.g. "env"). The mapping mirrors
// the keys in behavior-files.ts (src/lib/behavior-files.ts) so the
// two file sections in this schema (framework_md, env) and any future
// file sections stay in sync with the behavior-files key namespace.

import { fileKeyForFilePath } from "@/lib/config-schema";

describe("fileKeyForFilePath", () => {
  it("maps '.env' to the 'env' file key (matches behavior-files.env)", () => {
    expect(fileKeyForFilePath(".env")).toBe("env");
  });

  it("maps 'HERMES.md' to the 'hermes' file key (matches behavior-files.hermes)", () => {
    expect(fileKeyForFilePath("HERMES.md")).toBe("hermes");
  });

  it("falls back to 'hermes' for any non-.env file path (current default)", () => {
    // The two existing file sections in CONFIG_SECTIONS both resolve to
    // either "env" or "hermes"; this guards the default branch so any
    // future file section that doesn't match ".env" still routes to a
    // valid behavior-files key.
    expect(fileKeyForFilePath("AGENTS.md")).toBe("hermes");
    expect(fileKeyForFilePath("SOUL.md")).toBe("hermes");
  });
});
