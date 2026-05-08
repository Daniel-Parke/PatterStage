import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { readFileSync, existsSync } from "fs";
import * as path from "path";

import { HERMES_HOME } from "@/lib/hermes";
import { logApiError } from "@/lib/api-logger";
import type { ApiResponse } from "@/types/hermes";

const BRIDGE_SCRIPT = HERMES_HOME + "/scripts/hindsight_bridge.py";

// Resolve python3 from the hermes-agent venv — try common locations
function resolvePython(): string {
  const candidates = [
    path.join(HERMES_HOME, "hermes-agent", "venv", "bin", "python3"),
    path.join(HERMES_HOME, "hermes-agent", ".venv", "bin", "python3"),
    path.join(HERMES_HOME, "..", ".local", "share", "hermes-agent", "venv", "bin", "python3"),
    path.join(HERMES_HOME, "..", "hermes-agent", "venv", "bin", "python3"),
    path.join(process.env.HOME || "", ".local", "share", "hermes-agent", "venv", "bin", "python3"),
    "/usr/bin/python3",
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return "python3"; // fallback to PATH
}

/** Run bridge command asynchronously with timeout */
function runBridgeAsync(
  command: string,
  args: Record<string, string | number | undefined> = {},
  timeoutMs = 15000
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const argStr = Object.entries(args)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `--${k} ${JSON.stringify(String(v))}`)
      .join(" ");

    const python = resolvePython();
    const cmd = `${python} ${BRIDGE_SCRIPT} ${command} ${argStr}`;

    // Inject HINDSIGHT_API_KEY from config if present
    const apiKey = (() => {
      try {
        const cfgPath = path.join(HERMES_HOME, "hindsight", "config.json");
        if (existsSync(cfgPath)) {
          const cfg = JSON.parse(readFileSync(cfgPath, "utf-8"));
          // local_external uses llm_api_key, cloud uses top-level HINDSIGHT_API_KEY env
          return cfg.llm_api_key || process.env.HINDSIGHT_API_KEY || "";
        }
      } catch { /* ignore */ }
      return process.env.HINDSIGHT_API_KEY || "";
    })();

    const execEnv = {
      ...process.env,
      PYTHONPATH: path.join(HERMES_HOME, "hermes-agent"),
      ...(apiKey ? { HINDSIGHT_API_KEY: apiKey } : {}),
    };

    exec(cmd, { timeout: timeoutMs, env: execEnv, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && !stdout) {
        reject(new Error(stderr || error.message));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error("Invalid JSON from bridge: " + stdout.slice(0, 200)));
      }
    });
  });
}

// GET — List memories, recall, reflect, health check
export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get("action") || "list";
  const query = request.nextUrl.searchParams.get("query") || undefined;
  const budget = request.nextUrl.searchParams.get("budget") || undefined;
  const bank = request.nextUrl.searchParams.get("bank") || undefined;
  const limit = request.nextUrl.searchParams.get("limit") || undefined;

  try {
    let result: Record<string, unknown>;

    switch (action) {
      case "list":
        result = await runBridgeAsync("list", { bank, search: query, limit });
        break;
      case "recall":
        if (!query) {
          return NextResponse.json({ error: "query is required for recall" }, { status: 400 });
        }
        result = await runBridgeAsync("recall", { bank, query, budget });
        break;
      case "reflect":
        if (!query) {
          return NextResponse.json({ error: "query is required for reflect" }, { status: 400 });
        }
        result = await runBridgeAsync("reflect", { bank, query, budget });
        break;
      case "directives":
        result = await runBridgeAsync("directives", { bank });
        break;
      case "mental-models":
        result = await runBridgeAsync("mental-models", { bank });
        break;
      case "health":
        result = await runBridgeAsync("health", {}, 10000);
        break;
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    // If the bridge returned an error, surface it properly
    if (result && typeof result === "object" && "error" in result) {
      return NextResponse.json(
        { data: { available: false, error: (result as Record<string, unknown>).error, memories: [] } },
        { status: 502 }
      );
    }

    return NextResponse.json<ApiResponse<Record<string, unknown>>>({ data: result });
  } catch (error) {
    logApiError("GET /api/memory/hindsight", `action=${action}`, error);
    return NextResponse.json(
      {
        data: {
          available: false,
          error: error instanceof Error ? error.message : "Bridge error",
          memories: [],
        },
      }
    );
  }
}

