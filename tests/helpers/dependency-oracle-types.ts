import { readFileSync } from "node:fs";
import { join } from "node:path";

export type DirectRanges = Record<string, string>;
export type PackageManifest = {
  name: string;
  version: string;
  dependencies: DirectRanges;
  devDependencies: DirectRanges;
};
export type Lockfile = {
  name: string;
  version: string;
  packages: Record<string, {
    name?: string;
    version?: string;
    dependencies?: DirectRanges;
    devDependencies?: DirectRanges;
  }>;
};

export function readDependencyOracleFiles(testDirectory: string): {
  root: string;
  manifest: PackageManifest;
  lockfile: Lockfile;
} {
  const root = join(testDirectory, "..", "..");
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as PackageManifest;
  const lockfile = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8")) as Lockfile;
  return { root, manifest, lockfile };
}
