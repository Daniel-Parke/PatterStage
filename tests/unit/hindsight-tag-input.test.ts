import { parseTagsInput, parseOptionalTagsInput } from "@/lib/memory/hindsight-tag-input";

describe("parseTagsInput", () => {
  it("returns [] for empty string", () => {
    expect(parseTagsInput("")).toEqual([]);
  });

  it("returns [] for whitespace-only string", () => {
    expect(parseTagsInput("   ")).toEqual([]);
  });

  it("returns [] for null/undefined-ish input (empty string fallback)", () => {
    // The Hindsight modals store the input as `string` (never null),
    // so the only non-string-ish case is ""; verify the type contract.
    expect(parseTagsInput("")).toEqual([]);
  });

  it("returns single tag for a one-tag input", () => {
    expect(parseTagsInput("foo")).toEqual(["foo"]);
  });

  it("trims each segment", () => {
    expect(parseTagsInput(" foo , bar ")).toEqual(["foo", "bar"]);
  });

  it("drops empty segments from consecutive commas", () => {
    expect(parseTagsInput("foo,,bar")).toEqual(["foo", "bar"]);
  });

  it("drops empty segments at the ends", () => {
    expect(parseTagsInput(",foo,")).toEqual(["foo"]);
    expect(parseTagsInput(",foo,bar,")).toEqual(["foo", "bar"]);
  });

  it("returns [] for a string of only commas and whitespace", () => {
    expect(parseTagsInput(",,,")).toEqual([]);
    expect(parseTagsInput(" , , ")).toEqual([]);
  });

  it("preserves multi-word tags without splitting on spaces", () => {
    expect(parseTagsInput("user pref, project x")).toEqual([
      "user pref",
      "project x",
    ]);
  });

  it("preserves tags containing special characters (e.g. dots, hyphens, slashes)", () => {
    expect(parseTagsInput("ch-deploy, hermes/gateway, v1.2.3")).toEqual([
      "ch-deploy",
      "hermes/gateway",
      "v1.2.3",
    ]);
  });
});

describe("parseOptionalTagsInput", () => {
  it("returns undefined for empty string", () => {
    expect(parseOptionalTagsInput("")).toBeUndefined();
  });

  it("returns undefined for whitespace-only string", () => {
    expect(parseOptionalTagsInput("   ")).toBeUndefined();
  });

  it("returns undefined for a string of only commas", () => {
    expect(parseOptionalTagsInput(",,,")).toBeUndefined();
  });

  it("returns the tag array when at least one tag is present", () => {
    expect(parseOptionalTagsInput("foo")).toEqual(["foo"]);
    expect(parseOptionalTagsInput("foo,bar")).toEqual(["foo", "bar"]);
  });

  it("strips leading/trailing whitespace per segment (delegates to parseTagsInput)", () => {
    expect(parseOptionalTagsInput(" foo , bar ")).toEqual(["foo", "bar"]);
  });
});
