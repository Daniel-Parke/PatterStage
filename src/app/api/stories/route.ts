// ═══════════════════════════════════════════════════════════════
// /api/stories — Story Weaver (SQLite storage). Thin POST action router.
// Per-action handlers live in src/lib/story-handlers/ (mirrors the
// mission-handlers layout). All LLM generation logic is preserved there.
// ═══════════════════════════════════════════════════════════════

import { methodNotAllowed } from "@/lib/api/api-response";
import { NextRequest, NextResponse } from "next/server";


import { parseJsonBody } from "@/lib/api/parse-json-body";
import { handleCreate } from "@/modules/rec-room/handlers/create";
import {
  handleGenerateChapter,
  handleRetryChapter,
  handleRewriteChapter,
} from "@/modules/rec-room/handlers/generate";
import { handleEditChapter, handleExtend, handleContinue } from "@/modules/rec-room/handlers/edit";
import {
  handleList,
  handleLoad,
  handleUpdate,
  handleSyncTitles,
  handleDelete,
} from "@/modules/rec-room/handlers/crud";
import { handleCharacters, handleThemes } from "@/modules/rec-room/handlers/library";
import { handleStorySpend } from "@/modules/rec-room/handlers/spend";
import { route } from "@/lib/api/api-route";

export const POST = route("POST /api/stories", "request", "Request failed", async (request: NextRequest) => {
  const body = await parseJsonBody(request);
  if (body instanceof NextResponse) return body;
  const { action } = body;
  // Missions accept `id`; stories said `storyId`. One vocabulary (T-0087).
  if (body.storyId === undefined && typeof body.id === "string") body.storyId = body.id;
  // `return await`, every case. A returned-but-unawaited promise rejects
  // OUTSIDE this try, so serverErrorFromCatch never saw it and the client got
  // an empty 500. Fourteen actions shared that hole (T-0087).
  switch (action) {
    // The generating actions get the request's own signal, so a browser that
    // stops listening stops the provider call rather than paying for a
    // chapter nobody will read (T-0108, D88).
    case "create":            return await handleCreate(body, { signal: request.signal });
    case "list":              return await handleList();
    case "load":              return await handleLoad(body);
    case "generate-chapter":        return await handleGenerateChapter(body, { signal: request.signal });
    case "retry-chapter":           return await handleRetryChapter(body, { signal: request.signal });
    case "rewrite-chapter":         return await handleRewriteChapter(body, { signal: request.signal });
    case "edit-chapter":            return await handleEditChapter(body, { signal: request.signal });
    case "extend":                  return await handleExtend(body);
    case "continue":                return await handleContinue(body, { signal: request.signal });
    case "update":            return await handleUpdate(body);
    // The reusable library the Characters/Themes pages have always posted to.
    case "characters":        return await handleCharacters(body);
    case "themes":            return await handleThemes(body);
    case "sync-titles":       return await handleSyncTitles(body);
    // What this story has cost so far, so the reader can say it without
    // sending the operator to Insights to find out.
    case "spend":             return await handleStorySpend(body);
    case "delete":            return await handleDelete(body);
    default:
      return NextResponse.json({ error: "Unknown action: " + action }, { status: 400 });
  }
});

// GET is not supported here. Stories live under a profile, so the list lives
// at /api/rec-room/stories — a bare GET on this path returns nothing useful
// and the 404 it used to produce read like the feature was missing (T-0083).
export async function GET() {
  return methodNotAllowed(
    "GET is not supported here — POST creates a story; list them from the Story Weaver page", ["POST"]);
}
