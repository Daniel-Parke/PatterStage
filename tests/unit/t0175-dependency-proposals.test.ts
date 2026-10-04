/** @jest-environment node */

import { readDependencyOracleFiles, type DirectRanges } from "../helpers/dependency-oracle-types";

const { manifest, lockfile } = readDependencyOracleFiles(__dirname);

function expectProposal(name: string, range: string, version: string, kind: "dependencies" | "devDependencies") {
  expect(manifest[kind][name]).toBe(range);
  expect(lockfile.packages[""][kind]?.[name]).toBe(range);
  expect(lockfile.packages[`node_modules/${name}`]?.version).toBe(version);
}

function exceptProposals(ranges: DirectRanges, proposalNames: string[]): DirectRanges {
  return Object.fromEntries(
    Object.entries(ranges).filter(([name]) => !proposalNames.includes(name)),
  );
}

describe("T-0175 nonvisual dependency proposals", () => {
  it("accepts React Query 5.102.8 in the manifest and resolved lockfile", () => {
    expectProposal("@tanstack/react-query", "^5.102.8", "5.102.8", "dependencies");
  });

  it("accepts tsx 4.23.13 in the manifest and resolved lockfile", () => {
    expectProposal("tsx", "^4.23.13", "4.23.13", "devDependencies");
  });

  it("accepts dagre 3.1.1 in the manifest and resolved lockfile", () => {
    expectProposal("@dagrejs/dagre", "^3.1.1", "3.1.1", "dependencies");
  });

  it("keeps the root lockfile direct ranges identical to the manifest", () => {
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
    expect(manifest.dependencies.react).toBe("19.2.8");
    expect(manifest.dependencies["react-dom"]).toBe("19.2.8");
    expect(lockfile.packages["node_modules/react"]?.version).toBe("19.2.8");
    expect(lockfile.packages["node_modules/react-dom"]?.version).toBe("19.2.8");
  });

  it("preserves every other direct dependency range", () => {
    expect(exceptProposals(manifest.dependencies, ["@tanstack/react-query", "@dagrejs/dagre"])).toEqual({
      "@xyflow/react": "^12.11.6",
      "better-sqlite3": "^12.11.1",
      "js-yaml": "^4.2.0",
      "lucide-react": "^1.41.0",
      next: "16.3.6",
      react: "19.2.8",
      "react-dom": "19.2.8",
      zod: "^4.3.6",
    });
    expect(exceptProposals(manifest.devDependencies, ["tsx"])).toEqual({
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
      knip: "^6.34.0",
      "markdown-it": "^15.0.1",
      postcss: "8.5.15",
      tailwindcss: "^4.3.1",
      typescript: "^5",
    });
  });
});
