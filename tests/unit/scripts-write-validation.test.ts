/** @jest-environment node */
// Script-name validation for the write API (scripts-manager.scriptPathForName).

import { scriptPathForName } from "@/lib/scripts-manager";

describe("scriptPathForName", () => {
  it("rejects traversal, slashes, and non-.sh names", () => {
    expect(scriptPathForName("../evil.sh")).toBeNull();
    expect(scriptPathForName("a/b.sh")).toBeNull();
    expect(scriptPathForName("a\\b.sh")).toBeNull();
    expect(scriptPathForName("plain.txt")).toBeNull();
    expect(scriptPathForName("")).toBeNull();
    expect(scriptPathForName("with space.sh")).toBeNull();
    expect(scriptPathForName("weird;rm.sh")).toBeNull();
  });

  it("accepts safe .sh basenames and returns a path ending in the name", () => {
    const p = scriptPathForName("ch-backup.sh");
    expect(p).not.toBeNull();
    expect(p!.endsWith("ch-backup.sh")).toBe(true);
    expect(scriptPathForName("my_script-2.sh")).not.toBeNull();
  });
});
