/** @jest-environment node */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

it("refuses baseline recapture after working deletion when HEAD already contains the initial capture", () => {
  const root = join(__dirname, "..", "..");
  const helper = join(root, "tests/helpers/test-comment-census.mjs");
  expect(existsSync(helper)).toBe(true);
  mkdirSync(join(root, "tmp"), { recursive: true });
  const owned = mkdtempSync(join(root, "tmp/t0195-history-"));
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
    if (result.error || result.signal || result.status === null) throw new Error(`Owned history process failed: ${result.error?.message ?? result.signal}`);
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
  writeFileSync(join(fixture, "tests/unit/existing.test.ts"), "export const existing = true;\n");
  git("add", ".");
  git("commit", "--quiet", "-m", "Owned initial source");
  expect(census("--capture", "--reason", "Independent capture history fixture").status).toBe(0);
  const initialBytes = readFileSync(join(fixture, baseline), "utf8");
  git("add", baseline);
  git("commit", "--quiet", "-m", "Owned initial captured baseline");
  const initialHead = git("rev-parse", "HEAD").trim();
  const essay = Array.from({ length: 60 }, (_, index) => index < 24 ? `// rationale ${index}` : `const value${index} = ${index};`).join("\n") + "\n";
  writeFileSync(join(fixture, "tests/unit/planted.test.ts"), essay);
  const check = census();
  expect(check.status).toBe(1);
  expect(JSON.parse(check.stdout)).toMatchObject({ baselineSource: "HEAD", violations: [{ path: "tests/unit/planted.test.ts", reason: "new" }] });
  unlinkSync(join(fixture, baseline));
  expect(existsSync(join(fixture, baseline))).toBe(false);
  const recapture = census("--capture", "--reason", "Attempt to replace committed history");
  expect(git("show", `HEAD:${baseline}`)).toBe(initialBytes);
  expect(readFileSync(join(fixture, "tests/unit/planted.test.ts"), "utf8")).toBe(essay);
  expect({ refused: recapture.status !== 0, recreated: existsSync(join(fixture, baseline)), head: git("rev-parse", "HEAD").trim() })
    .toEqual({ refused: true, recreated: false, head: initialHead });
}, 30_000);
