// ═══════════════════════════════════════════════════════════════
// /api/models/framework — persist active framework preference
//
// GET  — returns the currently active framework ID
// PUT  — sets the active framework (persists to disk)
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { listFrameworks } from "@/lib/framework-registry";
import { getActiveHermesHome } from "@/lib/hermes-agent-runtime";
import { logApiError } from "@/lib/api-logger";
import { requireMcApiKey } from "@/lib/api-auth";

const ACTIVE_FW_FILE = `${getActiveHermesHome()}/.control-hub-active-fw.json`;

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readPersistedFramework(): string {
  try {
    if (!existsSync(ACTIVE_FW_FILE)) return "hermes";
    const raw = JSON.parse(readFileSync(ACTIVE_FW_FILE, "utf-8"));
    return raw.id ?? "hermes";
  } catch {
    return "hermes";
  }
}

function writePersistedFramework(id: string): void {
  ensureDir(getActiveHermesHome());
  writeFileSync(ACTIVE_FW_FILE, JSON.stringify({ id, updatedAt: new Date().toISOString() }), "utf-8");
}

export async function GET() {
  try {
    return NextResponse.json({ data: { active: readPersistedFramework() } });
  } catch (error) {
    logApiError("GET /api/models/framework", "reading active framework", error);
    return NextResponse.json({ error: "Failed to read framework" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = requireMcApiKey(request);
  if (auth) return auth;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const framework = (raw as Record<string, unknown>)?.framework as string;
  if (!framework) {
    return NextResponse.json({ error: "framework is required" }, { status: 400 });
  }

  const valid = listFrameworks().map(f => f.id);
  if (!valid.includes(framework) && framework !== "*") {
    return NextResponse.json({ error: `Invalid framework. Must be one of: ${valid.join(", ")}` }, { status: 400 });
  }

  try {
    writePersistedFramework(framework);
    return NextResponse.json({ data: { active: framework } });
  } catch (error) {
    logApiError("PUT /api/models/framework", `setting framework to ${framework}`, error);
    return NextResponse.json({ error: "Failed to set framework" }, { status: 500 });
  }
}
