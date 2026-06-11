// ═══════════════════════════════════════════════════════════════
// backends/hermes.ts — Hermes mission dispatch backend
// ═══════════════════════════════════════════════════════════════

import { existsSync, readFileSync, writeFileSync, unlinkSync, chmodSync } from "fs";
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
  // The Control Hub models registry is the SINGLE SOURCE OF TRUTH for which
  // model any mission can run on. We always consult the registry before
  // trusting any caller-supplied value — even when both `modelId` and
  // `provider` are populated. A foreign modelId (e.g. a string that does not
  // exist in the `models` table) MUST be rejected; we fall through to the
  // agent default instead. This closes the historical leak where the
  // early-return path trusted the supplied pair verbatim.
  const trimmedId = input.modelId?.trim() ?? "";

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
  // Write a small helper script that the EXIT trap will invoke
  // when the main mission script terminates abnormally. Keeping
  // the trap body in its own file means we can author the JSON
  // template as a real JS string and write it to disk verbatim,
  // instead of fighting bash's quote/escape rules in a single-
  // line inline trap body.
  //
  // The helper is best-effort and idempotent: it writes a
  // synthetic failed status.json ONLY if the success/failure
  // branches below did not already write one.
  const helperPath = missionScriptPath(input.missionId).replace(/\.sh$/, ".trap-helper.sh");
  const helperBody = `#!/bin/bash
# Auto-generated by Control Hub spawnHermesChatWithStatusCallback.
# Writes a synthetic failed status.json when the mission's main
# bash script terminates abnormally (SIGKILL, OOM, host reboot)
# before reaching its success/failure branches.
set -e
STATUS_FILE="${input.statusFile}"
if [ -f "$STATUS_FILE" ]; then
  exit 0
fi
COMPLETED_AT="$(date -u +%FT%TZ)"
ERROR_MSG="bash script terminated before writing terminal status (signal-induced exit or unhandled error)"
cat > "$STATUS_FILE" <<JSON
{"status":"failed","exit_code":128,"completed_at":"$COMPLETED_AT","error":"$ERROR_MSG"}
JSON
`;
  try {
    writeFileSync(helperPath, helperBody);
    chmodSync(helperPath, 0o755);
  } catch {
    // best-effort — if we can't write the helper, the trap
    // will just be a no-op
  }
  const scriptLines = [
    "#!/bin/bash",
    "set -e",
    // Install an EXIT trap that invokes the helper script. The
    // helper handles the "did the success/failure branches
    // already write a status?" check, so this trap is safe to
    // fire on every exit. The trap fires for ANY exit reason —
    // normal completion, error, signal — because bash itself
    // handles the EXIT trap on script termination, even for
    // signal-induced exits.
    `trap '${shellQuote(helperPath)}' EXIT`,
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
    // The on-disk mission.json is the contract between phase 1
    // (dispatchMission) and phase 2 (spawnDispatchedMission).
    // The phase 2 reader expects profileName, modelId, and
    // provider to live on the on-disk record, so we persist
    // them here. These fields are also useful for downstream
    // tooling that wants to know the resolved model without
    // having to re-derive it from the registry.
    const mission: Mission & {
      profileName?: string;
      modelId?: string;
      provider?: string;
    } = {
      id,
      name: input.name,
      prompt: input.prompt,
      profileId: input.profileId,
      profileName: input.profileName,
      modelId: input.modelId,
      provider: input.provider,
      status: "dispatched",
      createdAt: now,
      updatedAt: now,
    };

    const missionsDir = PATHS.missions;
    ensureDir(missionsDir);

    const missionFile = join(missionsDir, `${id}.json`);
    // The status/output/session filenames are computed here
    // for documentation (they show up in the on-disk mission
    // record as siblings of missionFile) and so that the path
    // resolution happens in ONE place. The actual write of the
    // status file is done by the bash script (or the EXIT trap
    // helper) in phase 2; the output and session files are
    // written by the bash script. We underscore-prefix the
    // locals to signal "not used directly here" while keeping
    // the path resolution co-located.
    const _statusFile = join(missionsDir, `${id}.status.json`);
    const _outputFile = join(missionsDir, `${id}.output.log`);
    const _sessionFile = join(missionsDir, `${id}.session`);

    writeFileSync(missionFile, JSON.stringify(mission, null, 2));

    // Return early from phase 1 — the spawn happens in
    // `spawnDispatchedMission` below. This split is what lets
    // `dispatchMissionNow` write the on-disk artifacts BEFORE
    // updating the DB to "dispatched", so a server crash
    // between the two operations leaves a recoverable
    // disk-only orphan instead of a stuck "dispatched" DB row
    // with no on-disk artifacts.
    return mission;
  }

  /**
   * Phase 2 of dispatch: spawn the bash script that runs
   * `hermes chat` for the mission. The caller is expected to
   * have already written the on-disk mission.json via
   * `dispatchMission` (phase 1).
   */
  async spawnDispatchedMission(missionId: string): Promise<void> {
    const missionFile = join(PATHS.missions, `${missionId}.json`);
    if (!existsSync(missionFile)) {
      throw new Error(
        `spawnDispatchedMission called for ${missionId} but no on-disk mission file exists — call dispatchMission (phase 1) first`,
      );
    }

    // Read the mission back from disk to get the same shape we
    // would have used in dispatchMission. We re-resolve the
    // model because profile/model decisions may have changed
    // between phases (rare, but possible in tests).
    const onDisk = JSON.parse(readFileSync(missionFile, "utf-8")) as {
      profileId?: string;
      profileName?: string;
      modelId?: string;
      provider?: string;
      prompt: string;
    };
    const resolved = await resolveMissionModel({
      modelId: onDisk.modelId,
      provider: onDisk.provider,
    });
    if (resolved.apiKey) {
      await ensureProfileAuth(onDisk.profileName ?? "default", resolved.apiKey, resolved.provider);
    }

    const profileName = onDisk.profileName ?? "default";
    const profileHome = resolveProfileHermesHome(profileName);
    const cliArgv = buildHermesChatArgv({
      profileName: onDisk.profileName,
      modelId: resolved.modelId || undefined,
      provider: resolved.provider || undefined,
      source: "control-hub-mission",
    });

    const statusFile = join(PATHS.missions, `${missionId}.status.json`);
    const outputFile = join(PATHS.missions, `${missionId}.output.log`);
    const sessionFile = join(PATHS.missions, `${missionId}.session`);

    spawnHermesChatWithStatusCallback({
      argv: cliArgv,
      prompt: onDisk.prompt,
      missionId,
      statusFile,
      outputFile,
      sessionFile,
      hermesHome: profileHome,
    });
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
