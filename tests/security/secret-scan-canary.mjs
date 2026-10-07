import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const directory = mkdtempSync(join(tmpdir(), "patterstage-gitleaks-canary-"));
const pinnedImage = "ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f";

function command(binary, args, cwd) {
  try {
    execFileSync(binary, args, { cwd, stdio: "pipe", timeout: 120_000 });
    return 0;
  } catch (error) {
    if (error.code === "ETIMEDOUT" || error.signal) throw new Error(`${binary} timed out or terminated`);
    if (typeof error.status !== "number") throw new Error(`${binary} failed to launch`);
    return error.status;
  }
}

function scan() {
  const report = join(directory, "scan-report.json");
  if (existsSync(report)) rmSync(report);
  const native = process.env.GITLEAKS_BIN;
  const common = ["git", ".", "--no-banner", "--redact=100", "--report-format", "json"];
  const exit = native
    ? command(native, [...common, "--config", join(directory, ".gitleaks.toml"), "--gitleaks-ignore-path", join(directory, ".gitleaksignore"), "--report-path", report], directory)
    : command("docker", ["run", "--rm", "--network", "none", "--mount", `type=bind,source=${directory},target=/probe`, "--workdir", "/probe", pinnedImage, ...common, "--config", "/probe/.gitleaks.toml", "--gitleaks-ignore-path", "/probe/.gitleaksignore", "--report-path", "/probe/scan-report.json"], directory);
  if (exit !== 0 && exit !== 1) throw new Error(`Scanner infrastructure failure: invalid exit ${exit}`);
  if (!existsSync(report)) throw new Error("Scanner infrastructure failure: missing JSON report");
  let findings;
  try {
    findings = JSON.parse(readFileSync(report, "utf8"));
    if (!Array.isArray(findings) || findings.some(finding => !finding ||
        typeof finding.RuleID !== "string" || typeof finding.File !== "string")) {
      throw new Error("Invalid report shape");
    }
  } catch {
    throw new Error("Scanner infrastructure failure: malformed JSON report");
  }
  return { exit, findings };
}

try {
  cpSync(join(root, ".gitleaks.toml"), join(directory, ".gitleaks.toml"));
  cpSync(join(root, ".gitleaksignore"), join(directory, ".gitleaksignore"));
  if (command("git", ["init", "-q"], directory) !== 0) throw new Error("Cannot initialise canary repository");
  for (const [key, value] of [["user.name", "PatterStage canary"], ["user.email", "canary@example.invalid"]]) {
    if (command("git", ["config", key, value], directory) !== 0) throw new Error("Cannot configure canary repository");
  }
  if (command("git", ["add", ".gitleaks.toml", ".gitleaksignore"], directory) !== 0 ||
      command("git", ["commit", "-qm", "clean control"], directory) !== 0) throw new Error("Cannot commit clean control");
  const clear = scan();
  if (clear.exit !== 0 || clear.findings.length !== 0) throw new Error("Configured scanner failed the clean control");

  // A balanced synthetic value avoids the default rule's letters-only allowance.
  const plantedValue = Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index) + String(index % 10)).join("");
  writeFileSync(join(directory, "planted.txt"), `api_key = "${plantedValue}"\n`);
  if (command("git", ["add", "planted.txt"], directory) !== 0 ||
      command("git", ["commit", "-qm", "planted control"], directory) !== 0) throw new Error("Cannot commit planted control");
  const planted = scan();
  if (planted.exit !== 1 || !planted.findings.some((finding) => finding.File === "planted.txt" && finding.RuleID === "generic-api-key")) {
    throw new Error("Configured scanner did not reject the planted history secret");
  }
  process.stdout.write("Gitleaks clean control passed; planted history secret was detected.\n");
} finally {
  rmSync(directory, { recursive: true, force: true });
}
