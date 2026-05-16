import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import * as yaml from "js-yaml";

import { getActiveHermesPaths } from "@/lib/hermes-agent-runtime";
import { logApiError } from "@/lib/api-logger";

function configYamlPath(): string {
  return getActiveHermesPaths().config;
}

interface PersonalityData {
  name: string;
  prompt: string;
}

function readPersonalities(): Record<string, string> {
  if (!existsSync(configYamlPath())) return {};
  try {
    const content = readFileSync(configYamlPath(), "utf-8");
    // Use js-yaml to parse — handles multi-line quoted strings properly
    const parsed = yaml.load(content) as Record<string, unknown> | undefined;
    const raw = ((parsed?.agent as Record<string, unknown>)?.personalities as Record<string, unknown>) || {};
    const result: Record<string, string> = {};
    for (const [key, val] of Object.entries(raw)) {
      result[key] = String(val);
    }
    return result;
  } catch {
    return {};
  }
}

function writePersonalities(personalities: Record<string, string>): boolean {
  if (!existsSync(configYamlPath())) return false;

  /**
   * Serialize a single personality key-value pair as a YAML line,
   * handling multi-line values, special characters, and quotes correctly.
   */
  function serializePersonalityEntry(key: string, val: string): string {
    if (val.includes("\n")) {
      return `    ${key}: "${val.replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
    }
    if (val.includes(":") || val.includes("#") || val.includes('"') || val.includes("'")) {
      return `    ${key}: "${val.replace(/"/g, '\\"')}"`;
    }
    return `    ${key}: ${val}`;
  }

  try {
    const content = readFileSync(configYamlPath(), "utf-8");
    const lines = content.split("\n");
    const result: string[] = [];
    let inAgent = false;
    let skippingPersonalities = false;
    let personalitiesInserted = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim() === "agent:") {
        inAgent = true;
        result.push(line);
        continue;
      }

      if (inAgent && !line.startsWith(" ") && line.trim()) {
        // Exiting agent section — insert personalities if not yet done
        if (!personalitiesInserted) {
          result.push("  personalities:");
          const keys = Object.keys(personalities).sort();
          for (const key of keys) {
            result.push(serializePersonalityEntry(key, personalities[key]));
          }
          personalitiesInserted = true;
        }
        inAgent = false;
        skippingPersonalities = false;
        result.push(line);
        continue;
      }

      if (inAgent && line.trim() === "personalities:") {
        skippingPersonalities = true;
        // Write new personalities block
        result.push("  personalities:");
        const keys = Object.keys(personalities).sort();
        for (const key of keys) {
          result.push(serializePersonalityEntry(key, personalities[key]));
        }
        personalitiesInserted = true;
        continue;
      }

      if (skippingPersonalities) {
        // Skip old personality lines until we leave the personalities block
        if (line.startsWith("    ") || line.trim() === "") {
          continue;
        } else {
          skippingPersonalities = false;
          // Don't skip this line — it's the next config key
          result.push(line);
        }
        continue;
      }

      result.push(line);
    }

    // If we were still in agent at EOF
    if (inAgent && !personalitiesInserted) {
      result.push("  personalities:");
      const keys = Object.keys(personalities).sort();
      for (const key of keys) {
        result.push(serializePersonalityEntry(key, personalities[key]));
      }
    }

    writeFileSync(configYamlPath(), result.join("\n"), "utf-8");
    return true;
  } catch {
    return false;
  }
}

// GET /api/personalities — list all personalities
export async function GET() {
  try {
    const personalities = readPersonalities();
    const list = Object.entries(personalities).map(([name, prompt]) => ({
      name,
      prompt,
    }));
    return NextResponse.json({
      data: { personalities: list, total: list.length },
    });
  } catch (error) {
    logApiError("GET /api/personalities", "reading personalities", error);
    return NextResponse.json(
      { error: "Failed to read personalities" },
      { status: 500 }
    );
  }
}

// POST /api/personalities — create a new personality
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, prompt } = body as PersonalityData;

    if (!name || !prompt) {
      return NextResponse.json(
        { error: "Missing required fields: name, prompt" },
        { status: 400 }
      );
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (!slug) {
      return NextResponse.json(
        { error: "Invalid personality name" },
        { status: 400 }
      );
    }

    const personalities = readPersonalities();
    if (slug in personalities) {
      return NextResponse.json(
        { error: `Personality "${slug}" already exists` },
        { status: 409 }
      );
    }

    personalities[slug] = prompt;
    const success = writePersonalities(personalities);
    if (!success) {
      return NextResponse.json(
        { error: "Failed to save personality" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: { success: true, name: slug, prompt } });
  } catch (error) {
    logApiError("POST /api/personalities", "creating personality", error);
    return NextResponse.json(
      { error: "Failed to create personality" },
      { status: 500 }
    );
  }
}

// PUT /api/personalities — update a personality
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { originalName, name, prompt } = body;

    if (!originalName || !name || !prompt) {
      return NextResponse.json(
        { error: "Missing required fields: originalName, name, prompt" },
        { status: 400 }
      );
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (!slug) {
      return NextResponse.json(
        { error: "Invalid personality name" },
        { status: 400 }
      );
    }

    const personalities = readPersonalities();
    if (!(originalName in personalities)) {
      return NextResponse.json(
        { error: `Personality "${originalName}" not found` },
        { status: 404 }
      );
    }

    // If renaming, check no conflict
    if (slug !== originalName && slug in personalities) {
      return NextResponse.json(
        { error: `Personality "${slug}" already exists` },
        { status: 409 }
      );
    }

    // Remove old name if renaming
    if (slug !== originalName) {
      delete personalities[originalName];
    }
    personalities[slug] = prompt;

    const success = writePersonalities(personalities);
    if (!success) {
      return NextResponse.json(
        { error: "Failed to save personality" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: { success: true, name: slug, prompt } });
  } catch (error) {
    logApiError("PUT /api/personalities", "updating personality", error);
    return NextResponse.json(
      { error: "Failed to update personality" },
      { status: 500 }
    );
  }
}

// DELETE /api/personalities — delete a personality
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");

    if (!name) {
      return NextResponse.json(
        { error: "Missing personality name" },
        { status: 400 }
      );
    }

    const personalities = readPersonalities();
    if (!(name in personalities)) {
      return NextResponse.json(
        { error: `Personality "${name}" not found` },
        { status: 404 }
      );
    }

    delete personalities[name];
    const success = writePersonalities(personalities);
    if (!success) {
      return NextResponse.json(
        { error: "Failed to delete personality" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: { success: true, deleted: name } });
  } catch (error) {
    logApiError("DELETE /api/personalities", "deleting personality", error);
    return NextResponse.json(
      { error: "Failed to delete personality" },
      { status: 500 }
    );
  }
}
