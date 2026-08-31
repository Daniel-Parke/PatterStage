// ═══════════════════════════════════════════════════════════════
// /api/stories — Story Weaver (SQLite storage). Thin POST action router.
// Per-action handlers live in src/lib/story-handlers/ (mirrors the
// mission-handlers layout). All LLM generation logic is preserved there.
// ═══════════════════════════════════════════════════════════════

import { methodNotAllowed } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";

import { serverErrorFromCatch } from "@/lib/api-logger";

import { parseJsonBody } from "@/lib/parse-json-body";
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

export async function POST(request: NextRequest) {
  try {
    const body = await parseJsonBody(request);
    if (body instanceof NextResponse) return body;
    const { action } = body;
    switch (action) {
      case "create":            return handleCreate(body);
      case "list":              return handleList();
      case "load":              return handleLoad(body);
      case "generate-chapter":  return handleGenerateChapter(body);
      case "retry-chapter":     return handleRetryChapter(body);
      case "rewrite-chapter":   return handleRewriteChapter(body);
      case "edit-chapter":      return handleEditChapter(body);
      case "extend":            return handleExtend(body);
      case "continue":          return handleContinue(body);
      case "update":            return handleUpdate(body);
      // The reusable library the Characters/Themes pages have always posted to.
      case "characters":        return handleCharacters(body);
      case "themes":            return handleThemes(body);
      case "sync-titles":       return handleSyncTitles(body);
      case "delete":            return handleDelete(body);
      default:
        return NextResponse.json({ error: "Unknown action: " + action }, { status: 400 });
    }
  } catch (err) {
    return serverErrorFromCatch("POST /api/stories", "request", err, "Request failed");
  }
}

// GET is not supported here. Stories live under a profile, so the list lives
// at /api/rec-room/stories — a bare GET on this path returns nothing useful
// and the 404 it used to produce read like the feature was missing (T-0083).
export async function GET() {
  return methodNotAllowed(
    "GET is not supported here — POST creates a story; list them from the Story Weaver page",
  );
}
