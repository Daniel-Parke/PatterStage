// ═══════════════════════════════════════════════════════════════
// Custom Templates API — CRUD for user-created mission templates
// ═══════════════════════════════════════════════════════════════
//
// A thin auth + parse + router. Each POST action (create/update/
// importPack/delete) and the GET listing live in their own module under
// src/lib/templates-handlers/*; the disk layout and the 30s list cache
// they share live in templates-handlers/shared.ts.
//
// Authentication is enforced once in src/proxy.ts; `requireAuth` here is
// the route's own gate and never a second token check (design-lint
// no-auth-in-route-handler).

import { NextRequest, NextResponse } from "next/server";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { parseJsonBody } from "@/lib/parse-json-body";
import { handleCreateTemplate } from "@/lib/templates-handlers/create";
import { handleDeleteTemplate } from "@/lib/templates-handlers/delete";
import { handleImportTemplatePack } from "@/lib/templates-handlers/import-pack";
import { handleListTemplates } from "@/lib/templates-handlers/list";
import type { TemplateActionBody } from "@/lib/templates-handlers/shared";
import { handleUpdateTemplate } from "@/lib/templates-handlers/update";

export async function GET() {
  return handleListTemplates();
}

export async function POST(request: NextRequest) {
  try {
    // Body shape is action-discriminated and validated per-branch below;
    // parseJsonBody gives us a 400 on malformed JSON but the inner field
    // types are checked per-branch. Body is untyped (was `any` when read
    // via request.json()) to preserve the original assignability to typed
    // template fields — see TemplateActionBody in templates-handlers/shared.ts.
    const parsed = await parseJsonBody(request);
    if (parsed instanceof NextResponse) return parsed;
    const body = parsed as TemplateActionBody;
    const { action } = body;

    if (action === "create") {
      return handleCreateTemplate(body);
    }

    if (action === "update") {
      return handleUpdateTemplate(body);
    }

    if (action === "importPack") {
      return handleImportTemplatePack(body);
    }

    if (action === "delete") {
      return handleDeleteTemplate(body);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return serverErrorFromCatch("POST /api/templates", "processing request", err, "Failed to process request");
  }
}
