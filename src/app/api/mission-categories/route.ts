// ═══════════════════════════════════════════════════════════════
// /api/mission-categories — User-managed mission categories
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";

import { logApiError } from "@/lib/api-logger";
import { requireAuth } from "@/lib/api-auth";
import { ensureDb, getSchemaHealth } from "@/lib/db";
import {
  countMissionsInCategory,
  countTemplatesInCategory,
  createCategory,
  deleteCategory,
  ensureDefaultCategories,
  getCategory,
  listCategoriesWithDefaults,
  updateCategory,
} from "@/lib/mission-category-repository";

function withCounts() {
  return listCategoriesWithDefaults().map((cat) => ({
    ...cat,
    missionCount: countMissionsInCategory(cat.id),
    templateCount: countTemplatesInCategory(cat.id),
  }));
}

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    ensureDb();
    ensureDefaultCategories();
    const health = getSchemaHealth();
    if (!health.hasMissionCategoriesTable) {
      return NextResponse.json(
        {
          error:
            "mission_categories table is missing — restart Control Hub or run npm run db:migrate",
          migrationRequired: true,
          schemaVersion: health.schemaVersion,
        },
        { status: 503 },
      );
    }
    return NextResponse.json({
      data: {
        categories: withCounts(),
        schemaVersion: health.schemaVersion,
      },
    });
  } catch (error) {
    logApiError("GET /api/mission-categories", "list", error);
    const msg = error instanceof Error ? error.message : "Failed to load categories";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    ensureDb();
    ensureDefaultCategories();
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name : "";
    const color = typeof body.color === "string" ? body.color : undefined;
    if (!name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const cat = createCategory({ name, color });
    return NextResponse.json(
      {
        data: {
          category: {
            ...cat,
            missionCount: 0,
            templateCount: 0,
          },
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Create failed";
    if (msg.includes("already exists")) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    logApiError("POST /api/mission-categories", "create", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const updates: { name?: string; color?: string; sortOrder?: number } = {};
    if (typeof body.name === "string") updates.name = body.name;
    if (typeof body.color === "string") updates.color = body.color;
    if (typeof body.sortOrder === "number") updates.sortOrder = body.sortOrder;

    const cat = updateCategory(id, updates);
    if (!cat) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    return NextResponse.json({
      data: {
        category: {
          ...cat,
          missionCount: countMissionsInCategory(cat.id),
          templateCount: countTemplatesInCategory(cat.id),
        },
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Update failed";
    logApiError("PUT /api/mission-categories", "update", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const reassignParam = url.searchParams.get("reassignToId");
    const reassignToId =
      reassignParam === "null" || reassignParam === ""
        ? null
        : reassignParam ?? undefined;

    const missionCount = countMissionsInCategory(id);
    const templateCount = countTemplatesInCategory(id);
    if ((missionCount > 0 || templateCount > 0) && reassignToId === undefined) {
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
      return NextResponse.json(
        { error: "Reassign target category not found" },
        { status: 400 },
      );
    }

    deleteCategory(id, reassignToId);
    return NextResponse.json({ data: { deleted: id } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Delete failed";
    if (msg.includes("System categories")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    logApiError("DELETE /api/mission-categories", "delete", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
