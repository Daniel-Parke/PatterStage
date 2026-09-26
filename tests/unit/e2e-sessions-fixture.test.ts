/** @jest-environment node */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import Database from "better-sqlite3";

const root = join(__dirname, "..", "..");
const fixtureId = "e2e-session-fixture";

describe("T-0150 · the e2e sessions fixture is hermetic", () => {
  it("seeds one completed session on every fresh preparation without Hermes", () => {
    const parent = mkdtempSync(join(tmpdir(), "patterstage-e2e-fixture-"));
    const dataDir = join(parent, "data");
    const missingHermesHome = join(parent, "no-hermes-installation");
    const databasePath = join(dataDir, "patterstage.db");
    const prepare = () => spawnSync(
      process.execPath,
      [join(root, "tests", "e2e", "prepare-data-dir.mjs"), dataDir],
      { cwd: root, encoding: "utf8", env: { ...process.env, HERMES_HOME: missingHermesHome } },
    );
    try {
      mkdirSync(dataDir);
      writeFileSync(join(dataDir, "stale-marker"), "old run");
      for (let run = 0; run < 2; run += 1) {
        const result = prepare();
        expect(result.status).toBe(0);
        expect(existsSync(join(dataDir, "stale-marker"))).toBe(false);
        expect(existsSync(databasePath)).toBe(true);
        const database = new Database(databasePath, { readonly: true });
        try {
          const rows = database.prepare("SELECT id, source, status FROM sessions ORDER BY id").all();
          expect(rows).toEqual([{ id: fixtureId, source: "cli", status: "completed" }]);
        } finally {
          database.close();
        }
        if (run === 0) writeFileSync(join(dataDir, "stale-marker"), "second run");
      }
    } finally {
      const safeParent = resolve(parent);
      if (!safeParent.startsWith(resolve(tmpdir()) + sep)) throw new Error("Refusing to remove a non-temporary fixture path");
      rmSync(safeParent, { recursive: true, force: true });
    }
  });
});
