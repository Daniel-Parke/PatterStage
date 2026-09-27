/** @jest-environment node */

import { readDependencyOracleFiles } from "../helpers/dependency-oracle-types";

const { manifest, lockfile } = readDependencyOracleFiles(__dirname);

type PeerPackage = { version?: string; peerDependencies?: Record<string, string> };
const packages = lockfile.packages as Record<string, PeerPackage>;
const installed = (name: string) => packages[`node_modules/${name}`];

// The peers checked below use caret or minimum ranges with stable, nonzero majors.
function acceptsVersion(range: string, version: string): boolean {
  const actual = version.split(".").map(Number);
  return range.split(" || ").some((part) => {
    const match = /^(\^|>=)(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(part);
    if (!match) return false;
    const minimum = [Number(match[2]), Number(match[3] ?? 0), Number(match[4] ?? 0)];
    const atLeastMinimum = actual[0] > minimum[0]
      || (actual[0] === minimum[0] && actual[1] > minimum[1])
      || (actual[0] === minimum[0] && actual[1] === minimum[1] && actual[2] >= minimum[2]);
    return atLeastMinimum && (match[1] === ">=" || actual[0] === minimum[0]);
  });
}

describe("T-0179 paired React proposal", () => {
  it("pins React and React DOM together and resolves the proposed React types", () => {
    for (const name of ["react", "react-dom"]) {
      expect(manifest.dependencies[name]).toBe("19.2.8");
      expect(lockfile.packages[""].dependencies?.[name]).toBe("19.2.8");
      expect(installed(name)?.version).toBe("19.2.8");
    }
    expect(manifest.devDependencies["@types/react"]).toBe("^19.2.18");
    expect(lockfile.packages[""].devDependencies?.["@types/react"]).toBe("^19.2.18");
    expect(installed("@types/react")?.version).toBe("19.2.18");
  });

  it("retains the adjacent Next, React DOM types and Playwright contracts", () => {
    expect(manifest.dependencies.next).toBe("16.3.6");
    expect(manifest.devDependencies["eslint-config-next"]).toBe("16.3.6");
    expect(manifest.devDependencies["@types/react-dom"]).toBe("^19");
    expect(manifest.devDependencies["@playwright/test"]).toBe("^1.62.1");

    for (const [name, range, version] of [
      ["next", "16.3.6", "16.3.6"],
      ["eslint-config-next", "16.3.6", "16.3.6"],
      ["@types/react-dom", "^19", "19.2.3"],
      ["@playwright/test", "^1.62.1", "1.62.1"],
    ]) {
      expect(lockfile.packages[""].dependencies?.[name] ?? lockfile.packages[""].devDependencies?.[name]).toBe(range);
      expect(installed(name)?.version).toBe(version);
    }
  });

  it("keeps the resolved React family inside relevant peer ranges", () => {
    for (const [consumer, peer] of [
      ["react-dom", "react"],
      ["next", "react"],
      ["next", "react-dom"],
      ["next", "@playwright/test"],
      ["@types/react-dom", "@types/react"],
      ["@testing-library/react", "react"],
      ["@testing-library/react", "react-dom"],
      ["@testing-library/react", "@types/react"],
      ["@testing-library/react", "@types/react-dom"],
      ["@xyflow/react", "react"],
      ["@xyflow/react", "react-dom"],
      ["@xyflow/react", "@types/react"],
      ["@xyflow/react", "@types/react-dom"],
    ]) {
      const range = installed(consumer)?.peerDependencies?.[peer];
      const version = installed(peer)?.version;
      expect(range).toEqual(expect.any(String));
      expect(version).toEqual(expect.any(String));
      expect(acceptsVersion(range!, version!)).toBe(true);
    }
  });
});
