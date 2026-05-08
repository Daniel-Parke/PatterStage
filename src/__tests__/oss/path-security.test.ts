/** @jest-environment node */
import { resolveSafeProfileName } from "@/lib/path-security";

describe("resolveSafeProfileName", () => {
  it("returns 'default' for null input", () => {
    const r = resolveSafeProfileName(null);
    expect(r).toEqual({ ok: true, profile: "default" });
  });

  it("returns 'default' for empty string", () => {
    const r = resolveSafeProfileName("");
    expect(r).toEqual({ ok: true, profile: "default" });
  });

  it("returns 'default' for the literal string 'default'", () => {
    const r = resolveSafeProfileName("default");
    expect(r).toEqual({ ok: true, profile: "default" });
  });

  it("accepts valid alphanumeric profile names", () => {
    expect(resolveSafeProfileName("qa-engineer")).toEqual({ ok: true, profile: "qa-engineer" });
    expect(resolveSafeProfileName("devops-engineer")).toEqual({ ok: true, profile: "devops-engineer" });
    expect(resolveSafeProfileName("my-agent")).toEqual({ ok: true, profile: "my-agent" });
    expect(resolveSafeProfileName("agent123")).toEqual({ ok: true, profile: "agent123" });
  });

  it("accepts names with underscores", () => {
    expect(resolveSafeProfileName("my_agent")).toEqual({ ok: true, profile: "my_agent" });
  });

  it("rejects names with path traversal", () => {
    const r = resolveSafeProfileName("../etc");
    expect(r.ok).toBe(false);
  });

  it("rejects names with slashes", () => {
    expect(resolveSafeProfileName("foo/bar").ok).toBe(false);
    expect(resolveSafeProfileName("foo\\bar").ok).toBe(false);
  });

  it("rejects names starting with hyphen", () => {
    expect(resolveSafeProfileName("-bad").ok).toBe(false);
  });

  it("treats whitespace-only input as 'default'", () => {
    const r = resolveSafeProfileName("   ");
    expect(r).toEqual({ ok: true, profile: "default" });
  });

  it("rejects names exceeding 128 chars", () => {
    const long = "a".repeat(129);
    expect(resolveSafeProfileName(long).ok).toBe(false);
  });

  it("accepts names at exactly 128 chars", () => {
    const max = "a".repeat(128);
    expect(resolveSafeProfileName(max)).toEqual({ ok: true, profile: max });
  });

  it("accepts dot-prefixed profile names like .Retired", () => {
    expect(resolveSafeProfileName(".Retired")).toEqual({ ok: true, profile: ".Retired" });
    expect(resolveSafeProfileName(".retired")).toEqual({ ok: true, profile: ".retired" });
  });

  it("rejects dot-prefixed names exceeding 127 chars", () => {
    const long = ".a".repeat(64); // ".a" * 64 = 128 chars total
    expect(resolveSafeProfileName(long).ok).toBe(false);
  });
});
