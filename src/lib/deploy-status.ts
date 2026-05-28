import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";

import { getActiveHermesPaths } from "@/lib/hermes-agent-runtime";

function deployStatusDir(): string {
  const p = deployStatusPath();
  const slash = p.lastIndexOf("/");
  return slash >= 0 ? p.slice(0, slash) : p;
}

export type DeployState = "idle" | "running" | "success" | "failed";

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

const DEPLOY_STATUS_BASENAME = "ch-deploy.status";
const STALE_RUNNING_MS = 45 * 60 * 1000;

function deployStatusPath(): string {
  return getActiveHermesPaths().logs + "/" + DEPLOY_STATUS_BASENAME;
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
  const path = deployStatusPath();
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
      return {
        ...status,
        state: "failed",
        message: "Deploy status stale (timed out) — check ch-restart.log",
        logHint: "ch-restart.log",
      };
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
  return readDeployStatus().state === "running";
}

/** Optimistic status before detached ch-deploy starts (bridges spawn sleep). */
export function writeDeployStatusRunning(
  action: string,
  phase: string,
  message: string,
): void {
  const path = deployStatusPath();
  try {
    mkdirSync(deployStatusDir(), { recursive: true });
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
      "logHint=ch-restart.log",
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
  const path = getActiveHermesPaths().logs + "/" + base + ".log";
  if (!existsSync(path)) return [];
  try {
    const lines = readFileSync(path, "utf-8").split("\n");
    return lines.slice(-maxLines).filter(Boolean);
  } catch {
    return [];
  }
}
