// ═══════════════════════════════════════════════════════════════
// story-handlers/library.ts — POST actions "characters" / "themes"
//
// These two actions have been posted by the UI since V3 and answered by nobody:
// /api/stories only ever handled create|list|load|update|delete|continue|extend,
// so the Characters page, the Themes page, and the import pickers on the create
// page all 400'd on every request. The pages swallowed the error, so the library
// just looked permanently empty.
//
// The sub-action shape is dictated by that existing client:
//   { action: "characters", subAction: "list" }
//   { action: "characters", subAction: "create", ...fields }
//   { action: "characters", subAction: "update", charId, ...fields }
//   { action: "characters", subAction: "delete", charId }
// and the same for themes with `themeId`.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";

import {
  createCharacter,
  createTheme,
  deleteCharacter,
  deleteTheme,
  listCharacters,
  listThemes,
  updateCharacter,
  updateTheme,
  type CharacterInput,
  type ThemeInput,
} from "@/modules/rec-room/lib/library-repository";
import { serverErrorFromCatch } from "@/lib/api-logger";

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** Accept a string array, tolerating the odd stray non-string from a client. */
const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

function characterInput(body: Record<string, unknown>): CharacterInput {
  return {
    name: str(body.name).trim(),
    role: str(body.role),
    description: str(body.description),
    personality: strArray(body.personality),
    backstory: str(body.backstory),
    appearance: str(body.appearance),
    speechPatterns: str(body.speechPatterns),
    relationships: str(body.relationships),
    tags: strArray(body.tags),
  };
}

function themeInput(body: Record<string, unknown>): ThemeInput {
  return {
    name: str(body.name).trim(),
    premise: str(body.premise),
    genre: strArray(body.genre),
    era: str(body.era),
    setting: str(body.setting),
    mood: strArray(body.mood),
    notes: str(body.notes),
  };
}

export async function handleCharacters(body: Record<string, unknown>): Promise<NextResponse> {
  const subAction = str(body.subAction) || "list";
  try {
    switch (subAction) {
      case "list":
        return NextResponse.json({ data: { characters: listCharacters() } });

      case "create": {
        const input = characterInput(body);
        if (!input.name) return NextResponse.json({ error: "Character name is required" }, { status: 400 });
        return NextResponse.json({ data: { character: createCharacter(input) } });
      }

      case "update": {
        const charId = str(body.charId);
        if (!charId) return NextResponse.json({ error: "Missing charId" }, { status: 400 });
        const input = characterInput(body);
        if (!input.name) return NextResponse.json({ error: "Character name is required" }, { status: 400 });
        const character = updateCharacter(charId, input);
        if (!character) return NextResponse.json({ error: "Character not found" }, { status: 404 });
        return NextResponse.json({ data: { character } });
      }

      case "delete": {
        const charId = str(body.charId);
        if (!charId) return NextResponse.json({ error: "Missing charId" }, { status: 400 });
        if (!deleteCharacter(charId)) return NextResponse.json({ error: "Character not found" }, { status: 404 });
        return NextResponse.json({ data: { deleted: true } });
      }

      default:
        return NextResponse.json({ error: `Unknown characters sub-action: ${subAction}` }, { status: 400 });
    }
  } catch (error) {
    return serverErrorFromCatch("POST /api/stories characters", subAction, error, "Character library failed");
  }
}

export async function handleThemes(body: Record<string, unknown>): Promise<NextResponse> {
  const subAction = str(body.subAction) || "list";
  try {
    switch (subAction) {
      case "list":
        return NextResponse.json({ data: { themes: listThemes() } });

      case "create": {
        const input = themeInput(body);
        if (!input.name) return NextResponse.json({ error: "Theme name is required" }, { status: 400 });
        return NextResponse.json({ data: { theme: createTheme(input) } });
      }

      case "update": {
        const themeId = str(body.themeId);
        if (!themeId) return NextResponse.json({ error: "Missing themeId" }, { status: 400 });
        const input = themeInput(body);
        if (!input.name) return NextResponse.json({ error: "Theme name is required" }, { status: 400 });
        const theme = updateTheme(themeId, input);
        if (!theme) return NextResponse.json({ error: "Theme not found" }, { status: 404 });
        return NextResponse.json({ data: { theme } });
      }

      case "delete": {
        const themeId = str(body.themeId);
        if (!themeId) return NextResponse.json({ error: "Missing themeId" }, { status: 400 });
        if (!deleteTheme(themeId)) return NextResponse.json({ error: "Theme not found" }, { status: 404 });
        return NextResponse.json({ data: { deleted: true } });
      }

      default:
        return NextResponse.json({ error: `Unknown themes sub-action: ${subAction}` }, { status: 400 });
    }
  } catch (error) {
    return serverErrorFromCatch("POST /api/stories themes", subAction, error, "Theme library failed");
  }
}
