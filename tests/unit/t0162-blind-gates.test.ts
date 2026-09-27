/** @jest-environment node */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classifyControls } from "../../scripts/tooling/check-form-control-names.mjs";
import { violationsIn } from "../../scripts/tooling/design-lint.mjs";

const ROOT = join(__dirname, "..", "..");

function writeHits(path: string, source: string): number {
  const found = violationsIn(path, source.split("\n"));
  return found.get(`no-raw-write-outside-the-helper::${path}`)?.length ?? 0;
}

describe("T-0162 · the remaining gates see their subjects", () => {
  it("the raw-write rule detects a bare fetch POST in a screen", () => {
    expect(writeHits("src/app/recroom/story-weaver/create/page.tsx", 'await fetch("/api/story", { method: "POST", body: "{}" });')).toBe(1);
  });

  it("the raw-write rule reaches client hooks and the chat client module", () => {
    const source = 'await fetch("/api/chat", { method: "POST", body: "{}" });';
    expect(writeHits("src/hooks/useChatSend.ts", source)).toBe(1);
    expect(writeHits("src/lib/chat/chat-utils.ts", source)).toBe(1);
  });

  it("the read census sees current cross-file effect reads", () => {
    const output = execFileSync(process.execPath, [join(ROOT, "scripts", "tooling", "line-census.mjs"), "--report"], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    const report = JSON.parse(output) as { reads: { files: string[] } };
    expect(report.reads.files).toContain("src/hooks/useMissionsData.ts");
    expect(report.reads.files).toContain("src/hooks/useChatSend.ts");
  });

  it("the form-name gate detects unnamed house primitives and accepts contextual names", () => {
    const bare = classifyControls('const Form = () => <><Select /><NumberInput /></>;', "form.tsx");
    expect(bare.controls).toBe(2);
    expect(bare.unnamed).toHaveLength(2);

    const named = classifyControls('const Form = () => <><Select ariaLabel="Model" /><NumberInput aria-label="Limit" /></>;', "form.tsx");
    expect(named.controls).toBe(2);
    expect(named.unnamed).toHaveLength(0);
  });

  it("Knip includes test and harness sources in its actual entry and project scope", () => {
    const config = JSON.parse(readFileSync(join(ROOT, "knip.json"), "utf8")) as { entry: string[]; project: string[] };
    const includes = (glob: string[], prefix: string) => glob.some((item) => item.startsWith(prefix));
    for (const prefix of ["tests/", "test-harness/"]) {
      expect(includes(config.entry, prefix)).toBe(true);
      expect(includes(config.project, prefix)).toBe(true);
    }
  });
});
