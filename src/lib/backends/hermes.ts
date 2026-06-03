// ═══════════════════════════════════════════════════════════════
// backends/hermes.ts — Hermes mission dispatch backend
// ═══════════════════════════════════════════════════════════════

import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execSync, spawn } from "child_process";
import { randomUUID } from "crypto";

import { PATHS } from "../paths";
import { resolveProfileHermesHome } from "../hermes-profile-paths";
import { ensureDir } from "../fs-helpers";
import { envVarForProvider } from "../hermes-providers";
import { messageFromError } from "@/lib/api-fetch";
import type {
  Mission,
  DispatchMissionInput,
  MissionStatus,
} from "../agent-backend/types";
import type { AgentBackend, MissionCancelResult } from "../agent-backend";
import { logApiError } from "../api-logger";
import { findModelByModelId, getDefaultModel } from "../models-repository";
import { getCredentialWithKey } from "../credentials-repository";

interface BuildHermesChatArgvInput {
  profileName?: string;
  modelId?: string;
  provider?: string;
  source: string;
}

export function buildHermesChatArgv(input: BuildHermesChatArgvInput): string[] {
  const argv: string[] = [];
  if (input.profileName && input.profileName.trim().length > 0) {
    argv.push("--profile", input.profileName);
  }
  argv.push("chat");
  if (input.modelId && input.modelId.trim().length > 0) {
    argv.push("--model", input.modelId);
  }
  if (input.provider && input.provider.trim().length > 0) {
    argv.push("--provider", input.provider);
  }
  argv.push("--quiet", "--source", input.source, "--pass-session-id");
  return argv;
}

