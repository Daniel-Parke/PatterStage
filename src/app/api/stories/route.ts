// ═══════════════════════════════════════════════════════════════
// /api/stories — Story Weaver (SQLite storage). Thin POST action router.
// Per-action handlers live in src/lib/story-handlers/ (mirrors the
// mission-handlers layout). All LLM generation logic is preserved there.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { requireAuth } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/parse-json-body";
import { handleCreate } from "@/lib/story-handlers/create";
import {
  handleGenerateChapter,
  handleRetryChapter,
  handleRewriteChapter,
} from "@/lib/story-handlers/generate";
import { handleEditChapter, handleExtend, handleContinue } from "@/lib/story-handlers/edit";
import {
  handleList,
  handleLoad,
  handleUpdate,
  handleSyncTitles,
  handleDelete,
} from "@/lib/story-handlers/crud";
import { handleCharacters, handleThemes } from "@/lib/story-handlers/library";

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

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
