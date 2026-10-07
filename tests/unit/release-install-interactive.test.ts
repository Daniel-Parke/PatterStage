/** @jest-environment node */

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

type Capture = { script: string; capturedHint: string; scenarioCleanupCalls: number; qaChecks: string[] };
type Report = { metadata: { nativeExecuted: boolean; scenarioIdentities: string[]; interactiveIdentities: string[] };
  captures: Record<string, Capture> };
let report: Report;

beforeAll(() => {
  // Portable generated-protocol checks. Native Expect is a separate --native --assert helper run.
  const emitted = spawnSync(process.env.PYTHON || "python", [resolve("tests/helpers/release-install-interactive-probe.py")],
    { encoding: "utf8", timeout: 10_000, maxBuffer: 1024 * 1024,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
  if (emitted.error || emitted.status !== 0) {
    throw new Error(`Actual scenario capture infrastructure failed: ${emitted.error?.message ?? emitted.stderr}`);
  }
  report = JSON.parse(emitted.stdout) as Report;
}, 15_000);

const port = "Port [Enter = auto]:";
const advanced = "Advanced: custom data directory, Hermes home, or update branch? [y/N]:";
const catalogue = "Install/refresh professional catalog now? [Y/n]:";
const flows = [
  { id: "setup_interactive", name: "I00 emitted setup protocol answers the catalogue after port and Advanced",
    steps: [[port, "\r"], [advanced, "n\r"], [catalogue, "y\r"]], qaChecks: [] },
  { id: "install_in_repo_interactive_profiles_no", name: "I01 emitted profiles-no protocol declines catalogue and missing profiles",
    steps: [[port, "\r"], [advanced, "n\r"], [catalogue, "n\r"], ["Copy missing bundled profile files to Hermes now? [y/N]:", "n\r"]],
    qaChecks: ["test ! -f /root/.hermes/profiles/qa/SOUL.md"] },
  { id: "install_in_repo_interactive_profiles_yes", name: "I02 emitted profiles-yes protocol declines catalogue and accepts missing profiles",
    steps: [[port, "\r"], [advanced, "n\r"], [catalogue, "n\r"], ["Copy missing bundled profile files to Hermes now? [y/N]:", "y\r"]],
    qaChecks: ["set -e\ntest -s /root/.hermes/profiles/qa/SOUL.md\ntest -s /root/.hermes/profiles/qa/AGENTS.md"] },
  { id: "install_bootstrap_interactive", name: "I03 emitted bootstrap protocol accepts catalogue and skips optional installs",
    steps: [["Hermes CLI not found. Install Hermes now? [Y/n]:", "n\r"], [port, "\r"], [advanced, "n\r"],
      [catalogue, "y\r"], ["Install bundled profile templates now? [y/N]:", "n\r"], ["Choice [d/n/s]:", "s"]], qaChecks: [] },
] as const;

describe("T-0202 portable emitted interactive protocol oracle", () => {
  for (const flow of flows) {
    it(flow.name, () => {
      const capture = report.captures[flow.id];
      expect(capture).toMatchObject({ capturedHint: flow.id, scenarioCleanupCalls: 1 });
      expect(capture.qaChecks.map((body) => body.trim())).toEqual(flow.qaChecks);
      // Inspect emitted operations, never source text. This does not execute Tcl or prove completion.
      const operations = capture.script.split(/\r?\n/).map((line) => line.trim())
        .filter((line) => /^(expect|send)\s/.test(line));
      expect(operations).toHaveLength(flow.steps.length * 2 + 1);
      for (const [index, [prompt, answer]] of flow.steps.entries()) {
        const pattern = /^expect -re \{(.*)\}$/.exec(operations[index * 2]);
        expect(pattern).not.toBeNull();
        // Prompt matching is a portable protocol assertion, not an Expect interpreter.
        expect(new RegExp(pattern![1]).test(prompt)).toBe(true);
        const sent = /^send(?: --)? (".*")$/.exec(operations[index * 2 + 1]);
        expect(sent).not.toBeNull();
        expect(JSON.parse(sent![1])).toBe(answer);
      }
      expect(operations.at(-1)).toBe("expect eof");
    });
  }

  it("I04 capture preserves all 15 release identities without a native unit-test dependency", () => {
    expect(report.metadata.nativeExecuted).toBe(false);
    expect(report.metadata.interactiveIdentities).toEqual(flows.map((flow) => flow.id));
    expect(report.metadata.scenarioIdentities).toEqual(["fresh", "hermes", "dashboard", "both", "update", "restart",
      "rebuild", "install_bootstrap", "install_in_repo", "update_preserves_user_data", "update_runs_seed_catalog",
      ...flows.map((flow) => flow.id)]);
  });
});
