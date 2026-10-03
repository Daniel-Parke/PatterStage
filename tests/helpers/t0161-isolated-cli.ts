import { spawnSync } from "node:child_process";
import { join } from "node:path";

export const BLOCK_LOCAL_ENV = String.raw`
  const fs = require('node:fs');
  const path = require('node:path');
  const original = fs.existsSync;
  fs.existsSync = function (candidate) {
    if (typeof candidate === 'string' && path.resolve(candidate) === process.env.ORACLE_LOCAL_ENV) return false;
    return original.apply(this, arguments);
  };
  require('node:module').syncBuiltinESMExports();
`;

export function isolatedChildEnv(repoRoot: string, root: string, dataDir: string, hermesHome: string, sourceManifest?: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "test",
    NODE_OPTIONS: "",
    HOME: root,
    USERPROFILE: root,
    APPDATA: root,
    LOCALAPPDATA: root,
    PS_DATA_DIR: dataDir,
    CH_DATA_DIR: dataDir,
    CONTROL_HUB_DATA_DIR: dataDir,
    HERMES_HOME: hermesHome,
    ORACLE_LOCAL_ENV: join(repoRoot, ".env.local"),
    ...(sourceManifest === undefined ? {} : { ORACLE_SOURCE_MANIFEST: sourceManifest }),
  };
  for (const key of ["PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL"]) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  return env;
}

export function runCli(repoRoot: string, script: string, args: string[], preload: string, env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, ["--require", preload, "--import", "tsx", script, ...args], {
    cwd: repoRoot,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000,
    windowsHide: true,
  });
}

export function requireLaunch(result: ReturnType<typeof runCli>, step: string): void {
  if (result.error || result.signal || result.status === null) {
    throw new Error(`INFRASTRUCTURE: ${step} did not complete (${result.error?.message ?? result.signal ?? result.status})`);
  }
}
