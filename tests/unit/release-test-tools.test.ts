/** @jest-environment node */

// T-0203 independent ORACLE 01a0f0cf-033e-7b82-af84-94713bfa5bd7.
// Fake Homebrew controls installation only; successful tools execute real GNU
// timeout and Bash. Native macOS/bootstrap and the frozen HTTP suite remain
// separate obligations. No implementation source is inspected by this oracle.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { load } from "js-yaml";

const script = resolve("scripts/tooling/prepare-release-test-tools.sh");
const bootstrap = process.env.T0203_BASH || (process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash");
const tools: Record<string, string> = {};
const roots: string[] = [];
const shellPath = (path: string) => path.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_, drive: string) => `/${drive.toLowerCase()}`);
const quote = (value: string) => `'${value.replace(/'/g, "'\\''")}'`;
const timerCheck = 'exec {channel}< <(sleep 0.2); value=""; IFS= read -r -t 0.01 -u "$channel" value; status=$?; exec {channel}<&-; [[ "$status" == 142 && -z "$value" ]]';

function launch(args: string[], env: NodeJS.ProcessEnv = process.env) {
  // Git's Windows launcher prepends host directories even with profiles off.
  // Restore the isolated PATH inside Bash before discovery or script execution.
  const isolated = env.T0203_CALLS !== undefined;
  const invocation = isolated ? args[0] === "-c"
    ? ["-c", `export PATH="$T0203_TOOL_PATH"\n${args[1]}`]
    : ["-c", 'export PATH="$T0203_TOOL_PATH"; "$BASH" --noprofile --norc "$@"', "t0203", ...args]
    : args;
  const childEnv: NodeJS.ProcessEnv = { ...env, T0203_TOOL_PATH: env.PATH };
  for (const key of Object.keys(childEnv)) {
    if (key.toLowerCase() === "path" && key !== "PATH") delete childEnv[key];
  }
  const result = spawnSync(bootstrap, ["--noprofile", "--norc", ...invocation], {
    encoding: "utf8", env: childEnv, timeout: 15_000, maxBuffer: 1024 * 1024,
  });
  // Spawn failure, signal or outer watchdog expiry is infrastructure, not red.
  if (result.error || result.signal || result.status === null) {
    throw new Error(`T-0203 infrastructure: ${result.error?.message || result.signal || "no exit status"}`);
  }
  return result;
}

beforeAll(() => {
  const found = launch(["-c", `
if [[ "$OSTYPE" == msys* || "$OSTYPE" == cygwin* ]]; then export PATH=/usr/bin:/bin:$PATH; fi
printf 'bash\t%s\n' "$BASH"
for name in timeout sleep cp cat dirname mktemp rm grep sed head env sh; do
  command_path=$(type -P "$name") || exit 90
  printf '%s\t%s\n' "$name" "$command_path"
done`]);
  if (found.status !== 0) throw new Error(`T-0203 tool discovery failed: ${found.stderr}`);
  for (const line of found.stdout.trim().split("\n")) {
    const [name, path] = line.split("\t");
    tools[name] = path;
  }
}, 20_000);

afterEach(() => {
  for (const root of roots.splice(0)) {
    const absolute = resolve(root);
    if (!absolute.startsWith(resolve(tmpdir()) + (process.platform === "win32" ? "\\" : "/"))) {
      throw new Error("T-0203 cleanup escaped its temporary directory");
    }
    rmSync(absolute, { recursive: true, force: true });
  }
});

type Options = {
  os?: "Darwin" | "Linux" | "MINGW64_NT-10.0";
  coreutils?: boolean;
  bash?: boolean;
  brew?: boolean;
  nativeTimeout?: boolean;
  timeoutMode?: "gnu" | "foreign" | "no-kill-after" | "wrong-expiry";
  bashMode?: "working" | "broken-timer";
  installFails?: "coreutils" | "bash";
  prefixFails?: "coreutils" | "bash";
  installOmitsTools?: boolean;
  publication?: "file" | "absent" | "directory";
};

