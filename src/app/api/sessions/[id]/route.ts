import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";

import { getActiveHermesPaths } from "@/lib/hermes-agent-runtime";
import { logApiError } from "@/lib/api-logger";
import { requireAuth } from "@/lib/api-auth";
import { getSession, estimateSessionSize, lookupMissionIdForHermesJob } from "@/lib/session-repository";
import { cronJobIdFromSessionId } from "@/lib/session-title";
import { PATHS } from "@/lib/paths";
import {
  getMaxSessionFileBytes,
  sessionsRateLimitResponse,
} from "@/lib/sessions-api-guard";

/**
 * Best-effort lookup of the Control-Hub mission id for a cron-spawned
 * session. The session id has the form `cron_<job-uuid>_<date>_<time>`;
 * the job uuid resolves to cron_jobs.id, which resolves to missions.id
 * via the missions.cron_job_id FK. Returns null for non-cron sessions
 * or when no mission has been registered for the job.
 */
function lookupMissionIdForCronSession(sessionId: string): string | null {
  const jobId = cronJobIdFromSessionId(sessionId);
  if (!jobId) return null;
  return lookupMissionIdForHermesJob(jobId);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = sessionsRateLimitResponse(request, "GET /api/sessions/[id]");
  if (limited) return limited;
  const auth = requireAuth(request);
  if (auth) return auth;

  const { id } = await params;

  // Security: prevent path traversal
  const sanitizedId = id.replace(/[^a-zA-Z0-9_.-]/g, "");
  if (sanitizedId !== id || sanitizedId.includes("..")) {
    return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
  }

  // ── Step 1: Try Hermes state.db (v0.14+ — canonical source) ──────────
  const root = getActiveHermesPaths().root;
  const stateDbPath = join(root, "state.db");

  if (existsSync(stateDbPath)) {
    let hermesDb: Database.Database | null = null;
    try {
      hermesDb = new Database(stateDbPath, { readonly: true });

      // Check if this session exists in Hermes state.db
      const sessionRow = hermesDb
        .prepare("SELECT id, source, model, title, started_at, ended_at, end_reason, message_count, api_call_count FROM sessions WHERE id = ?")
        .get(sanitizedId) as {
          id: string; source: string; model: string; title: string | null;
          started_at: number; ended_at: number | null; end_reason: string | null;
          message_count: number | null; api_call_count: number | null;
        } | undefined;

      if (sessionRow) {
        // Read messages for this session
        const messageRows = hermesDb
          .prepare(
            `SELECT role, content, tool_name, tool_calls, tool_call_id, finish_reason, reasoning, timestamp
             FROM messages WHERE session_id = ? ORDER BY timestamp ASC`,
          )
          .all(sanitizedId) as Array<{
            role: string; content: string | null; tool_name: string | null;
            tool_calls: string | null; tool_call_id: string | null;
            finish_reason: string | null; reasoning: string | null; timestamp: number;
          }>;

        const messages = messageRows.map((m, i) => {
          let toolCalls = null;
          if (m.tool_calls) {
            try { toolCalls = JSON.parse(m.tool_calls); } catch { /* not JSON */ }
          }
          return {
            index: i,
            role: m.role,
            content: m.content ?? "",
            tool_calls: toolCalls,
            tool_name: m.tool_name ?? null,
            tool_call_id: m.tool_call_id ?? null,
            finish_reason: m.finish_reason ?? null,
            reasoning: m.reasoning ?? null,
            timestamp: m.timestamp,
          };
        });

        const size = estimateSessionSize(
          sessionRow.message_count,
          sessionRow.api_call_count,
          messages.length * 300,
        );

        const response = NextResponse.json({
          data: {
            id: sanitizedId,
            filename: sanitizedId,
            format: "db",
            title: sessionRow.title ?? sanitizedId,
            model: sessionRow.model ?? "",
            source: sessionRow.source,
            messages,
            messageCount: messages.length,
            size,
            created: sessionRow.started_at
              ? new Date(sessionRow.started_at * 1000).toISOString()
              : null,
            // Look up the Control-Hub mission id by matching the embedded
            // cron job id against the missions table. Lets the detail page
            // render a "Open Mission" link for cron-spawned sessions.
            missionId: lookupMissionIdForCronSession(sanitizedId),
          },
        });
        return response;
      }
    } catch (err) {
      logApiError("GET /api/sessions/[id]", "reading Hermes state.db for " + sanitizedId, err);
      // Non-fatal — fall through to file-based lookup
    } finally {
      if (hermesDb) { try { hermesDb.close(); } catch { /* already closed */ } }
    }
  }

  // ── Step 2: Legacy file-based sessions (~/.hermes/sessions/) ──────────
  const sessionsPath = getActiveHermesPaths().sessions;
  const fullPath = join(sessionsPath, sanitizedId);
  let filePath = "";

  if (existsSync(fullPath)) {
    filePath = fullPath;
  } else if (existsSync(`${fullPath}.json`)) {
    filePath = `${fullPath}.json`;
  } else if (existsSync(`${fullPath}.jsonl`)) {
    filePath = `${fullPath}.jsonl`;
  } else {
    // No file on disk — try the DB record for mission-born sessions
    const dbSession = getSession(sanitizedId);
    if (dbSession && (dbSession.source === "mission" || dbSession.source === "cron")) {
      // Check for a mission output file
      if (dbSession.missionId) {
        const missionFile = join(PATHS.missions, `${dbSession.missionId}.session`);
        const missionLog = join(PATHS.missions, `${dbSession.missionId}.output.log`);
        const sessionPath = existsSync(missionFile) ? missionFile : existsSync(missionLog) ? missionLog : null;
        if (sessionPath) {
          const content = readFileSync(sessionPath, "utf-8");
          const lines = content.split("\n").filter((l: string) => l.trim());
          const messages = lines.map((line: string, i: number) => ({
            index: i,
            role: "assistant",
            content: line,
          }));
          const st = statSync(sessionPath);
          return NextResponse.json({
            data: {
              id: sanitizedId,
              filename: sessionPath.split("/").pop(),
              format: "mission-output",
              title: dbSession.title || sanitizedId,
              model: dbSession.modelId || "",
              source: dbSession.source,
              messages,
              messageCount: messages.length,
              size: st.size,
              created: dbSession.startedAt,
              missionId: dbSession.missionId,
            },
          });
        }
      }
      // No output file yet (agent running, or output was streamed to Hermes).
      // Surface the parent mission id so the detail page can link to it.
      return NextResponse.json({
        data: {
          id: sanitizedId,
          filename: sanitizedId,
          format: "db",
          title: dbSession.title || sanitizedId,
          model: dbSession.modelId || "",
          source: dbSession.source,
          messages: [],
          messageCount: 0,
          size: dbSession.size,
          created: dbSession.startedAt,
          missionId: dbSession.missionId ?? null,
          note: dbSession.source === "mission"
            ? "This mission-spawned session has no output file yet. The agent may still be running, or the output was written to ~/.hermes/state.db — refresh to check."
            : dbSession.source === "cron"
              ? "This cron-spawned session is still running. Messages will appear here when the agent completes."
              : "The agent ran but produced no output file.",
        },
      });
    }
    return NextResponse.json(
      { error: `Session "${sanitizedId}" not found` },
      { status: 404 }
    );
  }

  try {
    const st = statSync(filePath);
    const maxBytes = getMaxSessionFileBytes();
    if (st.size > maxBytes) {
      logApiError(
        "GET /api/sessions/[id]",
        "session file exceeds max size (" + st.size + " bytes)",
        new Error("PayloadTooLarge")
      );
      return NextResponse.json(
        {
          error:
            "Session file is too large to load in Control Hub (max " +
            Math.round(maxBytes / (1024 * 1024)) +
            " MB).",
        },
        { status: 413 }
      );
    }

    const content = readFileSync(filePath, "utf-8");

    if (filePath.endsWith(".jsonl")) {
      // Parse JSONL — one JSON object per line
      const messages = content
        .split("\n")
        .filter((line: string) => line.trim())
        .map((line: string, index: number) => {
          try {
            const msg = JSON.parse(line);
            return { index, ...msg };
          } catch (err) {
            logApiError("GET /api/sessions/[id]", `parsing JSONL line ${index} in session ${sanitizedId}`, err);
            return { index, raw: line };
          }
        });

      return NextResponse.json({
        data: {
          id: sanitizedId,
          filename: filePath.split("/").pop(),
          format: "jsonl",
          messages,
          messageCount: messages.length,
          size: st.size,
        },
      });
    } else {
      // Parse JSON
      const data = JSON.parse(content);
      const messages = data.messages || data.conversation || data.turns || [];

      return NextResponse.json({
        data: {
          id: sanitizedId,
          filename: filePath.split("/").pop(),
          format: "json",
          title: data.title || data.name || "",
          model: data.model || "",
          source: data.source || "",
          messages,
          messageCount: messages.length,
          size: st.size,
          created: data.created || st.birthtime.toISOString(),
        },
      });
    }
  } catch (error) {
    logApiError("GET /api/sessions/[id]", "reading session " + sanitizedId, error);
    return NextResponse.json(
      { error: `Failed to read session "${sanitizedId}"` },
      { status: 500 }
    );
  }
}