function shellQuote(value: string): string {
  if (value.length === 0) return "''";
  if (/^[A-Za-z0-9_./:@%+=-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export async function resolveMissionModel(input: {
  modelId?: string;
  provider?: string;
}): Promise<{ modelId: string; provider: string; apiKey: string | null }> {
  const trimmedId = input.modelId?.trim() ?? "";
  const trimmedProvider = input.provider?.trim() ?? "";

  if (trimmedId && trimmedProvider) {
    return { modelId: trimmedId, provider: trimmedProvider, apiKey: null };
  }

  if (trimmedId) {
    const model = findModelByModelId(trimmedId);
    if (model) {
      let apiKey: string | null = null;
      if (model.credentialsId) {
        const cred = getCredentialWithKey(model.credentialsId);
        apiKey = cred?.apiKey ?? null;
      }
      return { modelId: model.modelId, provider: model.provider, apiKey };
    }
  }

  try {
    const defaultModel = getDefaultModel("agent");
    if (defaultModel) {
      let apiKey: string | null = null;
      if (defaultModel.credentialsId) {
        const cred = getCredentialWithKey(defaultModel.credentialsId);
        apiKey = cred?.apiKey ?? null;
      }
      return {
        modelId: defaultModel.modelId,
        provider: defaultModel.provider,
        apiKey,
      };
    }
  } catch (err) {
    logApiError("resolveMissionModel", "registry lookup", err);
  }

  return { modelId: "", provider: "", apiKey: null };
}

async function ensureProfileAuth(
  profileName: string,
  apiKey: string | null,
  provider: string,
): Promise<void> {
  if (!apiKey || !profileName || profileName === "default") return;

  const profilePath = resolveProfileHermesHome(profileName);
  const authPath = join(profilePath, "auth.json");
  const envPath = join(profilePath, ".env");

  let existingAuth: Record<string, unknown> = {};
  if (existsSync(authPath)) {
    try {
      existingAuth = JSON.parse(readFileSync(authPath, "utf-8")) as Record<string, unknown>;
    } catch {
      /* ignore */
    }
  }

  const pool = (existingAuth["credential_pool"] as Record<string, string[]> | undefined) ?? {};
  const authProviders =
    (existingAuth["providers"] as Record<string, { api_key?: string }> | undefined) ?? {};

  const needsAuthWrite =
    authProviders[provider]?.api_key !== apiKey ||
    !Array.isArray(pool[provider]) ||
    !pool[provider].includes(provider);

  if (needsAuthWrite) {
    const updated = {
      version: 1,
      providers: { ...authProviders, [provider]: { api_key: apiKey } },
      credential_pool: { ...pool, [provider]: [provider] },
    };
    try {
      ensureDir(profilePath);
      writeFileSync(authPath, JSON.stringify(updated, null, 2));
    } catch (err) {
      logApiError("ensureProfileAuth", `auth profile=${profileName}`, err);
    }
  }

  const envVar = envVarForProvider(provider);
  if (!envVar) return; // OAuth-only providers have no .env key

  let existingEnv = "";
  if (existsSync(envPath)) {
    existingEnv = readFileSync(envPath, "utf-8");
  }
  const envLines = existingEnv.split("\n").filter((l) => !l.startsWith(`${envVar}=`));
  envLines.push(`${envVar}=${apiKey}`);

  try {
    writeFileSync(envPath, envLines.join("\n") + "\n");
  } catch (err) {
    logApiError("ensureProfileAuth", `env profile=${profileName}`, err);
  }
}

const KILL_GRACE_MS = 3000;

interface SpawnHermesChatInput {
  argv: string[];
  prompt: string;
  missionId: string;
  statusFile: string;
  outputFile: string;
  sessionFile: string;
  hermesHome: string;
}

function missionPidPath(missionId: string): string {
  return join(PATHS.missions, `${missionId}.pid.json`);
}

function missionScriptPath(missionId: string): string {
  return join(tmpdir(), `hermes_mission_${missionId}.sh`);
}

function writeMissionPidFile(missionId: string, pid: number): void {
  writeFileSync(
    missionPidPath(missionId),
    JSON.stringify({ pid, startedAt: new Date().toISOString() }, null, 2),
  );
}

function readMissionPid(missionId: string): number | null {
  const path = missionPidPath(missionId);
  if (!existsSync(path)) return null;
  try {
    const data = JSON.parse(readFileSync(path, "utf-8")) as { pid?: number };
    return typeof data.pid === "number" && data.pid > 0 ? data.pid : null;
  } catch {
    return null;
  }
}

function signalProcessGroup(pid: number, signal: NodeJS.Signals): boolean {
  try {
    process.kill(-pid, signal);
    return true;
  } catch {
    try {
      process.kill(pid, signal);
      return true;
    } catch {
      return false;
    }
  }
}

function pkillByMissionId(missionId: string, signal: "TERM" | "KILL"): void {
  if (process.platform === "win32") return;
  const pattern = `CH_MISSION_ID=${missionId}`;
  try {
    execSync(`pkill -${signal} -f ${shellQuote(pattern)} 2>/dev/null || true`, {
      stdio: "ignore",
    });
  } catch {
    /* best-effort */
  }
}

function writeCancelledStatus(missionId: string): void {
  const statusPath = join(PATHS.missions, `${missionId}.status.json`);
  const payload = {
    status: "failed",
    exit_code: null,
    completed_at: new Date().toISOString(),
    error: "Cancelled by user",
  };
  writeFileSync(statusPath, JSON.stringify(payload) + "\n");
}

export function spawnHermesChatWithStatusCallback(input: SpawnHermesChatInput): number {
  const promptArg = `-q "$CH_MISSION_PROMPT"`;
  const argvStr = input.argv.map(shellQuote).join(" ");
  const scriptLines = [
    "#!/bin/bash",
    "set -e",
    `hermes ${argvStr} ${promptArg} > ${shellQuote(input.sessionFile)} 2>&1`,
    "ec=$?",
    `cat ${shellQuote(input.sessionFile)} >> ${shellQuote(input.outputFile)}`,
    `if [ "$ec" -eq 0 ]; then printf '{"status":"successful","exit_code":%s,"completed_at":"%s"}\\n' "$ec" "$(date -u +%FT%TZ)" > ${shellQuote(input.statusFile)}; else printf '{"status":"failed","exit_code":%s,"completed_at":"%s","error":"hermes chat exited %s"}\\n' "$ec" "$(date -u +%FT%TZ)" "$ec" > ${shellQuote(input.statusFile)}; fi`,
  ];

  const scriptPath = missionScriptPath(input.missionId);
  writeFileSync(scriptPath, scriptLines.join("\n") + "\n");

  const child = spawn("bash", [scriptPath], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      HERMES_HOME: input.hermesHome,
      CH_MISSION_PROMPT: input.prompt,
      CH_MISSION_ID: input.missionId,
    },
  });

  const pid = child.pid;
  if (pid == null || pid <= 0) {
    throw new Error("Failed to spawn mission process");
  }

  writeMissionPidFile(input.missionId, pid);
  child.unref();
  return pid;
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function cancelMissionProcess(
  missionId: string,
): Promise<MissionCancelResult> {
  const pid = readMissionPid(missionId);
  let processKilled = false;

  if (pid != null) {
    processKilled = signalProcessGroup(pid, "SIGTERM");
  }
  pkillByMissionId(missionId, "TERM");

  await new Promise((resolve) => setTimeout(resolve, KILL_GRACE_MS));

  if (pid != null && isPidAlive(pid)) {
    signalProcessGroup(pid, "SIGKILL");
    pkillByMissionId(missionId, "KILL");
    await new Promise((resolve) => setTimeout(resolve, 300));
    processKilled = !isPidAlive(pid);
  } else if (pid != null) {
    processKilled = true;
  } else {
    pkillByMissionId(missionId, "KILL");
    processKilled = true;
  }

  writeCancelledStatus(missionId);

  const scriptPath = missionScriptPath(missionId);
  if (existsSync(scriptPath)) {
    try {
      unlinkSync(scriptPath);
    } catch {
      /* ignore */
    }
  }

  const pidPath = missionPidPath(missionId);
  if (existsSync(pidPath)) {
    try {
      unlinkSync(pidPath);
    } catch {
      /* ignore */
    }
  }

  return {
    processKilled,
    error: processKilled ? null : "Could not confirm mission process stopped",
  };
}

export class HermesAgentBackend implements AgentBackend {
  async dispatchMission(input: DispatchMissionInput): Promise<Mission> {
    const id = input.missionId ?? randomUUID();
    const now = new Date().toISOString();
    const mission: Mission = {
      id,
      name: input.name,
      prompt: input.prompt,
      profileId: input.profileId,
      status: "dispatched",
      createdAt: now,
      updatedAt: now,
    };

    const missionsDir = PATHS.missions;
    ensureDir(missionsDir);

    const missionFile = join(missionsDir, `${id}.json`);
    const statusFile = join(missionsDir, `${id}.status.json`);
    const outputFile = join(missionsDir, `${id}.output.log`);
    const sessionFile = join(missionsDir, `${id}.session`);

    writeFileSync(missionFile, JSON.stringify(mission, null, 2));

    const resolved = await resolveMissionModel({
      modelId: input.modelId,
      provider: input.provider,
    });

    if (resolved.apiKey) {
      await ensureProfileAuth(input.profileName ?? "default", resolved.apiKey, resolved.provider);
    }

    const profileName = input.profileName ?? "default";
    const profileHome = resolveProfileHermesHome(profileName);

    const cliArgv = buildHermesChatArgv({
      profileName: input.profileName,
      modelId: resolved.modelId || undefined,
      provider: resolved.provider || undefined,
      source: "control-hub-mission",
    });

    spawnHermesChatWithStatusCallback({
      argv: cliArgv,
      prompt: input.prompt,
      missionId: id,
      statusFile,
      outputFile,
      sessionFile,
      hermesHome: profileHome,
    });

    return mission;
  }

  async cancelMission(missionId: string): Promise<MissionCancelResult> {
    try {
      return await cancelMissionProcess(missionId);
    } catch (err) {
      logApiError("HermesAgentBackend.cancelMission", missionId, err);
      writeCancelledStatus(missionId);
      return {
        processKilled: false,
        error: messageFromError(err, ""),
      };
    }
  }

  async getMissionStatus(missionId: string): Promise<MissionStatus> {
    try {
      const statusPath = join(PATHS.missions, `${missionId}.status.json`);
      if (existsSync(statusPath)) {
        const data = JSON.parse(readFileSync(statusPath, "utf-8"));
        const status = data?.status as MissionStatus | undefined;
        if (
          status === "queued" ||
          status === "dispatched" ||
          status === "successful" ||
          status === "failed"
        ) {
          return status;
        }
      }
      const missionPath = join(PATHS.missions, `${missionId}.json`);
      if (existsSync(missionPath)) {
        return "dispatched";
      }
      return "queued";
    } catch {
      return "queued";
    }
  }

  async getMissionSessionId(missionId: string): Promise<string | null> {
    try {
      const sessionPath = join(PATHS.missions, `${missionId}.session`);
      if (!existsSync(sessionPath)) return null;
      const content = readFileSync(sessionPath, "utf-8").trim();
      const match = content.match(/session_id:\s*(\S+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  async syncMission(
    missionId: string,
    updates: { prompt?: string; name?: string },
  ): Promise<void> {
    try {
      const path = join(PATHS.missions, `${missionId}.json`);
      if (!existsSync(path)) return;
      const mission = JSON.parse(readFileSync(path, "utf-8"));
      if (updates.prompt !== undefined) mission.prompt = updates.prompt;
      if (updates.name !== undefined) mission.name = updates.name;
      mission.updatedAt = new Date().toISOString();
      writeFileSync(path, JSON.stringify(mission, null, 2));
    } catch (err) {
      logApiError("HermesAgentBackend.syncMission", "syncMission", err);
    }
  }
}
