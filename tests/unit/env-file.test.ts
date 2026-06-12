/** @jest-environment node */

// Tests for `parseEnvFile` and the `ENV_LINE_RE` regex in
// `src/lib/env-file.ts`. The helper was promoted from a private function
// in `src/lib/hermes-config-sync.ts` (where it was used by
// `syncCredentialToHermesEnv` and `removeCredentialFromHermesEnv`) and
// is now also consumed by `src/lib/hermes-import.ts:parseEnvCredentials`.
// The two pre-refactor sites used the same regex independently; the
// shared helper guarantees the skip rules stay in lockstep.
//
// The test cases are chosen to cover the four branches of the parser
// (keyval / blank / comment / invalid) plus the pre-refactor edge cases
// the original sites had to defend against (CRLF, leading whitespace,
// value with `=`, duplicate keys).

import { parseEnvFile, ENV_LINE_RE } from "@/lib/env-file";

describe("parseEnvFile", () => {
  it("returns an empty Map for empty input", () => {
    expect(parseEnvFile("").size).toBe(0);
  });

  it("parses a single key=value line", () => {
    const m = parseEnvFile("FOO=bar");
    expect(m.size).toBe(1);
    expect(m.get("FOO")).toBe("bar");
  });

  it("parses multiple key=value lines, preserving order", () => {
    const m = parseEnvFile("FOO=bar\nBAZ=qux\nQUUX=zip");
    expect(m.size).toBe(3);
    expect(Array.from(m.entries())).toEqual([
      ["FOO", "bar"],
      ["BAZ", "qux"],
      ["QUUX", "zip"],
    ]);
  });

  it("skips blank lines", () => {
    const m = parseEnvFile("FOO=bar\n\n\nBAZ=qux");
    expect(m.size).toBe(2);
    expect(m.get("FOO")).toBe("bar");
    expect(m.get("BAZ")).toBe("qux");
  });

  it("skips lines that are whitespace-only (after trim)", () => {
    const m = parseEnvFile("FOO=bar\n   \n\t\nBAZ=qux");
    expect(m.size).toBe(2);
    expect(m.get("FOO")).toBe("bar");
    expect(m.get("BAZ")).toBe("qux");
  });

  it("skips comment lines (starting with `#`)", () => {
    const m = parseEnvFile("# this is a comment\nFOO=bar\n# another comment\nBAZ=qux");
    expect(m.size).toBe(2);
    expect(m.get("FOO")).toBe("bar");
    expect(m.get("BAZ")).toBe("qux");
  });

  it("skips lines without an `=` (malformed)", () => {
    const m = parseEnvFile("FOO=bar\nMALFORMED_LINE\nBAZ=qux");
    expect(m.size).toBe(2);
    expect(m.has("MALFORMED_LINE")).toBe(false);
  });

  it("skips lines where the key is not a valid identifier", () => {
    // The regex requires `[A-Za-z_][A-Za-z0-9_]*` — keys starting with
    // a digit or containing `-` are rejected.
    const m = parseEnvFile("1FOO=bar\nF-O=bar\nOK_KEY=good");
    expect(m.size).toBe(1);
    expect(m.get("OK_KEY")).toBe("good");
  });

  it("trims leading/trailing whitespace from each line before matching", () => {
    // The pre-refactor inline code called `line.trim()` per line, so
    // a line like `  FOO=bar  ` is matched as `FOO=bar`. The helper
    // preserves that behaviour.
    const m = parseEnvFile("  FOO=bar  \n\tBAZ=qux\t");
    expect(m.size).toBe(2);
    expect(m.get("FOO")).toBe("bar");
    expect(m.get("BAZ")).toBe("qux");
  });

  it("captures the value verbatim (no quote stripping at this layer)", () => {
    // The sibling `env-line.ts:parseEnvLine` strips surrounding quotes
    // for the UI preview. `parseEnvFile` is a lower-level helper that
    // returns the raw value so the sync/import code can decide
    // whether/how to interpret it.
    const m = parseEnvFile(`FOO="bar baz"\nBAZ='qux quux'`);
    expect(m.get("FOO")).toBe('"bar baz"');
    expect(m.get("BAZ")).toBe("'qux quux'");
  });

  it("captures values that contain `=` (everything after the first `=`, regex is non-greedy on key)", () => {
    // The regex captures the key as the first `=`-delimited token and
    // the value as `.*` (everything else). A value like `key=a=b=c` is
    // captured as `a=b=c` (the `=` after the first is part of the value).
    const m = parseEnvFile("FOO=a=b=c");
    expect(m.get("FOO")).toBe("a=b=c");
  });

  it("captures empty values (key with no value after `=`)", () => {
    const m = parseEnvFile("FOO=\nBAR=actual");
    expect(m.size).toBe(2);
    expect(m.get("FOO")).toBe("");
    expect(m.get("BAR")).toBe("actual");
  });

  it("supports CRLF line endings (Windows)", () => {
    const m = parseEnvFile("FOO=bar\r\nBAZ=qux\r\n");
    expect(m.size).toBe(2);
    expect(m.get("FOO")).toBe("bar");
    expect(m.get("BAZ")).toBe("qux");
  });

  it("supports mixed LF and CRLF line endings", () => {
    const m = parseEnvFile("FOO=bar\r\nBAZ=qux\nQUUX=zip\r\n");
    expect(m.size).toBe(3);
    expect(m.get("FOO")).toBe("bar");
    expect(m.get("BAZ")).toBe("qux");
    expect(m.get("QUUX")).toBe("zip");
  });

  it("last write wins for duplicate keys (matches Map.set semantics)", () => {
    // The pre-refactor inline code called `out.set(key, value)` per
    // match, so a duplicate key overwrote the earlier value. The
    // shared helper preserves that behaviour.
    const m = parseEnvFile("FOO=first\nFOO=second");
    expect(m.size).toBe(1);
    expect(m.get("FOO")).toBe("second");
  });

  it("captures empty values when the value is whitespace-only after line trim", () => {
    // The shared parser calls `line.trim()` per line, which removes
    // leading/trailing whitespace from the LINE (not the value). So
    // `FOO=   ` becomes `FOO=` after line trim, and the captured
    // value is `""`. The pre-refactor inline code did the same
    // (both `hermes-config-sync.ts:parseEnvFile` and
    // `hermes-import.ts:parseEnvCredentials` called `line.trim()`
    // per line, then split on `=`). This test pins that contract.
    const m = parseEnvFile("FOO=   ");
    expect(m.get("FOO")).toBe("");
  });

  it("preserves the value whitespace when the key is also surrounded by leading whitespace (i.e. trim is per-line, not per-field)", () => {
    // This is the OPPOSITE case from the one above: the line `  FOO=bar  `
    // is trimmed to `FOO=bar`, so the captured value is `bar` (no trailing
    // whitespace). The per-line trim normalises both sides of the `=`.
    const m = parseEnvFile("  FOO=bar  ");
    expect(m.get("FOO")).toBe("bar");
  });

  it("preserves the original line content as the value (no shell expansion or escape handling)", () => {
    // The shared helper is a literal parser — no expansion of `$VAR`,
    // no escaping of `\\n`, no `~`-expansion. The pre-refactor inline
    // code matched this byte-for-byte (both files used the same
    // `key=value` regex with no post-processing).
    const m = parseEnvFile(`FOO=$BAR\nBAZ=hello\\nworld`);
    expect(m.get("FOO")).toBe("$BAR");
    expect(m.get("BAZ")).toBe("hello\\nworld");
  });
});