function fixture(options: Options = {}) {
  const root = mkdtempSync(join(tmpdir(), "t0203 tools "));
  roots.push(root);
  const bin = join(root, "native bin");
  const corePrefix = join(root, "relocated Homebrew", "coreutils");
  const bashPrefix = join(root, "relocated Homebrew", "bash");
  const gnubin = join(corePrefix, "libexec", "gnubin");
  const bashbin = join(bashPrefix, "bin");
  const pathFile = join(root, "github path");
  const log = join(root, "calls");
  for (const dir of [bin, gnubin, bashbin]) mkdirSync(dir, { recursive: true });
  writeFileSync(log, "");
  if (options.publication === "directory") mkdirSync(pathFile);
  else writeFileSync(pathFile, "/already-published\n");
  const writeCommand = (path: string, source: string) => {
    writeFileSync(path, `#!${tools.bash}\n${source}\n`, "utf8");
    chmodSync(path, 0o700);
  };
  // An allowlist prevents host timeout/Homebrew from rescuing missing cases.
  for (const [name, path] of Object.entries(tools)) {
    if (name !== "timeout" && name !== "bash") writeCommand(join(bin, name), `exec ${quote(path)} "$@"`);
  }
  writeCommand(join(bin, "bash"), `exec ${quote(tools.bash)} "$@"`);
  writeCommand(join(bin, "uname"), `printf '%s\\n' ${quote(options.os || "Darwin")}`);
  const timeoutTemplate = join(root, "timeout-template");
  writeCommand(timeoutTemplate, `
printf 'timeout' >> "$T0203_CALLS"; printf '\t%s' "$@" >> "$T0203_CALLS"; printf '\n' >> "$T0203_CALLS"
if [[ "$T0203_TIMEOUT_MODE" == foreign ]]; then printf 'BSD timeout\\n'; exit 125; fi
if [[ "$T0203_TIMEOUT_MODE" == no-kill-after && "$1" != --version && "$1" != --help ]]; then exit 125; fi
${quote(tools.timeout)} "$@"
status=$?
if [[ "$T0203_TIMEOUT_MODE" == wrong-expiry && ( "$status" == 124 || "$status" == 137 ) ]]; then exit 0; fi
exit "$status"`);
  const bashTemplate = join(root, "bash-template");
  writeCommand(bashTemplate, `
printf 'bash' >> "$T0203_CALLS"; printf '\t%s' "$@" >> "$T0203_CALLS"; printf '\n' >> "$T0203_CALLS"
if [[ "$T0203_BASH_MODE" == broken-timer ]]; then
  if [[ "$1" == --version ]]; then printf 'GNU bash, version 5.3.0\\n'; exit 0; fi
  printf 'fractional timer unavailable\\n' >&2; exit 2
fi
exec ${quote(tools.bash)} "$@"`);
  if (options.coreutils) writeFileSync(join(gnubin, "timeout"), readFileSync(timeoutTemplate), { mode: 0o700 });
  if (options.bash) writeFileSync(join(bashbin, "bash"), readFileSync(bashTemplate), { mode: 0o700 });
  if (options.nativeTimeout) writeFileSync(join(bin, "timeout"), readFileSync(timeoutTemplate), { mode: 0o700 });
  if (options.brew !== false) writeCommand(join(bin, "brew"), `
printf 'brew' >> "$T0203_CALLS"; printf '\t%s' "$@" >> "$T0203_CALLS"; printf '\n' >> "$T0203_CALLS"
operation=$1; shift
case "$operation" in
  --prefix)
    [[ "$1" == "$T0203_PREFIX_FAILS" ]] && exit 71
    case "$1" in coreutils) printf '%s\\n' "$T0203_CORE_PREFIX";; bash) printf '%s\\n' "$T0203_BASH_PREFIX";; *) exit 92;; esac;;
  list)
    for formula in "$@"; do
      case "$formula" in
        --*) continue;;
        coreutils) [[ -x "$T0203_CORE_PREFIX/libexec/gnubin/timeout" ]] || exit 1;;
        bash) [[ -x "$T0203_BASH_PREFIX/bin/bash" ]] || exit 1;;
        *) exit 92;;
      esac
      printf '%s 1.0\\n' "$formula"
    done;;
  install)
    for formula in "$@"; do
      [[ "$formula" == --* ]] && continue
      [[ "$formula" == "$T0203_INSTALL_FAILS" ]] && exit 72
      [[ "$T0203_INSTALL_OMITS" == yes ]] && continue
      case "$formula" in
        coreutils) cp "$T0203_TIMEOUT_TEMPLATE" "$T0203_CORE_PREFIX/libexec/gnubin/timeout";;
        bash) cp "$T0203_BASH_TEMPLATE" "$T0203_BASH_PREFIX/bin/bash";;
        *) exit 92;;
      esac
    done;;
  *) exit 92;;
esac`);
  const env: NodeJS.ProcessEnv = { ...process.env, PATH: shellPath(bin),
    RUNNER_OS: options.os === "Linux" ? "Linux" : options.os?.startsWith("MINGW") ? "Windows" : "macOS",
    OSTYPE: options.os === "Linux" ? "linux-gnu" : options.os?.startsWith("MINGW") ? "msys" : "darwin",
    T0203_CALLS: shellPath(log), T0203_CORE_PREFIX: shellPath(corePrefix), T0203_BASH_PREFIX: shellPath(bashPrefix),
    T0203_TIMEOUT_TEMPLATE: shellPath(timeoutTemplate), T0203_BASH_TEMPLATE: shellPath(bashTemplate),
    T0203_TIMEOUT_MODE: options.timeoutMode || "gnu", T0203_BASH_MODE: options.bashMode || "working",
    T0203_INSTALL_FAILS: options.installFails || "", T0203_PREFIX_FAILS: options.prefixFails || "",
    T0203_INSTALL_OMITS: options.installOmitsTools ? "yes" : "no", GITHUB_PATH: shellPath(pathFile),
  };
  delete env.BASH_ENV;
  delete env.ENV;
  if (options.publication === "absent") delete env.GITHUB_PATH;
  const calls = () => readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((line) => line.split("\t"));
  const published = () => options.publication === "directory" ? [] : readFileSync(pathFile, "utf8").trim().split("\n");
  return { env, gnubin: shellPath(gnubin), bashbin: shellPath(bashbin), bin: shellPath(bin), nativeBin: bin, calls, published,
    prepare: () => {
      // Missing implementation is an intended matcher failure, never ENOENT.
      expect(existsSync(script)).toBe(true);
      return launch([shellPath(script)], env);
    },
  };
}

