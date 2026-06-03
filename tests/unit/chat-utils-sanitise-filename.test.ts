/**
 * Tests for the `sanitiseFilename` helper in `@/lib/chat-utils`.
 *
 * History: the chat page's `handleDownloadSession` previously inlined
 * `s.title.replace(/[^a-zA-Z0-9_-]/g, "_")` to slugify the session title
 * into a filename. Session 104 promoted the inline regex to a named
 * helper in `@/lib/chat-utils` so any future "export as Markdown" or
 * "export as PDF" feature can reuse the same slug rule. These tests
 * lock the helper's shape and the rule (replace non-`[A-Za-z0-9_-]`
 * with `_`).
 */
import { sanitiseFilename } from "@/lib/chat-utils";

describe("chat-utils — sanitiseFilename", () => {
  it("replaces whitespace with underscores", () => {
    expect(sanitiseFilename("My Chat Session")).toBe("My_Chat_Session");
  });

  it("replaces punctuation with underscores", () => {
    expect(sanitiseFilename("a.b,c!d?e")).toBe("a_b_c_d_e");
  });

  it("preserves letters, digits, underscores, and hyphens verbatim", () => {
    expect(sanitiseFilename("Hello-world_42")).toBe("Hello-world_42");
  });

  it("replaces non-ASCII characters with underscores (the slug is ASCII-only)", () => {
    // The regex `[^a-zA-Z0-9_-]` excludes all non-ASCII characters
    // (accents, emoji, CJK, etc.), so a session titled "café 🚀" slugs
    // to `caf____`. The slug is intentionally ASCII-safe for filenames
    // across all major filesystems (no UTF-8, no length-beyond-255
    // complications). This is a documented quirk, not a bug — the test
    // locks the current behavior so a future "normalise Unicode" or
    // "NFD-decompose accents" extension is a deliberate change.
    expect(sanitiseFilename("café 🚀")).toBe("caf____");
  });

  it("returns the input unchanged when it is already filename-safe", () => {
    expect(sanitiseFilename("safe_title-123")).toBe("safe_title-123");
  });

  it("returns an empty string when given an empty string", () => {
    expect(sanitiseFilename("")).toBe("");
  });

  it("replaces every unsafe character (not just the first)", () => {
    expect(sanitiseFilename("a b c d e")).toBe("a_b_c_d_e");
  });

  it("preserves the slug shape the chat page already used (regex byte-equivalent)", () => {
    // The pre-refactor inline code was
    //   `s.title.replace(/[^a-zA-Z0-9_-]/g, "_")`
    // which is exactly what the helper does. The test below proves
    // the helper produces the same output for a representative
    // session title that the chat page would slug.
    const title = "Research: Quantum Computing 2024 (v2)";
    const expected = "Research__Quantum_Computing_2024__v2_";
    expect(sanitiseFilename(title)).toBe(expected);
  });
});