describe("ENV_LINE_RE", () => {
  it("matches a simple key=value", () => {
    const m = ENV_LINE_RE.exec("FOO=bar");
    expect(m).not.toBeNull();
    expect(m![1]).toBe("FOO");
    expect(m![2]).toBe("bar");
  });

  it("does not match a line without `=`", () => {
    expect(ENV_LINE_RE.exec("FOObar")).toBeNull();
  });

  it("does not match a line whose key starts with a digit", () => {
    expect(ENV_LINE_RE.exec("1FOO=bar")).toBeNull();
  });

  it("does not match a line whose key contains a hyphen", () => {
    // Hyphens are not in the `[A-Za-z0-9_]*` character class.
    expect(ENV_LINE_RE.exec("F-O=bar")).toBeNull();
  });

  it("matches an underscore-prefixed key", () => {
    const m = ENV_LINE_RE.exec("_FOO=bar");
    expect(m).not.toBeNull();
    expect(m![1]).toBe("_FOO");
  });

  it("captures the value as everything after the first `=` (the regex is non-greedy on the key side)", () => {
    const m = ENV_LINE_RE.exec("FOO=a=b=c");
    expect(m).not.toBeNull();
    expect(m![1]).toBe("FOO");
    expect(m![2]).toBe("a=b=c");
  });
});
