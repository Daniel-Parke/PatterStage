// ═══════════════════════════════════════════════════════════════
// /api/missions — Mission CRUD + dispatch (SQLite)
// ═══════════════════════════════════════════════════════════════
// Missions are stored in Control Hub SQLite. Dispatch is handled
// by the AgentBackend so any agent backend can run missions.
import { NextRequest, NextResponse } from "next/server";
import {
  getMission,
  listMissions,
  createMission,
  updateMission,
  deleteMission,
  buildMissionPrompt,
} from "@/lib/mission-repository";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { appendAuditLine } from "@/lib/audit-log";
import type { MissionStatus } from "@/lib/agent-backend/types";
import { agentBackend } from "@/lib/backends";

// ── GET ───────────────────────────────────────────────────────

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  try {
    if (id) {
      const mission = getMission(id);
      if (!mission) {
        return NextResponse.json({ error: "Mission not found" }, { status: 404 });
      }
      return NextResponse.json({ data: { mission } });
    }

    const missions = listMissions();
    return NextResponse.json({ data: { missions } });
  } catch (error) {
    logApiError("GET /api/missions", id ? `mission ${id}` : "listing missions", error);
    return NextResponse.json({ error: "Failed to load missions" }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const ro = requireNotReadOnly();
  if (ro) return ro;
  const auth = requireMcApiKey(request);
  if (auth) return auth;

  try {
    const body = await request.json();
    const { action } = body as { action?: string };

    // ── Dispatch Mission ────────────────────────────────────────
    if (action === "dispatch") {
      const {
        name,
        instruction,
        profileId,
        localDirs,
        references,
        skills,
        goals,
        context,
        dispatchMode,
        schedule,
      } = body as {
        name?: string;
        instruction?: string;
        profileId?: string;
        localDirs?: string[];
        references?: string[];
        skills?: string[];
        goals?: string[];
        context?: string;
        dispatchMode?: string;
        schedule?: string;
      };

      if (!instruction || typeof instruction !== "string" || !instruction.trim()) {
        return NextResponse.json({ error: "instruction is required" }, { status: 400 });
      }

      // Build the full prompt server-side using buildMissionPrompt
      const prompt = buildMissionPrompt({
        instruction: instruction.trim(),
        localDirs: localDirs ?? [],
        references: references ?? [],
        skills: skills ?? [],
        goals: goals ?? [],
        context: context ?? "",
      });

      // Create mission record
      const mission = createMission({
        name: (name as string)?.trim() || "Untitled Mission",
        prompt,
        profileId,
        localDirs: localDirs ?? [],
        references: references ?? [],
        skills: skills ?? [],
        goals: goals ?? [],
      });

      // Only dispatch if not "save" mode
      const isSaveMode = dispatchMode === "save";

      if (!isSaveMode) {
        updateMission(mission.id, { status: "running" });

        try {
          const dispatched = await agentBackend.dispatchMission({
            name: mission.name,
            prompt: mission.prompt,
            profileId: mission.profileId,
          });
          updateMission(mission.id, {
            sessionId: dispatched.sessionId,
            status: "running",
          });
        } catch (err) {
          logApiError("POST /api/missions", "dispatch", err);
          updateMission(mission.id, { status: "failed" });
        }
      }

      appendAuditLine({ action: "mission.dispatch", resource: mission.id, ok: true });
      return NextResponse.json(
        { data: { mission: getMission(mission.id) } },
        { status: 201 }
      );
    }

    // ── Update Mission ─────────────────────────────────────────
    if (action === "update") {
      const { id, missionId, status, result, localDirs, references, skills, goals } = body as {
        id?: string;
        missionId?: string;
        status?: string;
        result?: string;
        localDirs?: string[];
        references?: string[];
        skills?: string[];
        goals?: string[];
      };
      const missionIdFinal = id ?? missionId;
      if (!missionIdFinal)
        return NextResponse.json({ error: "Mission id is required" }, { status: 400 });

      const updates: {
        status?: MissionStatus;
        result?: string;
        localDirs?: string[];
        references?: string[];
        skills?: string[];
        goals?: string[];
      } = {};
      if (status) updates.status = status as MissionStatus;
      if (result !== undefined) updates.result = result;
      if (localDirs !== undefined) updates.localDirs = localDirs;
      if (references !== undefined) updates.references = references;
      if (skills !== undefined) updates.skills = skills;
      if (goals !== undefined) updates.goals = goals;

      const mission = updateMission(missionIdFinal, updates);
      if (!mission)
        return NextResponse.json({ error: "Mission not found" }, { status: 404 });

      appendAuditLine({ action: "mission.update", resource: missionIdFinal, ok: true });
      return NextResponse.json({ data: { mission } });
    }

    // ── Cancel Mission ─────────────────────────────────────────
    if (action === "cancel") {
      const { id } = body as { id?: string };
      if (!id)
        return NextResponse.json({ error: "Mission id is required" }, { status: 400 });

      const mission = updateMission(id, { status: "cancelled" });
      if (!mission)
        return NextResponse.json({ error: "Mission not found" }, { status: 404 });

      appendAuditLine({ action: "mission.cancel", resource: id, ok: true });
      return NextResponse.json({ data: { mission } });
    }

    // ── Delete Mission ─────────────────────────────────────────
    if (action === "delete") {
      const { id, missionId } = body as { id?: string; missionId?: string };
      const missionIdFinal = id ?? missionId;
      if (!missionIdFinal)
        return NextResponse.json({ error: "Mission id is required" }, { status: 400 });

      const ok = deleteMission(missionIdFinal);
      if (!ok)
        return NextResponse.json({ error: "Mission not found" }, { status: 404 });

      appendAuditLine({ action: "mission.delete", resource: missionIdFinal, ok: true });
      return NextResponse.json({ data: { deleted: missionIdFinal } });
    }

    // ── Get Status ────────────────────────────────────────────
    if (action === "status") {
      const { id } = body as { id?: string };
      if (!id)
        return NextResponse.json({ error: "Mission id is required" }, { status: 400 });

      const status = await agentBackend.getMissionStatus(id);
      return NextResponse.json({ data: { status } });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    logApiError("POST /api/missions", "processing request", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
