import { parseEnvLine, envLineKey } from "@/lib/env-line";

describe("parseEnvLine", () => {
  it("returns 'blank' for empty string", () => {
    expect(parseEnvLine("")).toEqual({ kind: "blank" });
  });

  it("returns 'blank' for whitespace-only line", () => {
    expect(parseEnvLine("   \t  ")).toEqual({ kind: "blank" });
  });

  it("returns 'comment' for line starting with #", () => {
    expect(parseEnvLine("# this is a comment")).toEqual({
      kind: "comment",
      raw: "# this is a comment",
    });
  });

  it("returns 'comment' for whitespace-padded # line", () => {
    // The original inline parser only returned the 'comment' branch when
    // `trimmed.startsWith('#')`, so padding is fine. We preserve the
    // original raw (untrimmed) line for the comment display.
    const result = parseEnvLine("   # spaced comment");
    expect(result.kind).toBe("comment");
    if (result.kind === "comment") {
      expect(result.raw).toBe("   # spaced comment");
    }
  });

  it("returns 'invalid' for line with no '='", () => {
    expect(parseEnvLine("JUST_A_KEY_NO_VALUE")).toEqual({
      kind: "invalid",
      raw: "JUST_A_KEY_NO_VALUE",
    });
  });

  it("returns 'keyval' for simple KEY=VALUE", () => {
    expect(parseEnvLine("OPENAI_API_KEY=sk-abc123")).toEqual({
      kind: "keyval",
      key: "OPENAI_API_KEY",
      value: "sk-abc123",
    });
  });

  it("strips leading/trailing whitespace from key and value", () => {
    expect(parseEnvLine("  KEY  =  value with spaces  ")).toEqual({
      kind: "keyval",
      key: "KEY",
      value: "value with spaces",
    });
  });

  it("strips a single leading and trailing quote from value", () => {
    // Matches python-dotenv / dotenv behaviour: only one quote per side
    // is stripped. (The original inline regex was /^[...
    expect(parseEnvLine('KEY="quoted value"')).toEqual({
      kind: "keyval",
      key: "KEY",
      value: "quoted value",
    });
    expect(parseEnvLine("KEY='single-quoted'")).toEqual({
      kind: "keyval",
      key: "KEY",
      value: "single-quoted",
    });
  });

  it("leaves empty value as empty string", () => {
    expect(parseEnvLine("EMPTY_KEY=")).toEqual({
      kind: "keyval",
      key: "EMPTY_KEY",
      value: "",
    });
  });

  it("does not treat '=' inside the value as a separator", () => {
    // Only the FIRST '=' is the separator; subsequent ones are part of
    // the value. The original inline parser uses `line.indexOf('=')`
    // which captures this behaviour.
    expect(parseEnvLine("KEY=a=b=c")).toEqual({
      kind: "keyval",
      key: "KEY",
      value: "a=b=c",
    });
  });

  it("treats leading-whitespace before '=' as part of the value", () => {
    // '  KEY  =value' → key='KEY', value='value'. The original inline
    // parser does `line.slice(0, eqIdx).trim()` for the key, so the
    // whitespace before the key is dropped. The whitespace after '='
    // is part of the value pre-trim.
    expect(parseEnvLine("  KEY  =value")).toEqual({
      kind: "keyval",
      key: "KEY",
      value: "value",
    });
  });
});

describe("envLineKey", () => {
  it("prefixes the key with 'env-' followed by the line index", () => {
    // The index is the second positional segment so React can
    // distinguish the same raw line at different positions.
    expect(envLineKey("FOO=bar", 7)).toBe("env-7-FOO-bar");
  });

  it("replaces non-alphanumeric characters in the prefix with '-'", () => {
    // Keeps the key safe for React (no whitespace, no specials) while
    // remaining readable. The raw line passes through after
    // sanitisation; the index is unaffected.
    expect(envLineKey("FOO=bar baz", 0)).toBe("env-0-FOO-bar-baz");
    expect(envLineKey("FOO=bar.baz", 0)).toBe("env-0-FOO-bar-baz");
  });

  it("truncates the raw line to the first 24 characters", () => {
    // The cap prevents the key string from growing with arbitrarily
    // long .env values (e.g. 2-4 KB PEM blobs).
    const long = "X=" + "y".repeat(40);
    const result = envLineKey(long, 0);
    // Format: `env-{i}-{prefix}` where `i` is the index. For i=0 the
    // prefix is `env-0-` (6 chars: "e", "n", "v", "-", "0", "-") and
    // the prefix portion of the line is 24 chars — total 30.
    expect(result.length).toBeLessThanOrEqual(6 + 24);
    expect(result.startsWith("env-0-X-yyyyyyyyyyyyyyyy")).toBe(true);
  });

  it("distinguishes two adjacent blank lines", () => {
    // The index alone is insufficient: two blank lines would
    // collapse to the same key. The empty prefix collapses too, so
    // the index is the only differentiator here.
    expect(envLineKey("", 3)).toBe("env-3-");
    expect(envLineKey("", 4)).toBe("env-4-");
    expect(envLineKey("", 3)).not.toBe(envLineKey("", 4));
  });

  it("distinguishes two identical keyval lines at different positions", () => {
    // The prefix alone is insufficient: two identical lines would
    // collapse to the same key. The index is the differentiator.
    expect(envLineKey("FOO=bar", 1)).toBe("env-1-FOO-bar");
    expect(envLineKey("FOO=bar", 2)).toBe("env-2-FOO-bar");
    expect(envLineKey("FOO=bar", 1)).not.toBe(envLineKey("FOO=bar", 2));
  });
});
