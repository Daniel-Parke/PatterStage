// T-0204 independent CLI oracle adapter. This is a finite scanner substitute,
// not an implementation of Gitleaks rules. Real Git is always forwarded.
import crypto from "node:crypto";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { syncBuiltinESMExports } from "node:module";

const scannerName = "t0204-test-scanner";
const forcedLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopA";
const originalRandomBytes = crypto.randomBytes;
const originalSpawnSync = childProcess.spawnSync;
const originalExecFileSync = childProcess.execFileSync;
const originalMkdtempSync = fs.mkdtempSync;
const originalRmSync = fs.rmSync;
const roots = [];
const scans = [];
const gitCalls = [];
const candidates = new Set([forcedLetters]);
const balancedHash = "b71d62069ae86ead306feee85b6107c8f79e179e5babc1adfdd81ff8073d3f38";
const missedHashes = new Set(["04aa70c5c380b9359b3025f7191017b850313ee7c96df9cc2751b7f7da682f4e",
  "0f007385b6f9d4b7eeb2748605afe1a984a0a3bfa3f014d09e2a784ce9e5cd1a"]);
const mode = process.env.T0204_ORACLE_MODE || "real";
const receiptPath = process.env.T0204_ORACLE_RECEIPT;
if (!receiptPath) throw new Error("T-0204 oracle receipt path required");
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const sanitise = (value) => {
  let text = String(value ?? "");
  for (const candidate of candidates) text = text.split(candidate).join("[REDACTED]");
  return text;
};
const argument = (args, name) => {
  const index = args.indexOf(name);
  return index < 0 ? args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1) : args[index + 1];
};

crypto.randomBytes = function (size, callback) {
  if (size !== 32 || !process.env.T0204_ORACLE_RANDOM) return originalRandomBytes(size, callback);
  const bytes = process.env.T0204_ORACLE_RANDOM === "letters" ? Buffer.from(forcedLetters, "base64url")
    : Buffer.alloc(size, process.env.T0204_ORACLE_RANDOM === "ones" ? 255 : 0);
  candidates.add(bytes.toString("base64url"));
  if (typeof callback === "function") { queueMicrotask(() => callback(null, bytes)); return; }
  return bytes;
};

fs.mkdtempSync = function (...args) {
  const root = originalMkdtempSync(...args);
  roots.push({ path: String(root), created: true, removals: [] });
  return root;
};
fs.rmSync = function (target, options) {
  const owned = roots.find((root) => path.resolve(root.path) === path.resolve(String(target)));
  if (owned) owned.removals.push({ recursive: options?.recursive === true, force: options?.force === true });
  return originalRmSync(target, options);
};

function git(args, cwd) {
  const result = originalSpawnSync("git", args, { cwd, encoding: "utf8", timeout: 120_000, maxBuffer: 1024 * 1024 });
  if (result.error || result.signal || result.status !== 0) throw new Error("T-0204 oracle real Git witness failed");
  return result.stdout.trim();
}

function snapshot(args, options) {
  const owned = roots.find((root) => fs.existsSync(path.join(root.path, ".git")));
  if (!owned) throw new Error("T-0204 oracle scanner lacks owned real Git repository");
  const root = owned.path;
  const plantedPath = path.join(root, "planted.txt");
  let candidate = null;
  if (fs.existsSync(plantedPath)) {
    const values = fs.readFileSync(plantedPath, "utf8").match(/[A-Za-z0-9_-]{32,}/g) || [];
    if (values.length !== 1) throw new Error("T-0204 oracle candidate extraction ambiguous");
    candidates.add(values[0]);
    candidate = { sha256: hash(values[0]), length: values[0].length,
      letters: (values[0].match(/[A-Za-z]/g) || []).length,
      digits: (values[0].match(/[0-9]/g) || []).length,
      other: /[^A-Za-z0-9]/.test(values[0]) };
  }
  const copied = [".gitleaks.toml", ".gitleaksignore"].map((name) => ({ name,
    exists: fs.existsSync(path.join(root, name)),
    matchesRoot: fs.existsSync(path.join(root, name)) && hash(fs.readFileSync(path.join(root, name))) === hash(fs.readFileSync(path.resolve(name))) }));
  return { args: args.map(sanitise), timeout: options?.timeout ?? null,
    root, copied, candidate, head: git(["rev-parse", "HEAD"], root),
    commits: Number(git(["rev-list", "--count", "HEAD"], root)),
    committedFiles: git(["ls-tree", "-r", "--name-only", "HEAD"], root).split("\n"),
    plantedHistory: candidate ? git(["log", "--format=%H", "--", "planted.txt"], root).split("\n") : [],
    freshReport: reportLocation(args, root) ? !fs.existsSync(reportLocation(args, root)) : null };
}

function reportLocation(args, root) {
  const report = argument(args, "--report-path");
  if (!report) return null;
  if (path.isAbsolute(report) && report.startsWith(root)) return report;
  // The pinned container mounts the owned repository. Native paths remain exact.
  if (report.startsWith("/probe/")) return path.join(root, report.slice("/probe/".length));
  return path.isAbsolute(report) ? report : path.resolve(root, report);
}

