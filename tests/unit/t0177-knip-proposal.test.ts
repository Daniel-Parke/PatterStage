/** @jest-environment node */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compareKnipIssues } from "../../scripts/tooling/knip-ratchet.mjs";
import { readDependencyOracleFiles } from "../helpers/dependency-oracle-types";

const { root, manifest, lockfile } = readDependencyOracleFiles(__dirname);

describe("T-0177 Knip proposal", () => {
  it("accepts the Knip 6.34.0 manifest range", () => {
    expect(manifest.devDependencies.knip).toBe("^6.34.0");
  });

  it("keeps the Knip 6.34.0 range in the root lockfile", () => {
    expect(lockfile.packages[""]?.devDependencies?.knip).toBe("^6.34.0");
    expect(lockfile.packages[""]?.dependencies).toEqual(manifest.dependencies);
    expect(lockfile.packages[""]?.devDependencies).toEqual(manifest.devDependencies);
  });

  it("resolves Knip 6.34.0 in the lockfile", () => {
    expect(lockfile.packages["node_modules/knip"]?.version).toBe("6.34.0");
  });

  it("preserves every other direct dependency range", () => {
    expect(manifest.dependencies).toEqual({
      "@dagrejs/dagre": "^3.1.1",
      "@tanstack/react-query": "^5.102.8",
      "@xyflow/react": "^12.11.6",
      "better-sqlite3": "^12.11.1",
      "js-yaml": "^4.2.0",
      "lucide-react": "^1.41.0",
      next: "16.3.6",
      react: "19.2.8",
      "react-dom": "19.2.8",
      undici: "8.11.2",
      zod: "^4.3.6",
    });
    expect(Object.fromEntries(Object.entries(manifest.devDependencies).filter(([name]) => name !== "knip"))).toEqual({
      "@playwright/test": "^1.62.1",
      "@tailwindcss/postcss": "^4.3.3",
      "@testing-library/jest-dom": "^6.9.1",
      "@testing-library/react": "^16.3.2",
      "@types/better-sqlite3": "^7.6.13",
      "@types/jest": "^30.0.0",
      "@types/js-yaml": "^4.0.9",
      "@types/node": "^20.19.43",
      "@types/react": "^19.2.18",
      "@types/react-dom": "^19",
      "cross-env": "^7.0.3",
      eslint: "^9",
      "eslint-config-next": "16.3.6",
      jest: "^30.3.0",
      "jest-environment-jsdom": "^30.3.0",
      jsdom: "26.1.0",
      "markdown-it": "^15.0.1",
      postcss: "8.5.15",
      tailwindcss: "^4.3.1",
      tsx: "^4.23.13",
      typescript: "^5",
    });
  });

  it("preserves the paired Next and React pins", () => {
    expect(manifest.dependencies.next).toBe("16.3.6");
    expect(manifest.devDependencies["eslint-config-next"]).toBe("16.3.6");
    expect(manifest.dependencies.react).toBe("19.2.8");
    expect(manifest.dependencies["react-dom"]).toBe("19.2.8");
    for (const [name, version] of Object.entries({
      next: "16.3.6",
      "eslint-config-next": "16.3.6",
      react: "19.2.8",
      "react-dom": "19.2.8",
    })) {
      expect(lockfile.packages[`node_modules/${name}`]?.version).toBe(version);
    }
  });

  it("keeps the Knip JSON issue identities equal to the reasoned baseline", () => {
    const run = spawnSync(process.execPath, [join(root, "node_modules", "knip", "bin", "knip.js"),
      "--include", "files,dependencies,unlisted,unresolved,exports,types,duplicates,binaries",
      "--no-config-hints", "--reporter", "json", "--no-exit-code"], {
      cwd: root,
      encoding: "utf8",
      timeout: 60_000,
      maxBuffer: 32 * 1024 * 1024,
    });
    if (run.error || run.status !== 0) {
      throw new Error(`Knip JSON scan failed: ${run.error?.message ?? `exit ${run.status}`}\n${run.stderr}`);
    }
    const baseline = JSON.parse(readFileSync(join(root, "scripts", "tooling", "knip-baseline.json"), "utf8"));
    const result = compareKnipIssues(JSON.parse(run.stdout), baseline);
    expect(result.newIssues).toEqual([]);
    expect(result.resolvedIssues).toEqual([]);
    expect(result.total).toBe(baseline.issues.length);
  }, 70_000);
});
