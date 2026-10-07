import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { join } from "node:path";

export function commentCensusFixture(root: string, lifecycle: "history" | "pending-capture") {
  const helper = join(root, "tests/helpers/test-comment-census.mjs");
  expect(existsSync(helper)).toBe(true);
  mkdirSync(join(root, "tmp"), { recursive: true });
  const owned = mkdtempSync(join(root, `tmp/t0195-${lifecycle}-`));
  for (const name of ["checkout", "home", "temp", "data", "hermes"]) mkdirSync(join(owned, name));
  const fixture = join(owned, "checkout");
  const baseline = "tests/fixtures/test-comment-census.baseline.json";
  const environment: NodeJS.ProcessEnv = {
    SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, PATH: process.env.PATH,
    HOME: join(owned, "home"), USERPROFILE: join(owned, "home"),
    APPDATA: join(owned, "home"), LOCALAPPDATA: join(owned, "home"),
    TEMP: join(owned, "temp"), TMP: join(owned, "temp"),
    PS_DATA_DIR: join(owned, "data"), HERMES_HOME: join(owned, "hermes"),
    GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: join(owned, "no-git-config"),
    NEXT_TELEMETRY_DISABLED: "1", NODE_ENV: "test", FORCE_COLOR: "0",
  };
  function execute(command: string, args: string[]) {
    const result = spawnSync(command, args, { cwd: fixture, env: environment, encoding: "utf8", timeout: 30_000, windowsHide: true });
    if (result.error || result.signal || result.status === null) throw new Error(`Owned ${lifecycle} process failed: ${result.error?.message ?? result.signal}`);
    return result;
  }
  function git(...args: string[]) {
    const result = execute("git", ["-c", "core.autocrlf=false", "-c", "commit.gpgsign=false", "-c", "user.name=Oracle fixture", "-c", "user.email=oracle@example.invalid", ...args]);
    expect(result.status).toBe(0);
    return result.stdout;
  }
  function census(...args: string[]) {
    return execute(process.execPath, [helper, "--root", fixture, "--baseline", baseline, "--json", ...args]);
  }
  git("init", "--quiet");
  mkdirSync(join(fixture, "tests/unit"), { recursive: true });
  return { root: fixture, baseline, git, census };
}