// POST — Retain memory, create directive, create mental model
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action || "retain";
    const bank = body.bank || "hermes";

    let result: Record<string, unknown>;

    switch (action) {
      case "retain": {
        const { content, tags } = body;
        if (!content || typeof content !== "string" || content.trim().length === 0) {
          return NextResponse.json({ error: "Content is required" }, { status: 400 });
        }
        const args: Record<string, string> = { bank, content: content.trim() };
        if (tags && Array.isArray(tags)) args.tags = tags.join(",");
        result = await runBridgeAsync("retain", args);
        break;
      }
      case "create-directive": {
        const { name, content: dirContent, priority, tags } = body;
        if (!name || !dirContent) {
          return NextResponse.json({ error: "name and content are required" }, { status: 400 });
        }
        const dArgs: Record<string, string | number> = { bank, name, content: dirContent };
        if (priority !== undefined) dArgs.priority = priority;
        if (tags && Array.isArray(tags)) dArgs.tags = tags.join(",");
        result = await runBridgeAsync("create-directive", dArgs);
        break;
      }
      case "create-model": {
        const { name, query, tags } = body;
        if (!name || !query) {
          return NextResponse.json({ error: "name and query are required" }, { status: 400 });
        }
        const mArgs: Record<string, string> = { bank, name, query };
        if (tags && Array.isArray(tags)) mArgs.tags = tags.join(",");
        result = await runBridgeAsync("create-model", mArgs, 60000);
        break;
      }
      case "update-directive": {
        const { id, name, content: uContent, priority, is_active, tags } = body;
        if (!id) {
          return NextResponse.json({ error: "id is required" }, { status: 400 });
        }
        const uArgs: Record<string, string | number> = { bank, id };
        if (name !== undefined) uArgs.name = name;
        if (uContent !== undefined) uArgs.content = uContent;
        if (priority !== undefined) uArgs.priority = priority;
        if (is_active !== undefined) uArgs["is-active"] = String(is_active);
        if (tags !== undefined) uArgs.tags = Array.isArray(tags) ? tags.join(",") : tags;
        result = await runBridgeAsync("update-directive", uArgs);
        break;
      }
      case "update-model": {
        const { id, name, query, tags } = body;
        if (!id) {
          return NextResponse.json({ error: "id is required" }, { status: 400 });
        }
        const umArgs: Record<string, string> = { bank, id };
        if (name !== undefined) umArgs.name = name;
        if (query !== undefined) umArgs.query = query;
        if (tags !== undefined) umArgs.tags = Array.isArray(tags) ? tags.join(",") : tags;
        result = await runBridgeAsync("update-model", umArgs);
        break;
      }
      case "refresh-model": {
        const { id } = body;
        if (!id) {
          return NextResponse.json({ error: "id is required" }, { status: 400 });
        }
        result = await runBridgeAsync("refresh-model", { bank, id }, 60000);
        break;
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json<ApiResponse<Record<string, unknown>>>({ data: result });
  } catch (error) {
    logApiError("POST /api/memory/hindsight", "action", error);
    return NextResponse.json(
      { error: `Failed: ${error instanceof Error ? error.message : "Unknown"}` },
      { status: 500 }
    );
  }
}

// DELETE — Remove directive or mental model
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, id, bank = "hermes" } = body;

    if (!id || !type) {
      return NextResponse.json({ error: "type and id are required" }, { status: 400 });
    }

    const command = type === "directive" ? "delete-directive" : "delete-model";
    const result = await runBridgeAsync(command, { bank, id });

    return NextResponse.json<ApiResponse<Record<string, unknown>>>({ data: result });
  } catch (error) {
    logApiError("DELETE /api/memory/hindsight", "delete", error);
    return NextResponse.json(
      { error: `Failed: ${error instanceof Error ? error.message : "Unknown"}` },
      { status: 500 }
    );
  }
}
