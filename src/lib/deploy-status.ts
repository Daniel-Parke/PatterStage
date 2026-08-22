import { existsSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname } from "path";

import { getAgentWorkspace } from "@/lib/runtime/workspace";
import { ensureDir } from "@/lib/fs/fs-helpers";

function deployStatusDir(): string {
  return dirname(deployStatusPath());
}

type DeployState = "idle" | "running" | "success" | "failed";

export interface DeployStatus {
  state: DeployState;
  action: string;
  phase: string;
  message: string;
  startedAt: string;
  finishedAt: string;
  exitCode: string;
  logHint: string;
}

const DEPLOY_STATUS_BASENAME = "ps-deploy.status";
const LEGACY_DEPLOY_STATUS_BASENAME = "ch-deploy.status";
const STALE_RUNNING_MS = 45 * 60 * 1000;

/** Canonical (write) path for the deploy status file. */
function deployStatusPath(): string {
  return getAgentWorkspace().logs + "/" + DEPLOY_STATUS_BASENAME;
}

/** Read path: prefer the new ps- file; fall back to a legacy ch- file written
 *  by a pre-rename deploy still in flight during the first update. */
function deployStatusReadPath(): string {
  const p = deployStatusPath();
  if (existsSync(p)) return p;
  const legacy = getAgentWorkspace().logs + "/" + LEGACY_DEPLOY_STATUS_BASENAME;
  return existsSync(legacy) ? legacy : p;
}

function parseStatusFile(raw: string): DeployStatus {
  const fields: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    fields[line.slice(0, idx)] = line.slice(idx + 1);
  }
  const state = fields.state ?? "idle";
  const valid: DeployState[] = ["idle", "running", "success", "failed"];
  return {
    state: valid.includes(state as DeployState) ? (state as DeployState) : "idle",
    action: fields.action ?? "",
    phase: fields.phase ?? "",
    message: fields.message ?? "",
    startedAt: fields.startedAt ?? "",
    finishedAt: fields.finishedAt ?? "",
    exitCode: fields.exitCode ?? "",
    logHint: fields.logHint ?? "",
  };
}

function isStaleRunning(status: DeployStatus): boolean {
  if (status.state !== "running" || !status.startedAt) return false;
  const started = Date.parse(status.startedAt);
  if (Number.isNaN(started)) return false;
  return Date.now() - started > STALE_RUNNING_MS;
}

export function readDeployStatus(): DeployStatus {
  const path = deployStatusReadPath();
  if (!existsSync(path)) {
    return {
      state: "idle",
      action: "",
      phase: "",
      message: "Ready",
      startedAt: "",
      finishedAt: "",
      exitCode: "",
      logHint: "",
    };
  }
  try {
    const status = parseStatusFile(readFileSync(path, "utf-8"));
    if (isStaleRunning(status)) {
      const stale: DeployStatus = {
        ...status,
        state: "failed",
        message: "Deploy status stale (timed out) — check ps-restart.log",
        logHint: "ps-restart.log",
        finishedAt: new Date().toISOString(),
        exitCode: "1",
      };
      // Persist the rewrite so subsequent reads see the terminal state.
      // Without this, isDeployInProgress() (which reads the same file)
      // would keep reporting "running" until 45 min after the original
      // startedAt, blocking the user from issuing a new deploy.
      try {
        const body = [
          `state=${stale.state}`,
          `action=${stale.action}`,
          `phase=${stale.phase}`,
          `message=${stale.message.replace(/\n/g, " ")}`,
          `startedAt=${stale.startedAt}`,
          `finishedAt=${stale.finishedAt}`,
          `exitCode=${stale.exitCode}`,
          `logHint=${stale.logHint}`,
        ].join("\n");
        const tmp = path + ".tmp";
        writeFileSync(tmp, body, "utf-8");
        renameSync(tmp, path);
      } catch {
        // non-fatal — the in-memory return value is still correct
      }
      return stale;
    }
    return status;
  } catch {
    return {
      state: "idle",
      action: "",
      phase: "",
      message: "Ready",
      startedAt: "",
      finishedAt: "",
      exitCode: "",
      logHint: "",
    };
  }
}

export function isDeployInProgress(): boolean {
  const status = readDeployStatus();
  if (status.state !== "running") return false;
  // Honor the stale-running detection. A status file stuck in "running" for
  // longer than STALE_RUNNING_MS means the deploy script crashed/was killed
  // and never wrote a terminal state. Without this, a stuck status from a
  // silent failure (e.g. lock contention with a stuck process) permanently
  // blocks the user from issuing a new deploy until they manually clear the
  // status file. See skills/devops/patterstage-scripts "stale deploy lock"
  // pitfall (discovered 2026-06-08).
  if (!status.startedAt) return true;
  const started = Date.parse(status.startedAt);
  if (Number.isNaN(started)) return true;
  return Date.now() - started <= STALE_RUNNING_MS;
}

/** Optimistic status before detached ps-deploy starts (bridges spawn sleep). */
export function writeDeployStatusRunning(
  action: string,
  phase: string,
  message: string,
): void {
  const path = deployStatusPath();
  try {
    ensureDir(deployStatusDir());
    const startedAt = new Date().toISOString();
    const tmp = path + ".tmp";
    const body = [
      "state=running",
      `action=${action}`,
      `phase=${phase}`,
      `message=${message.replace(/\n/g, " ")}`,
      `startedAt=${startedAt}`,
      "finishedAt=",
      "exitCode=",
      "logHint=ps-restart.log",
    ].join("\n");
    writeFileSync(tmp, body, "utf-8");
    renameSync(tmp, path);
  } catch {
    // non-fatal
  }
}

export function tailLogHint(logHint: string, maxLines = 20): string[] {
  if (!logHint) return [];
  const base = logHint.replace(/\.log$/i, "");
  const path = getAgentWorkspace().logs + "/" + base + ".log";
  if (!existsSync(path)) return [];
  try {
    const lines = readFileSync(path, "utf-8").split("\n");
    return lines.slice(-maxLines).filter(Boolean);
  } catch {
    return [];
  }
}