type Fixture = ReturnType<typeof fixture>;
const installed = (state: Fixture) => state.calls().filter((call) => call[0] === "brew" && call[1] === "install")
  .flatMap((call) => call.slice(2).filter((part) => !part.startsWith("--")));

function assertReady(state: Fixture) {
  expect(state.published()).toEqual(expect.arrayContaining(["/already-published", state.gnubin, state.bashbin]));
  expect(state.published().filter((path) => path !== "/already-published").every((path) => path === state.gnubin || path === state.bashbin)).toBe(true);
  // GitHub PATH takes effect in a fresh step, not the setup process's parent.
  const env = { ...state.env, PATH: [...state.published().filter((path) => path !== "/already-published").reverse(), state.bin].join(":") };
  const next = launch(["-c", 'type -P timeout; type -P bash; timeout --kill-after=0.2 2 bash --noprofile --norc -c "$T0203_TIMER_CHECK"'], {
    ...env, T0203_TIMER_CHECK: timerCheck,
  });
  expect(next.status).toBe(0);
  expect(next.stdout.trim().split("\n")).toEqual([`${state.gnubin}/timeout`, `${state.bashbin}/bash`]);
}

describe("T-0203 release test prerequisites", () => {
  it("F00 controlled tools execute real GNU timeout and fractional Bash reads", () => {
    const state = fixture({ coreutils: true, bash: true });
    const env = { ...state.env, PATH: `${state.gnubin}:${state.bashbin}:${state.bin}`, T0203_TIMER_CHECK: timerCheck };
    expect(launch(["-c", "type -P timeout; type -P bash"], env).stdout.trim().split("\n"))
      .toEqual([`${state.gnubin}/timeout`, `${state.bashbin}/bash`]);
    expect(launch(["-c", 'timeout --version'], env).stdout).toContain("GNU coreutils");
    expect(launch(["-c", 'timeout --kill-after=0.2 2 bash --noprofile --norc -c "$T0203_TIMER_CHECK"'], env).status).toBe(0);
    expect(launch(["-c", "timeout --kill-after=0.2 2 bash -c 'exit 37'"], env).status).toBe(37);
    expect(launch(["-c", "timeout --kill-after=0.2 0.2 sleep 2"], env).status).toBe(124);
    // Keep an observing shell alive: MSYS exposes a raw native kill code if
    // Bash replaces itself with the final command instead of waiting for it.
    expect(launch(["-c", "timeout --kill-after=0.2 0.5 bash -c 'trap \"\" TERM; while :; do :; done'; status=$?; exit \"$status\""], env).status).toBe(137);
    expect(state.calls().filter((call) => call[0] === "timeout")).toHaveLength(5);
    expect(state.calls().some((call) => call[0] === "bash")).toBe(true);
  }, 20_000);

  it("F01 fake Homebrew installs at formula prefixes and reports reusable tools", () => {
    const state = fixture();
    expect(launch(["-c", 'brew install coreutils bash; brew --prefix coreutils; brew --prefix bash; brew list --versions coreutils bash'], state.env).status).toBe(0);
    expect(installed(state)).toEqual(["coreutils", "bash"]);
    expect(launch(["-c", '"$T0203_CORE_PREFIX/libexec/gnubin/timeout" --version'], state.env).stdout).toContain("GNU coreutils");
  });

  it("F02 negative command controls expose incompatible semantics despite plausible versions", () => {
    for (const timeoutMode of ["foreign", "no-kill-after", "wrong-expiry"] as const) {
      const state = fixture({ coreutils: true, bash: true, timeoutMode });
      const env = { ...state.env, PATH: `${state.gnubin}:${state.bashbin}:${state.bin}` };
      expect(launch(["-c", "type -P timeout"], env).stdout.trim()).toBe(`${state.gnubin}/timeout`);
      const version = launch(["-c", "timeout --version"], env);
      if (timeoutMode === "foreign") expect(version.stdout).not.toContain("GNU coreutils");
      else expect(version.stdout).toContain("GNU coreutils");
      const result = launch(["-c", "timeout --kill-after=0.2 0.2 sleep 2; status=$?; exit \"$status\""], env);
      expect(result.status).toBe(timeoutMode === "wrong-expiry" ? 0 : 125);
      expect(state.calls().filter((call) => call[0] === "timeout")).toHaveLength(2);
    }
    const state = fixture({ coreutils: true, bash: true, bashMode: "broken-timer" });
    const env = { ...state.env, PATH: `${state.gnubin}:${state.bashbin}:${state.bin}`, T0203_TIMER_CHECK: timerCheck };
    expect(launch(["-c", "bash --version"], env).stdout).toContain("GNU bash, version 5");
    expect(launch(["-c", 'bash --noprofile --norc -c "$T0203_TIMER_CHECK"'], env).status).toBe(2);
    expect(state.calls().filter((call) => call[0] === "bash")).toHaveLength(2);
    const missing = fixture({ brew: false });
    const absent = launch(["-c", "command -v timeout; status=$?; exit \"$status\""], missing.env);
    expect(absent.status).toBe(1);
    expect(absent.stdout).toBe("");
    expect(missing.calls()).toEqual([]);
  }, 20_000);

  it("P01 installs missing macOS tools and publishes both resolved directories for a fresh step", () => {
    const state = fixture();
    expect(state.prepare().status).toBe(0);
    expect(installed(state).sort()).toEqual(["bash", "coreutils"]);
    assertReady(state);
  }, 20_000);

  it("P02 reuses installed Homebrew tools and publishes their paths without reinstalling", () => {
    const state = fixture({ coreutils: true, bash: true });
    expect(state.prepare().status).toBe(0);
    expect(state.prepare().status).toBe(0);
    expect(installed(state)).toEqual([]);
    assertReady(state);
  }, 20_000);

  for (const [name, options, required] of [
    ["P03 installs only coreutils when modern Homebrew Bash already exists", { bash: true }, "coreutils"],
    ["P04 installs only Bash when Homebrew coreutils already exists", { coreutils: true }, "bash"],
  ] as const) it(name, () => {
    const state = fixture(options);
    expect(state.prepare().status).toBe(0);
    expect(installed(state)).toEqual([required]);
    assertReady(state);
  }, 20_000);

  it("P05 replaces an incompatible inherited timeout with verified Homebrew tools", () => {
    const state = fixture({ nativeTimeout: true, coreutils: true, bash: true });
    writeFileSync(join(state.nativeBin, "timeout"), `#!${tools.bash}\nprintf 'incompatible native timeout\\n'; exit 125\n`);
    expect(state.prepare().status).toBe(0);
    expect(installed(state)).toEqual([]);
    assertReady(state);
  }, 20_000);

  for (const [name, options] of [
    ["P06 fails closed when Homebrew is unavailable", { brew: false }],
    ["P07 fails closed when coreutils installation fails", { installFails: "coreutils" }],
    ["P08 fails closed when Bash installation fails", { coreutils: true, installFails: "bash" }],
    ["P09 fails closed when a formula prefix cannot be resolved", { coreutils: true, bash: true, prefixFails: "coreutils" }],
    ["P10 fails closed when successful installation leaves executables missing", { installOmitsTools: true }],
    ["P11 rejects a non-GNU timeout executable", { coreutils: true, bash: true, timeoutMode: "foreign" }],
    ["P12 rejects GNU-labelled timeout without kill-after support", { coreutils: true, bash: true, timeoutMode: "no-kill-after" }],
    ["P13 rejects GNU-labelled timeout with incorrect expiry status", { coreutils: true, bash: true, timeoutMode: "wrong-expiry" }],
    ["P14 rejects a modern-labelled Bash that cannot execute the fractional timer", { coreutils: true, bash: true, bashMode: "broken-timer" }],
    ["P15 fails when subsequent-step PATH publication is unavailable", { coreutils: true, bash: true, publication: "absent" }],
    ["P16 fails when the GitHub PATH target cannot be written", { coreutils: true, bash: true, publication: "directory" }],
  ] as const) it(name, () => {
    const state = fixture(options);
    const result = state.prepare();
    expect(result.status).not.toBe(0);
    expect(result.stderr.trim()).not.toBe("");
  }, 20_000);

  for (const os of ["Linux", "MINGW64_NT-10.0"] as const) {
    it(`P17 ${os} reuses its native GNU command without Homebrew or PATH publication`, () => {
      const state = fixture({ os, nativeTimeout: true });
      expect(state.prepare().status).toBe(0);
      expect(state.calls().filter((call) => call[0] === "brew")).toEqual([]);
      expect(state.published()).toEqual(["/already-published"]);
      expect(state.calls().some((call) => call[0] === "timeout")).toBe(true);
    }, 20_000);
    it(`P18 ${os} fails on missing native timeout without installing substitutes`, () => {
      const state = fixture({ os });
      expect(state.prepare().status).not.toBe(0);
      expect(state.calls().filter((call) => call[0] === "brew")).toEqual([]);
      expect(state.published()).toEqual(["/already-published"]);
    });
    it(`P19 ${os} rejects an incompatible native timeout without installing substitutes`, () => {
      const state = fixture({ os, nativeTimeout: true, timeoutMode: "foreign" });
      expect(state.prepare().status).not.toBe(0);
      expect(state.calls().filter((call) => call[0] === "brew")).toEqual([]);
      expect(state.published()).toEqual(["/already-published"]);
    });
  }

  it("W01 prepares release tools before unchanged coverage only in the macOS job", () => {
    type Step = { run?: string; shell?: string; if?: string; "continue-on-error"?: boolean };
    const workflow = load(readFileSync(resolve(".github/workflows/ci.yml"), "utf8")) as {
      jobs: Record<string, { "runs-on": string; steps: Step[] }>;
    };
    const macos = workflow.jobs["build-test-macos"];
    const setup = macos.steps.findIndex((step) => step.run?.trim() === "bash scripts/tooling/prepare-release-test-tools.sh");
    const coverage = macos.steps.findIndex((step) => step.run?.trim() === "npm run test:coverage");
    expect(setup).toBeGreaterThanOrEqual(0);
    expect(coverage).toBeGreaterThan(setup);
    expect(macos["runs-on"]).toMatch(/^macos-/);
    expect(macos.steps[setup]["continue-on-error"]).not.toBe(true);
    expect(macos.steps[setup].if).toBeUndefined();
    expect(macos.steps[setup].shell).toBe("bash");
    const owners = Object.entries(workflow.jobs).filter(([, job]) => job.steps.some((step) => step.run?.includes("prepare-release-test-tools.sh"))).map(([name]) => name);
    expect(owners).toEqual(["build-test-macos"]);
  });

  const nativeMac = process.platform === "darwin" ? it : it.skip;
  nativeMac("N01 macOS native routing retains modern Bash and real curl and exposes original-PATH rejection", () => {
    const root = mkdtempSync(join(tmpdir(), "t0203 native "));
    roots.push(root);
    mkdirSync(join(root, "bin"));
    const child = join(root, "env-child");
    writeFileSync(child, `#!/usr/bin/env bash\nprintf 'shebang\\t%s\\t%s\\n' "$BASH" "$BASH_VERSION"\n${timerCheck}\n`);
    chmodSync(child, 0o700);
    const env = { ...process.env, T0202_ROOT: root };
    const before = launch(["-c", 'export PATH="$T0202_ROOT/bin:/usr/bin:/bin:$PATH"; type -P curl'], env);
    expect(before.status).toBe(0);
    const beforePath = before.stdout.trim();
    const beforeHash = createHash("sha256").update(readFileSync(beforePath)).digest("hex");
    const source = readFileSync(resolve("tests/helpers/release-install-http-probe.py"), "utf8").replace(/\r\n/g, "\n");
    // Extract only the routing boundary, then execute it. No whole-helper golden.
    const routing = source.match(/SUPERVISOR = r'''\n([\s\S]*?)\nexport T0202_RPC_CLIENT=/)?.[1];
    expect(routing).toBeDefined();
    const selected = launch(["-c", `
base_path=$PATH
export PATH="$T0202_ROOT/bin:/usr/bin:/bin:$base_path"
printf 'curl-before\t%s\n' "$(type -P curl)"
export PATH="$base_path"
${routing}
printf 'curl-after\t%s\n' "$(type -P curl)"
printf 'parent\t%s\t%s\n' "$BASH" "$BASH_VERSION"
bash --noprofile --norc -c ${quote(`printf 'bare\\t%s\\t%s\\n' "$BASH" "$BASH_VERSION"; ${timerCheck}`)} || exit "$?"
${quote(child)} || exit "$?"`], env);
    expect(selected.status).toBe(0);
    const rows = new Map(selected.stdout.trim().split("\n").map((line) => {
      const [name, ...values] = line.split("\t");
      return [name, values] as const;
    }));
    for (const name of ["parent", "bare", "shebang"]) {
      const [path, version] = rows.get(name) || [];
      expect(realpathSync(path)).toBe(realpathSync(tools.bash));
      expect(Number(version.split(".")[0])).toBeGreaterThanOrEqual(4);
    }
    const curlBefore = rows.get("curl-before")?.[0];
    const curlAfter = rows.get("curl-after")?.[0];
    expect(curlBefore).toBeDefined();
    expect(curlBefore).toBe(beforePath);
    expect(curlAfter).toBe(curlBefore);
    expect(createHash("sha256").update(readFileSync(curlAfter!)).digest("hex"))
      .toBe(beforeHash);

    const nativeRead = launch(["-c", `${quote("/bin/bash")} --noprofile --norc -c ${quote('read -r -t 0.01 value </dev/null')}`]);
    expect(nativeRead.status).not.toBe(0);
    expect(nativeRead.stderr).toContain("invalid timeout specification");
    const nativeDescriptor = launch(["-c", `${quote("/bin/bash")} --noprofile --norc -c ${quote('exec {channel}</dev/null')}`]);
    expect(nativeDescriptor.status).not.toBe(0);

    const original = launch(["-c", `
export PATH="$T0202_ROOT/bin:/usr/bin:/bin:$PATH"
bash --noprofile --norc -c ${quote('printf "%s\\n" "$BASH"; read -r -t 0.01 value </dev/null')}`], env);
    expect(original.status).not.toBe(0);
    expect(realpathSync(original.stdout.trim())).toBe(realpathSync("/bin/bash"));
    expect(original.stderr).toContain("invalid timeout specification");
  }, 20_000);
});