function fakeScanner(args, options, scan) {
  const report = reportLocation(args, scan.root);
  if (!report) throw new Error("T-0204 oracle missing report argument");
  const result = { status: 0, signal: null, error: undefined, stdout: "", stderr: "", pid: process.pid, output: [null, "", ""] };
  const planted = scan.candidate !== null;
  if (mode === "launch") { result.status = null; result.error = Object.assign(new Error("controlled scanner unavailable"), { code: "ENOENT" }); return result; }
  if (mode === "timeout") { result.status = null; result.signal = "SIGTERM"; result.error = Object.assign(new Error("controlled scanner deadline"), { code: "ETIMEDOUT" }); return result; }
  let findings = [];
  // Exact finite values were calibrated against the unchanged pinned scanner.
  // Uncalibrated candidates fail the oracle infrastructure, never count as red.
  if (planted) {
    if (scan.candidate.sha256 === balancedHash) findings = [{ RuleID: "generic-api-key", File: "planted.txt", Commit: scan.head, Secret: "REDACTED" }];
    else if (!missedHashes.has(scan.candidate.sha256)) throw new Error("T-0204 oracle uncalibrated candidate");
  }
  if (!planted && mode === "clean-findings") findings = [{ RuleID: "generic-api-key", File: "clean.txt", Commit: scan.head, Secret: "REDACTED" }];
  if (planted && mode === "miss") findings = [];
  if (planted && mode === "wrong-rule") findings = [{ RuleID: "unrelated-rule", File: "planted.txt", Commit: scan.head, Secret: "REDACTED" }];
  if (planted && mode === "wrong-file") findings = [{ RuleID: "generic-api-key", File: "unrelated.txt", Commit: scan.head, Secret: "REDACTED" }];
  if (planted && (mode === "wrong-detection-exit" || mode === "invalid-exit")) {
    findings = [{ RuleID: "generic-api-key", File: "planted.txt", Commit: scan.head, Secret: "REDACTED" }];
  }
  result.status = findings.length ? 1 : 0;
  if (!planted && mode === "clean-findings") result.status = 0;
  if ((!planted && mode === "clean-refusal") || (planted && mode === "invalid-exit")) result.status = 2;
  if (planted && mode === "wrong-detection-exit") result.status = 0;
  if (mode !== "missing-report") fs.writeFileSync(report, mode === "malformed-report" ? "{invalid JSON" : JSON.stringify(findings));
  return result;
}

function scannerCall(command, args, options) {
  const scan = snapshot(args, options);
  const result = command === scannerName ? fakeScanner(args, options, scan) : originalSpawnSync(command, args, options);
  recordScan(scan, args, result);
  return result;
}

function recordScan(scan, args, result) {
  const report = reportLocation(args, scan.root);
  let findings = null;
  if (report && fs.existsSync(report)) {
    try { findings = JSON.parse(fs.readFileSync(report, "utf8")).map((finding) => ({ RuleID: finding.RuleID, File: finding.File, Commit: finding.Commit })); }
    catch { findings = "malformed"; }
  }
  scans.push({ ...scan, status: result.status, signal: result.signal, errorCode: result.error?.code ?? null, findings });
}

childProcess.spawnSync = function (command, args, options) {
  args = args || [];
  if (command === scannerName || path.basename(command).replace(/\.exe$/i, "") === "docker") return scannerCall(command, args, options);
  const result = originalSpawnSync(command, args, options);
  if (path.basename(command).replace(/\.exe$/i, "") === "git") gitCalls.push({ args: args.map(sanitise), timeout: options?.timeout ?? null,
    status: result.status, signal: result.signal, errorCode: result.error?.code ?? null });
  return result;
};
childProcess.execFileSync = function (command, args, options) {
  args = args || [];
  const name = path.basename(command).replace(/\.exe$/i, "");
  if (command === scannerName || name === "docker") {
    const scan = snapshot(args, options);
    if (command !== scannerName) {
      try {
        const output = originalExecFileSync(command, args, options);
        recordScan(scan, args, { status: 0, signal: null });
        return output;
      } catch (error) {
        recordScan(scan, args, error);
        throw error;
      }
    }
    const result = fakeScanner(args, options, scan);
    recordScan(scan, args, result);
    if (result.error) throw result.error;
    if (result.status !== 0) throw Object.assign(new Error("controlled scanner nonzero exit"), result);
    return result.stdout;
  }
  try {
    const output = originalExecFileSync(command, args, options);
    if (name === "git") gitCalls.push({ args: args.map(sanitise), timeout: options?.timeout ?? null, status: 0, signal: null, errorCode: null });
    return output;
  } catch (error) {
    if (name === "git") gitCalls.push({ args: args.map(sanitise), timeout: options?.timeout ?? null, status: error.status ?? null, signal: error.signal ?? null, errorCode: error.code ?? null });
    throw error;
  }
};
syncBuiltinESMExports();

process.on("exit", (code) => {
  fs.writeFileSync(receiptPath, JSON.stringify({ mode, forcedRandom: process.env.T0204_ORACLE_RANDOM || null,
    normalProcessExit: code, scannerSubstitute: process.env.GITLEAKS_BIN === scannerName,
    roots: roots.map((root) => ({ ...root, existsAfter: fs.existsSync(root.path) })), scans, gitCalls }, null, 2) + "\n");
});
