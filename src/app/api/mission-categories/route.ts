// ═══════════════════════════════════════════════════════════════
// /api/mission-categories — User-managed mission categories
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";

import { logApiError } from "@/lib/api-logger";

import { parseJsonBody } from "@/lib/parse-json-body";
import { ensureDb, getSchemaHealth } from "@/lib/db";
import { toError } from "@/lib/api-fetch";
import {
  badRequest,
  conflict,
  created,
  forbidden,
  notFound,
  ok,
  serverError,
} from "@/lib/api-response";
import {
  countMissionsInCategory,
  countTemplatesInCategory,
  createCategory,
  deleteCategory,
  ensureDefaultCategories,
  getCategory,
  listCategoriesWithDefaults,
  updateCategory,
} from "@/lib/missions/mission-category-repository";

function withCounts() {
  return listCategoriesWithDefaults().map((cat) => ({
    ...cat,
    missionCount: countMissionsInCategory(cat.id),
    templateCount: countTemplatesInCategory(cat.id),
  }));
}

export async function GET(_request: NextRequest) {
  try {
    ensureDb();
    ensureDefaultCategories();
    const health = getSchemaHealth();
    if (!health.hasMissionCategoriesTable) {
      // Custom 503 body (carries migrationRequired + schemaVersion) — kept inline
      // because no factory exists for 503 + extended body shape.
      return NextResponse.json(
        {
          error:
            "mission_categories table is missing — restart PatterStage or run npm run db:migrate",
          migrationRequired: true,
          schemaVersion: health.schemaVersion,
        },
        { status: 503 },
      );
    }
    return ok({
      categories: withCounts(),
      schemaVersion: health.schemaVersion,
    });
  } catch (error) {
    logApiError("GET /api/mission-categories", "list", error);
    // toError() unwraps Error instances; the `|| "..."` fallback preserves
    // the byte-equivalent wire string for non-Error throws (e.g. throw "x").
    return serverError(toError(error).message || "Failed to load categories");
  }
}

export async function POST(request: NextRequest) {
  try {
    ensureDb();
    ensureDefaultCategories();
    const body = await parseJsonBody(request);
    if (body instanceof NextResponse) return body;
    const name = typeof body.name === "string" ? body.name : "";
    const color = typeof body.color === "string" ? body.color : undefined;
    if (!name.trim()) {
      return badRequest("name is required");
    }
    const cat = createCategory({ name, color });
    return created({
      category: {
        ...cat,
        missionCount: 0,
        templateCount: 0,
      },
    });
  } catch (error) {
    // The repository's "already exists" error surfaces a 409 via the
    // shared `conflict()` factory (sibling of `badRequest`/`notFound`/
    // `forbidden`/`serverError` in `@/lib/api-response`). The factory
    // was already exported but the only 409 site in this route was
    // kept inline (per the session-71 outlier rule, since pre-session-95
    // no other 409 sites existed in the codebase). Session 134 promotes
    // the inline form to the factory now that the helper is canonical.
    const msg = toError(error).message || "Create failed";
    if (msg.includes("already exists")) {
      return conflict(msg);
    }
    logApiError("POST /api/mission-categories", "create", error);
    return serverError(msg);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await parseJsonBody(request);
    if (body instanceof NextResponse) return body;
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) {
      return badRequest("id is required");
    }
    const updates: { name?: string; color?: string; sortOrder?: number } = {};
    if (typeof body.name === "string") updates.name = body.name;
    if (typeof body.color === "string") updates.color = body.color;
    if (typeof body.sortOrder === "number") updates.sortOrder = body.sortOrder;

    const cat = updateCategory(id, updates);
    if (!cat) {
      return notFound("Category not found");
    }
    return ok({
      category: {
        ...cat,
        missionCount: countMissionsInCategory(cat.id),
        templateCount: countTemplatesInCategory(cat.id),
      },
    });
  } catch (error) {
    logApiError("PUT /api/mission-categories", "update", error);
    return serverError(toError(error).message || "Update failed");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return badRequest("id is required");
    }
    const reassignParam = url.searchParams.get("reassignToId");
    const reassignToId =
      reassignParam === "null" || reassignParam === ""
        ? null
        : reassignParam ?? undefined;

    const missionCount = countMissionsInCategory(id);
    const templateCount = countTemplatesInCategory(id);
    if ((missionCount > 0 || templateCount > 0) && reassignToId === undefined) {
      // Extended 400 body (carries missionCount + templateCount counts) — kept
      // inline because the badRequest() factory doesn't support extra body
      // fields. Matches the same outlier pattern as the 503 above.
      return NextResponse.json(
        {
          error: "reassignToId required when category is in use",
          missionCount,
          templateCount,
        },
        { status: 400 },
      );
    }

    if (reassignToId !== undefined && reassignToId !== null && !getCategory(reassignToId)) {
      return badRequest("Reassign target category not found");
    }

    // deleteCategory already answers whether the row existed; the route used
    // to throw that away and echo the id back as deleted, so DELETE with an
    // unknown id answered 200 and did nothing. The sibling route
    // schedules/[id] has always got this right (T-0079).
    if (!deleteCategory(id, reassignToId)) return notFound("Category not found");
    return ok({ deleted: id });
  } catch (error) {
    const msg = toError(error).message || "Delete failed";
    if (msg.includes("System categories")) {
      return forbidden(msg);
    }
    logApiError("DELETE /api/mission-categories", "delete", error);
    return serverError(msg);
  }
}
