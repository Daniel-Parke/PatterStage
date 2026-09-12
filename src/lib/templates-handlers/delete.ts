// ═══════════════════════════════════════════════════════════════
// templates-handlers/delete.ts - POST /api/templates { action: "delete" }
// ═══════════════════════════════════════════════════════════════
//
// `sanitizeTemplateId` strips every path character, so "../" sanitises to
// the empty string and is rejected rather than resolved. That empty-string
// check is the path-traversal regression guarded by
// tests/unit/template-security.test.ts.

import { existsSync, unlinkSync } from "fs";
import { NextResponse } from "next/server";

import {
  DATA_DIR,
  TemplateActionBody,
  invalidateTemplatesCache,
  sanitizeTemplateId,
} from "./shared";

export function handleDeleteTemplate(body: TemplateActionBody): NextResponse {
  const { templateId } = body;
  const sanitizedId = sanitizeTemplateId(templateId);
  if (!sanitizedId) {
    return NextResponse.json({ error: "Invalid template id" }, { status: 400 });
  }
  const path = DATA_DIR + "/" + sanitizedId + ".json";
  if (existsSync(path)) {
    unlinkSync(path);
    invalidateTemplatesCache();
    return NextResponse.json({ data: { deleted: true } });
  }
  return NextResponse.json({ error: "Template not found" }, { status: 404 });
}
