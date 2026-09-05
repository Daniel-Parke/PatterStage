// ═══════════════════════════════════════════════════════════════
// /api/chat — agent-chat conversations (server-persisted).
//   GET  → { conversations: [...] }   (most-recent first)
//   POST → create a conversation, mapped to a fresh Hermes session
//          ({ title?, profileName?, model? }) → { conversation }
// Each conversation is backed by a Hermes session for agent memory /
// multi-turn continuity. See chat-repository + 013_chat.sql.
// ═══════════════════════════════════════════════════════════════

import { boundsFrom } from "@/lib/list-bounds";
import { NextRequest, NextResponse } from "next/server";

import { serverErrorFromCatch, logApiError } from "@/lib/api-logger";
import { ok, created } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/parse-json-body";
import { runtime } from "@/lib/runtime";
import { RuntimeRequestError } from "@/lib/runtime/types";
import { listConversations, createConversation } from "@/lib/chat-repository";

export async function GET(request?: NextRequest) {
  try {
    return ok({ conversations: listConversations(boundsFrom(request, { defaultLimit: 100, maxLimit: 500 }).limit) });
  } catch (error) {
    return serverErrorFromCatch("GET /api/chat", "list", error, "Failed to list conversations");
  }
}

export async function POST(request: NextRequest) {
  const body = await parseJsonBody(request);
  if (body instanceof NextResponse) return body;
  const { title, profileName, model } = body as {
    title?: string;
    profileName?: string;
    model?: string;
  };

  try {
    // Register a Hermes session for memory continuity. Best-effort: if the
    // gateway is offline we still create the conversation (the first message's
    // run handle backfills the session id).
    let sessionId: string | null = null;
    const sessionTitle = title || "New Chat";
    try {
      const session = await runtime.createSession({ title: sessionTitle, source: "chat" });
      sessionId = session.id || null;
    } catch (err) {
      // The gateway answers 400 when a session title already exists. That
      // used to be swallowed here: the conversation was created with no
      // session and answered 201, and its memory continuity was silently
      // gone. A collision is a name problem, not a gateway problem; retry
      // once with a suffix, and only then fall back to no session (T-0089).
      if (err instanceof RuntimeRequestError && err.status === 400) {
        const retitled = `${sessionTitle} (${new Date().toISOString().slice(11, 19)})`;
        try {
          const session = await runtime.createSession({ title: retitled, source: "chat" });
          sessionId = session.id || null;
        } catch (retryErr) {
          logApiError("POST /api/chat", "createSession (retry after title collision)", retryErr);
        }
      } else {
        logApiError("POST /api/chat", "createSession", err);
      }
    }

    const conversation = createConversation({
      title: title || "New Chat",
      sessionId,
      profileName: profileName ?? null,
      model: model ?? null,
    });
    return created({ conversation });
  } catch (error) {
    return serverErrorFromCatch("POST /api/chat", "create", error, "Failed to create conversation");
  }
}
