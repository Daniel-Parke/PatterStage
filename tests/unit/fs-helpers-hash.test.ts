/** @jest-environment node */
// SHA-256 helpers promoted from hermes-profile-sync into fs-helpers.

import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createHash } from "crypto";
import { contentHash, fileHash } from "@/lib/fs/fs-helpers";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

describe("contentHash", () => {
  it("matches a reference sha256 hex digest", () => {
    expect(contentHash("hello world")).toBe(sha("hello world"));
  });
  it("is deterministic and differs for different content", () => {
    expect(contentHash("a")).toBe(contentHash("a"));
    expect(contentHash("a")).not.toBe(contentHash("b"));
  });
});

describe("fileHash", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "fs-helpers-hash-"));
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns null for a missing file", () => {
    expect(fileHash(join(dir, "nope.txt"))).toBeNull();
  });

  it("hashes file content equal to contentHash of that content", () => {
    const p = join(dir, "f.txt");
    writeFileSync(p, "payload", "utf-8");
    expect(fileHash(p)).toBe(contentHash("payload"));
  });
});
