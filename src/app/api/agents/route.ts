import { NextResponse } from "next/server";
import { readFileSync, readdirSync, existsSync, statSync } from "fs";
import { execSync } from "child_process";

import { getActiveHermesPaths } from "@/lib/hermes-agent-runtime";
import { logApiError } from "@/lib/api-logger";

/** A Hermes process visible on the dashboard (gateway, cron, or subagent). */
interface HermesProcess {
  id: string;
  type: "cron" | "gateway" | "manual" | "subagent";
  name: string;
  status: "running" | "idle";
  startedAt: string | null;
  lastActivity: string | null;
  model: string;
  pid: number | null;
  turns: number;
}

export async function GET() {
  try {
    const processes: HermesProcess[] = [];

    // ═══ Gateway main agent ═══════════════════════════════════
    try {
      const psOutput = execSync(
        'ps aux | grep "gateway run" | grep -v grep | grep -v bash',
        { encoding: "utf-8", timeout: 5000 }
      ).trim();
      if (psOutput) {
        const lines = psOutput.split("\n");
        const seen = new Set<number>();
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parseInt(parts[1], 10);
          const cmd = parts.slice(10).join(" ");
          if (cmd.includes("bash") || cmd.includes("printf")) continue;
          if (seen.has(pid)) continue;
          seen.add(pid);
          const startTime = parts[8];
          const platforms: string[] = [];
          try {
            const envPath = getActiveHermesPaths().env;
            if (existsSync(envPath)) {
              const envContent = readFileSync(envPath, "utf-8");
              if (envContent.includes("DISCORD_BOT_TOKEN=") && !envContent.match(/^#\s*DISCORD_BOT_TOKEN/m)) platforms.push("Discord");
              if (envContent.includes("TELEGRAM_BOT_TOKEN=") && !envContent.match(/^#\s*TELEGRAM_BOT_TOKEN/m)) platforms.push("Telegram");
              if (envContent.includes("SLACK_BOT_TOKEN=") && !envContent.match(/^#\s*SLACK_BOT_TOKEN/m)) platforms.push("Slack");
            }
          } catch (err) { logApiError("GET /api/agents", "reading .env for platforms", err); }
          const platformLabel = platforms.length > 0 ? platforms.join(" + ") : "Gateway";
          processes.push({
            id: `gateway-${pid}`,
            type: "gateway",
            name: `Hermes Gateway (${platformLabel})`,
            status: "running",
            startedAt: startTime,
            lastActivity: new Date().toISOString(),
            model: "gateway",
            pid,
            turns: 0,
          });
          break;
        }
      }
    } catch (err) {
      logApiError("GET /api/agents", "checking gateway process", err);
    }

    // ═══ Cron job runs (from session files) ═══════════════════
    const sessionsPath = getActiveHermesPaths().sessions;
    if (existsSync(sessionsPath)) {
      try {
        const files = readdirSync(sessionsPath);
        const cronSessionFiles = files
          .filter((f) => f.startsWith("session_cron_") && f.endsWith(".json"))
          .sort()
          .reverse();
        const seenJobs = new Set<string>();
        for (const file of cronSessionFiles) {
          const match = file.match(/session_cron_([a-f0-9]+)_/);
          if (!match) continue;
          const jobId = match[1];
          if (seenJobs.has(jobId)) continue;
          seenJobs.add(jobId);
          const fp = sessionsPath + "/" + file;
          const st = statSync(fp);
          const modified = st.mtime.toISOString();
          let jobName = `Cron ${jobId.slice(0, 8)}`;
          let jobModel = "unknown";
          const cronPath = getActiveHermesPaths().cronJobs;
          if (existsSync(cronPath)) {
            try {
              const cronData = JSON.parse(readFileSync(cronPath, "utf-8"));
              const job = (cronData.jobs || []).find((j: { id: string }) => j.id === jobId);
              if (job) { jobName = job.name || jobName; jobModel = job.model || "unknown"; }
            } catch (err) { logApiError("GET /api/agents", "reading cron config for job " + jobId, err); }
          }
          let turns = 0;
          try {
            const sessionData = JSON.parse(readFileSync(fp, "utf-8"));
            if (Array.isArray(sessionData.messages)) {
              turns = sessionData.messages.filter((m: { role: string }) => m.role === "assistant").length;
            }
          } catch (err) { logApiError("GET /api/agents", "counting turns for session " + file, err); }
          const ageMs = Date.now() - st.mtimeMs;
          const isRunning = ageMs < 15 * 60 * 1000;
          if (ageMs > 24 * 60 * 60 * 1000) continue;
          processes.push({
            id: `cron-${jobId}`,
            type: "cron",
            name: jobName,
            status: isRunning ? "running" : "idle",
            startedAt: file.match(/_(\d{8}_\d{6})\.json/)?.[1] || null,
            lastActivity: modified,
            model: jobModel,
            pid: null,
            turns,
          });
        }
      } catch (err) { logApiError("GET /api/agents", "reading cron session files", err); }
    }

    // ═══ Subagents (delegate tool sessions) ═══════════════════
    try {
      const subagentOutput = execSync(
        'ps aux | grep -E "run_agent|AIAgent|hermes.*chat" | grep -v grep | grep -v "gateway run"',
        { encoding: "utf-8", timeout: 5000 }
      ).trim();
      if (subagentOutput) {
        const lines = subagentOutput.split("\n");
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parseInt(parts[1], 10);
          processes.push({
            id: `subagent-${pid}`,
            type: "subagent",
            name: `Subagent (PID ${pid})`,
            status: "running",
            startedAt: parts[8],
            lastActivity: new Date().toISOString(),
            model: "unknown",
            pid,
            turns: 0,
          });
        }
      }
    } catch { /* grep exit code 1 = no matches, expected */ }

    processes.sort((a, b) => {
      if (a.status === "running" && b.status !== "running") return -1;
      if (a.status !== "running" && b.status === "running") return 1;
      return a.type.localeCompare(b.type);
    });
    const runningCount = processes.filter((p) => p.status === "running").length;
    const idleCount = processes.filter((p) => p.status === "idle").length;
    return NextResponse.json({
      data: {
        processes,
        total: processes.length,
        running: runningCount,
        idle: idleCount,
      },
    });
  } catch (err) {
    logApiError("GET /api/agents", "querying Hermes processes", err);
    return NextResponse.json(
      { error: "Failed to query Hermes processes: " + String(err) },
      { status: 500 }
    );
  }
}
