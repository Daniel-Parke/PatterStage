/** @jest-environment node */

import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { launch, quote, roots, timerCheck, tools } from "../helpers/release-test-tools-harness";

describe("T-0203 release test prerequisites", () => {
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
