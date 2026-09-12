import { normalizeLocalDirsInput, formatLocalDirEntryLine } from "@/lib/fs/local-dir-entry";

describe("normalizeLocalDirsInput", () => {
  it("maps string[] to LocalDirEntry[]", () => {
    expect(normalizeLocalDirsInput(["/a", "  /b  "])).toEqual([
      { path: "/a", branch: null },
      { path: "/b", branch: null },
    ]);
  });

  it("accepts object entries with branch", () => {
    expect(
      normalizeLocalDirsInput([
        { path: "/repo", branch: "main" },
        { path: "/x", branch: "" },
      ]),
    ).toEqual([
      { path: "/repo", branch: "main" },
      { path: "/x", branch: null },
    ]);
  });

  it("returns [] for non-array", () => {
    expect(normalizeLocalDirsInput(null)).toEqual([]);
    expect(normalizeLocalDirsInput({})).toEqual([]);
  });
});

describe("formatLocalDirEntryLine", () => {
  it("includes branch hint when set", () => {
    expect(formatLocalDirEntryLine({ path: "/p", branch: "dev" })).toContain("Use git branch: dev");
  });

  it("omits branch line when absent", () => {
    expect(formatLocalDirEntryLine({ path: "/p", branch: null })).toBe("  - /p");
  });
});
