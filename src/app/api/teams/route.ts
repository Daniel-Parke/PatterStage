// ═══════════════════════════════════════════════════════════════
// /api/teams — Team CRUD (SQLite)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { appendAuditLine } from "@/lib/audit-log";
import {
  listTeams,
  getTeam,
  createTeam,
  updateTeam,
  deleteTeam,
  addTeamMember,
  removeTeamMember,
} from "@/lib/teams-repository";
import { updateBoard } from "@/lib/kanban-repository";
import type { TeamMember } from "@/types/hermes";

// ── GET ───────────────────────────────────────────────────────

export async function GET(request: Request) {
  const url = new URL(request.url);
  const teamId = url.searchParams.get("id");
  const boardId = url.searchParams.get("boardId");

  try {
    if (teamId) {
      const team = getTeam(teamId);
      if (!team) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 });
      }
      return NextResponse.json({ data: { team } });
    }

    const teams = listTeams();

    if (boardId) {
      const filtered = teams.filter((t) => t.boardIds.includes(boardId));
      return NextResponse.json({ data: { teams: filtered } });
    }

    return NextResponse.json({ data: { teams } });
  } catch (error) {
    logApiError("GET /api/teams", teamId ?? boardId ? "team lookup" : "listing teams", error);
    return NextResponse.json({ error: "Failed to load teams" }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const body = await request.json();
    const { action } = body as { action?: string };

    // ── Create Team ────────────────────────────────────────────
    if (action === "create") {
      const { name, description, leaderProfileId, members } = body as {
        name?: string;
        description?: string;
        leaderProfileId?: string;
        members?: Array<{ profileId: string; role?: TeamMember["role"] }>;
      };

      if (!name || typeof name !== "string" || !name.trim()) {
        return NextResponse.json({ error: "Team name is required" }, { status: 400 });
      }
      if (!leaderProfileId) {
        return NextResponse.json({ error: "Leader profile ID is required" }, { status: 400 });
      }

      const memberIds = (members ?? []).map((m) => m.profileId);
      const team = createTeam({
        name: name.trim(),
        description: (description ?? "").trim(),
        leaderProfileId: leaderProfileId.trim(),
        memberIds,
      });

      appendAuditLine({ action: "team.create", resource: team.id, ok: true });
      return NextResponse.json({ data: { team } }, { status: 201 });
    }

    // ── Update Team ───────────────────────────────────────────
    if (action === "update") {
      const { teamId, name, description, leaderProfileId } = body as {
        teamId?: string;
        name?: string;
        description?: string;
        leaderProfileId?: string;
      };

      if (!teamId) return NextResponse.json({ error: "teamId is required" }, { status: 400 });

      const team = updateTeam(teamId, {
        name: name?.trim(),
        description: description?.trim(),
        leaderProfileId: leaderProfileId?.trim(),
      });
      if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

      appendAuditLine({ action: "team.update", resource: teamId, ok: true });
      return NextResponse.json({ data: { team } });
    }

    // ── Add Member ────────────────────────────────────────────
    if (action === "add-member") {
      const { teamId, profileId, role } = body as {
        teamId?: string;
        profileId?: string;
        role?: TeamMember["role"];
      };

      if (!teamId || !profileId) {
        return NextResponse.json({ error: "teamId and profileId are required" }, { status: 400 });
      }

      const team = addTeamMember(teamId, profileId.trim(), role ?? "specialist");
      if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

      appendAuditLine({ action: "team.member.add", resource: teamId, ok: true });
      return NextResponse.json({ data: { team } });
    }

    // ── Remove Member ──────────────────────────────────────────
    if (action === "remove-member") {
      const { teamId, profileId } = body as { teamId?: string; profileId?: string };

      if (!teamId || !profileId) {
        return NextResponse.json({ error: "teamId and profileId are required" }, { status: 400 });
      }

      const ok = removeTeamMember(teamId, profileId.trim());
      if (!ok) return NextResponse.json({ error: "Team not found or cannot remove leader" }, { status: 404 });

      const team = getTeam(teamId);
      appendAuditLine({ action: "team.member.remove", resource: teamId, ok: true });
      return NextResponse.json({ data: { team } });
    }

    // ── Link Board ────────────────────────────────────────────
    if (action === "link-board") {
      const { teamId, boardId } = body as { teamId?: string; boardId?: string };

      if (!teamId || !boardId) {
        return NextResponse.json({ error: "teamId and boardId are required" }, { status: 400 });
      }

      // Verify team exists
      const team = getTeam(teamId);
      if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

      // Update board's team_id and return updated team
      const board = updateBoard(boardId, { teamId });
      if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

      appendAuditLine({ action: "team.board.link", resource: teamId, ok: true });
      return NextResponse.json({ data: { team, board } });
    }

    // ── Delete Team ────────────────────────────────────────────
    if (action === "delete") {
      const { teamId } = body as { teamId?: string };
      if (!teamId) return NextResponse.json({ error: "teamId is required" }, { status: 400 });

      const ok = deleteTeam(teamId);
      if (!ok) return NextResponse.json({ error: "Team not found" }, { status: 404 });

      appendAuditLine({ action: "team.delete", resource: teamId, ok: true });
      return NextResponse.json({ data: { deleted: teamId } });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    logApiError("POST /api/teams", "processing request", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
