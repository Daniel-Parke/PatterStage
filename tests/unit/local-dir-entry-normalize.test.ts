import { normalizeLocalDirsInput } from "@/lib/fs/local-dir-entry";

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
