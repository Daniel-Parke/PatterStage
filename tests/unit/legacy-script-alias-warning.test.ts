/** @jest-environment node */

import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { runLegacyEnvLoader, type LegacyEnvLoader } from "../helpers/legacy-env-loader";

const clearedKeys = [
  "CH_DATA_DIR", "PS_DATA_DIR", "CONTROL_HUB_DATA_DIR",
  "CH_ENABLE_DEPLOY_API", "PS_ENABLE_DEPLOY_API", "CH_READ_ONLY", "PS_READ_ONLY",
  "CH_PULL_RECONCILE_DISK", "PS_PULL_RECONCILE_DISK",
  "CH_ALLOWED_DEV_ORIGINS", "PS_ALLOWED_DEV_ORIGINS",
] as const;

function bridge(loader: LegacyEnvLoader, key: string, value: string): string[] {
  const replacement = key.replace(/^CH_/, "PS_");
  return runLegacyEnvLoader(
    loader, `${key}=${value}\n`, replacement, value, clearedKeys,
    { nodeExpression: "process.env[process.argv[2]]", bashSelection: 'selected="${!2}"' },
  );
}

describe.each<LegacyEnvLoader>(["node", "bash"])("T-0187 %s effective script aliases", (loader) => {
  it.each([
    ["CH_ENABLE_DEPLOY_API", "bogus"],
    ["CH_READ_ONLY", "bogus"],
    ["CH_PULL_RECONCILE_DISK", "true"],
    ["CH_ALLOWED_DEV_ORIGINS", " , "],
  ])("bridges %s but does not claim its rejected value was selected", (key, value) => {
    expect(bridge(loader, key, value)).toEqual([]);
  });

  it("bridges a valid read-only alias and warns once without its value", () => {
    const lines = bridge(loader, "CH_READ_ONLY", "true");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("CH_READ_ONLY");
    expect(lines[0]).toContain("PS_READ_ONLY");
    expect(lines[0]).not.toContain("true");
  });
});

it("T-0187 Node bridge leaves whitespace CH_DATA_DIR to deploy discovery without a warning", () => {
  const scratch = resolve(process.cwd(), "tmp");
  mkdirSync(scratch, { recursive: true });
  const home = mkdtempSync(join(scratch, "t0187-deploy-home-"));
  const savedHome = process.env.HOME;
  const savedProfile = process.env.USERPROFILE;
  try {
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    const lines = runLegacyEnvLoader(
      "node", "CH_DATA_DIR=   \n", "PS_DATA_DIR", "   ", clearedKeys,
      {
        nodeExpression: [
          "await (async () => {",
          '  const { resolveDataDir } = await import("./scripts/tooling/ps-deploy.mjs");',
          "  const selected = resolveDataDir();",
          "  const bridged = process.env.PS_DATA_DIR;",
          "  delete process.env.PS_DATA_DIR;",
          "  delete process.env.CH_DATA_DIR;",
          '  console.log(`deploy-discovery=${selected === resolveDataDir()}`);',
          "  return bridged;",
          "})()",
        ].join("\n"),
        bashSelection: 'selected="true"',
      },
    );
    expect(lines).toEqual(["deploy-discovery=true"]);
  } finally {
    if (savedHome === undefined) delete process.env.HOME;
    else process.env.HOME = savedHome;
    if (savedProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = savedProfile;
    rmSync(home, { recursive: true, force: true });
  }
});
