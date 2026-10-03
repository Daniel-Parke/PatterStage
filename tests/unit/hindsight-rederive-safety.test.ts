import { existsSync } from "node:fs";
import { join } from "node:path";

describe("the ruled Hindsight rederive command", () => {
  it("has no callable entrypoint that could wipe a live bank by default", () => {
    expect(existsSync(join(process.cwd(), "scripts", "maintenance", "hindsight-rederive.sh"))).toBe(false);
  });
});
