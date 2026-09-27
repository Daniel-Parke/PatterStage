/** @jest-environment node */

import { readFileSync } from "node:fs";
import { join } from "node:path";

type DirectRanges = Record<string, string>;
type PackageManifest = {
  name: string;
  version: string;
  dependencies: DirectRanges;
  devDependencies: DirectRanges;
};
type Lockfile = {
  name: string;
  version: string;
  packages: Record<string, {
    name?: string;
    version?: string;
    dependencies?: DirectRanges;
    devDependencies?: DirectRanges;
  }>;
};

const root = join(__dirname, "..", "..");
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as PackageManifest;
const lockfile = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8")) as Lockfile;

function expectProposal(name: string, range: string, version: string, kind: "dependencies" | "devDependencies") {
  expect(manifest[kind][name]).toBe(range);
  expect(lockfile.packages[""]?.[kind]?.[name]).toBe(range);
  expect(lockfile.packages[`node_modules/${name}`]?.version).toBe(version);
}

function exceptProposals(ranges: DirectRanges, proposalNames: string[]): DirectRanges {
  return Object.fromEntries(
    Object.entries(ranges).filter(([name]) => !proposalNames.includes(name)),
  );
}

describe("T-0176 visual dependency proposals", () => {
  it("accepts @xyflow/react 12.11.6 in the manifest and resolved lockfile", () => {
    expectProposal("@xyflow/react", "^12.11.6", "12.11.6", "dependencies");
  });

  it("accepts @tailwindcss/postcss 4.3.3 in the manifest and resolved lockfile", () => {
    expectProposal("@tailwindcss/postcss", "^4.3.3", "4.3.3", "devDependencies");
  });

  it("accepts lucide-react 1.41.0 in the manifest and resolved lockfile", () => {
    expectProposal("lucide-react", "^1.41.0", "1.41.0", "dependencies");
  });

  it("keeps the root lockfile record identical to the manifest", () => {
    expect(lockfile.name).toBe(manifest.name);
    expect(lockfile.version).toBe(manifest.version);
    expect(lockfile.packages[""]?.name).toBe(manifest.name);
    expect(lockfile.packages[""]?.version).toBe(manifest.version);
    expect(lockfile.packages[""]?.dependencies).toEqual(manifest.dependencies);
    expect(lockfile.packages[""]?.devDependencies).toEqual(manifest.devDependencies);
  });

  it("preserves the Next and eslint-config-next 16.3.6 pins", () => {
    expect(manifest.dependencies.next).toBe("16.3.6");
    expect(manifest.devDependencies["eslint-config-next"]).toBe("16.3.6");
    expect(lockfile.packages["node_modules/next"]?.version).toBe("16.3.6");
    expect(lockfile.packages["node_modules/eslint-config-next"]?.version).toBe("16.3.6");
  });

  it("preserves the React and React DOM 19.2.7 pins", () => {
    expect(manifest.dependencies.react).toBe("19.2.7");
    expect(manifest.dependencies["react-dom"]).toBe("19.2.7");
    expect(lockfile.packages["node_modules/react"]?.version).toBe("19.2.7");
    expect(lockfile.packages["node_modules/react-dom"]?.version).toBe("19.2.7");
  });

  it("preserves every other direct production dependency range", () => {
    expect(exceptProposals(manifest.dependencies, ["@xyflow/react", "lucide-react"])).toEqual({
      "@dagrejs/dagre": "^3.1.1",
      "@tanstack/react-query": "^5.102.8",
      "@types/js-yaml": "^4.0.9",
      "better-sqlite3": "^12.11.1",
      "js-yaml": "^4.2.0",
      next: "16.3.6",
      react: "19.2.7",
      "react-dom": "19.2.7",
      zod: "^4.3.6",
    });
  });

  it("preserves every other direct development dependency range", () => {
    expect(exceptProposals(manifest.devDependencies, ["@tailwindcss/postcss"])).toEqual({
      "@playwright/test": "^1.61.0",
      "@testing-library/jest-dom": "^6.9.1",
      "@testing-library/react": "^16.3.2",
      "@types/better-sqlite3": "^7.6.13",
      "@types/jest": "^30.0.0",
      "@types/node": "^20.19.43",
      "@types/react": "^19.2.17",
      "@types/react-dom": "^19",
      "cross-env": "^7.0.3",
      eslint: "^9",
      "eslint-config-next": "16.3.6",
      jest: "^30.3.0",
      "jest-environment-jsdom": "^30.3.0",
      knip: "^6.16.1",
      "markdown-it": "^15.0.1",
      postcss: "8.5.15",
      tailwindcss: "^4.3.1",
      "ts-jest": "^29.4.11",
      tsx: "^4.23.13",
      typescript: "^5",
    });
  });
});
