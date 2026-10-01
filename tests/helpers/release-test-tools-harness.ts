// Equivalent shared T-0203 ORACLE launcher, discovery and owned cleanup.
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const bootstrap = process.env.T0203_BASH || (process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash");
export const tools: Record<string, string> = {};
export const roots: string[] = [];
export const shellPath = (path: string) => path.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_, drive: string) => `/${drive.toLowerCase()}`);
export const quote = (value: string) => `'${value.replace(/'/g, "'\\''")}'`;
export const timerCheck = 'exec {channel}< <(sleep 0.2); value=""; IFS= read -r -t 0.01 -u "$channel" value; status=$?; exec {channel}<&-; [[ "$status" == 142 && -z "$value" ]]';

export function launch(args: string[], env: NodeJS.ProcessEnv = process.env) {
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

