import { parseEnvLine } from "@/lib/env-line";

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
