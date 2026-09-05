import { NextRequest } from "next/server";
import { readFileSync, statSync } from "fs";
import { basename } from "path";

import { getAgentWorkspace } from "@/lib/runtime/workspace";
import { readAgentSessionDetail } from "@/lib/runtime/state-db";
import { getMaxSessionMessages } from "@/lib/sessions/sessions-api-guard";
import { logApiError, serverErrorFromCatch } from "@/lib/api-logger";

import { badRequest, notFound, ok, payloadTooLarge } from "@/lib/api-response";
import { safeStat } from "@/lib/fs/fs-stats";
import { getSession, estimateSessionSize } from "@/lib/sessions/session-repository";
import type { SessionStatus } from "@/lib/sessions/session-repository";
import { lookupMissionIdForCronSession } from "@/lib/sessions/session-mission-links";
import { PATHS } from "@/lib/paths";
import {
  getMaxSessionFileBytes,
  sessionsRateLimitResponse,
} from "@/lib/sessions/sessions-api-guard";
import {
  buildSessionData,
  dbSessionFields,
  findFileWithExtension,
  parseAssistantLines,
} from "@/lib/sessions/session-detail";

// ── Mission-output file extensions to try in preference order ───────────
// Recurring mission dispatch writes a `.session` file (full transcript);
// the older `.output.log` fallback is the legacy format. The session
// detail view tries the newer format first, then falls back to the log.
const MISSION_FILE_EXTENSIONS = [".session", ".output.log"] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = sessionsRateLimitResponse(request, "GET /api/sessions/[id]");
  if (limited) return limited;
  const { id } = await params;

  // Security: prevent path traversal
  const sanitizedId = id.replace(/[^a-zA-Z0-9_.-]/g, "");
  if (sanitizedId !== id || sanitizedId.includes("..")) {
    return badRequest("Invalid session ID");
  }

  // ── Step 1: Try Hermes state.db (v0.14+ — canonical source) ──────────
  // The state.db read itself lives in the runtime adapter: it is the
  // agent's own database, not PatterStage's. A null detail means either
  // no state.db or no such session, and both fall through to Step 2.
  try {
    // Capped: a transcript with tens of thousands of messages used to be
    // fetched whole and rendered whole (T-0105, D40).
    const detail = readAgentSessionDetail(sanitizedId, getMaxSessionMessages());

    if (detail) {
      const sessionRow = detail.session;
      const messageRows = detail.messages;

      // ── In-flight empty-state note ───────────────────────────
      // When the session exists in state.db but the messages table
      // is empty AND ended_at is still NULL, the session is in
      // flight — Hermes has the row but hasn't flushed any messages
      // yet (the agent loop persists at turn boundaries, and
      // in-flight sessions may have api_call_count > 0 with no
      // committed messages). Without a `note` field the frontend
      // falls through to the generic "No messages in this session"
      // empty state, which the user reported as confusing — the
      // session is healthy and live, just not yet flushed. The
      // existing isSessionStillRunning() helper in src/lib/session-title.ts
      // pattern-matches the note text ("still running"/"in progress"/
      // "mid-flight") to drive the refresh-CTA render, so we keep
      // the same vocabulary.
      //
      // Two flavours: cron-spawned sessions get the more specific
      // "this cron job is still running" wording; everything else
      // gets a generic "session is in progress" note. The source
      // discrimination is cheap (sessionRow.source is read-only)
      // and lets the UI optionally render cron-specific CTAs later.
      const isInFlight = sessionRow.ended_at === null;
      const isEmpty = messageRows.length === 0;
      const inFlightNote =
        isInFlight && isEmpty
          ? sessionRow.source === "cron"
            ? "This cron-spawned session is still running. Messages will appear here as the agent writes them — refresh to check."
            : "This session is in progress. Messages will appear here as the agent writes them — refresh to check."
          : undefined;

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

      // Inline the `ok(buildSessionData({...}))` form rather than
      // `const response = NextResponse.json({ data: buildSessionData({...}) })`
      // because the variable is never modified (no headers, no status override)
      // and the `ok()` factory already wraps the `{ data: ... }` envelope.
      //
      // The `note` field is conditionally passed: only present when the
      // session is in flight (ended_at IS NULL in state.db) and has no
      // flushed messages yet. For completed sessions or in-flight
      // sessions with messages, the note is omitted — the messages
      // themselves are the signal. The frontend's isSessionStillRunning()
      // helper pattern-matches the note text to decide whether to render
      // the refresh CTA vs the normal transcript view.
      return ok(
        buildSessionData({
          id: sanitizedId,
          filename: sanitizedId,
          format: "db",
          title: sessionRow.title ?? sanitizedId,
          model: sessionRow.model ?? "",
          source: sessionRow.source,
          messages,
          size,
          created: sessionRow.started_at
            ? new Date(sessionRow.started_at * 1000).toISOString()
            : null,
          // Look up the PatterStage mission id by matching the embedded
          // cron job id against the missions table. Lets the detail page
          // render a "Open Mission" link for cron-spawned sessions.
          missionId: lookupMissionIdForCronSession(sanitizedId),
          // How it ended: the PatterStage row when there is one, otherwise
          // derived from whether the agent has closed it (T-0105, D30).
          ...(() => {
            const row = getSession(sanitizedId);
            return row
              ? { status: row.status, exitCode: row.exitCode, error: row.error }
              : {
                  status: (sessionRow.ended_at === null ? "active" : "completed") as SessionStatus,
                  exitCode: null,
                  error: null,
                };
          })(),
          truncated: detail.truncated,
          ...(inFlightNote ? { note: inFlightNote } : {}),
        }),
      );
    }
  } catch (err) {
    logApiError("GET /api/sessions/[id]", "reading Hermes state.db for " + sanitizedId, err);
    // Non-fatal — fall through to file-based lookup
  }

  // ── Step 2: Legacy file-based sessions (~/.hermes/sessions/) ──────────
  const sessionsPath = getAgentWorkspace().sessions;
  // Try the raw name first, then `.json`, then `.jsonl`. Legacy sessions
  // were written both with and without an extension.
  const filePath = findFileWithExtension(sessionsPath, sanitizedId, ["", ".json", ".jsonl"]);

  if (!filePath) {
    // No file on disk — try the DB record for mission-born sessions
    const dbSession = getSession(sanitizedId);
    // Any PatterStage row, not only the mission and cron ones. A CLI session
    // that failed and left no transcript answered 404, so the one screen an
    // operator opens to find out what went wrong told them the session did not
    // exist (T-0105, D30). The row IS the answer when nothing else is.
    if (dbSession) {
      // Check for a mission output file (try newer `.session` first,
      // then legacy `.output.log`). findFileWithExtension collapses
      // the 2x `existsSync` ladder into one call.
      if (dbSession.missionId) {
        const sessionPath = findFileWithExtension(
          PATHS.missions,
          dbSession.missionId,
          MISSION_FILE_EXTENSIONS,
        );
        if (sessionPath) {
          const content = readFileSync(sessionPath, "utf-8");
          const messages = parseAssistantLines(content);
          // File confirmed to exist above (missionFile or missionLog); safeStat never null.
          const st = safeStat(sessionPath)!;
          return ok(
            buildSessionData({
              id: sanitizedId,
              filename: basename(sessionPath),
              format: "mission-output",
              ...dbSessionFields(dbSession, sanitizedId),
              messages,
              size: st.size,
              missionId: dbSession.missionId,
            }),
          );
        }
      }
      // No output file yet (agent running, or output was streamed to Hermes).
      // Surface the parent mission id so the detail page can link to it.
      return ok(
        buildSessionData({
          id: sanitizedId,
          filename: sanitizedId,
          format: "db",
          ...dbSessionFields(dbSession, sanitizedId),
          messages: [],
          size: dbSession.size,
          missionId: dbSession.missionId ?? null,
          note: dbSession.source === "mission"
            // design-lint-disable-next-line hermes-outside-adapter -- operator prose in the response body, not a path lookup. It tells a human which file on the agent's install their output went to when no transcript exists yet; routing a sentence through the port would only hide who wrote it.
            ? "This mission-spawned session has no output file yet. The agent may still be running, or the output was written to ~/.hermes/state.db — refresh to check."
            : dbSession.source === "cron"
              ? "This cron-spawned session is still running. Messages will appear here when the agent completes."
              : dbSession.status === "failed"
                ? "No transcript was written for this session. What is known about how it ended is above."
                : "The agent ran but produced no output file.",
        }),
      );
    }
    return notFound(`Session "${sanitizedId}" not found`);
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
      return payloadTooLarge(
        "Session file is too large to load in PatterStage (max " +
          Math.round(maxBytes / (1024 * 1024)) +
          " MB)."
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

      return ok(
        buildSessionData({
          id: sanitizedId,
          filename: basename(filePath),
          format: "jsonl",
          messages,
          size: st.size,
        }),
      );
    } else {
      // Parse JSON
      const data = JSON.parse(content);
      const messages = data.messages || data.conversation || data.turns || [];

      return ok(
        buildSessionData({
          id: sanitizedId,
          filename: basename(filePath),
          format: "json",
          title: data.title || data.name || "",
          model: data.model || "",
          source: data.source || "",
          messages,
          size: st.size,
          created: data.created || st.birthtime.toISOString(),
        }),
      );
    }
  } catch (error) {
    return serverErrorFromCatch(
      "GET /api/sessions/[id]",
      "reading session " + sanitizedId,
      error,
      `Failed to read session "${sanitizedId}"`,
    );
  }
}
