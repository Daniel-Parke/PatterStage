// ═════════════════════════════════════════════════════════════════════════════════════
// /api/kanban — Kanban Board CRUD (KanbanAdapter interface)
//
// All kanban operations now route through KanbanAdapter, making ~/control-hub
// completely agnostic to the underlying persistence backend. To swap backends,
// implement a new adapter and update the factory in default-adapter.ts — nothing
// else in this file needs to change.
//
// Agent integration: when a card moves to "in_progress", dispatchKanbanCard is called
// automatically, creating a mission via the Hermes backend and linking it
// to the card.
// ═════════════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { appendAuditLine } from "@/lib/audit-log";
import { getKanbanAdapter } from "@/lib/kanban-adapter/default-adapter";
import { dispatchKanbanCard } from "@/lib/kanban-adapter/agent-bridge";
import type { AccentColor } from "@/lib/kanban-adapter/types";
import type { KanbanCard } from "@/types/hermes";

// ── Helpers ───────────────────────────────────────────────────────────────────

function adapter() {
  return getKanbanAdapter();
}

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const url = new URL(request.url);
  const boardId = url.searchParams.get("id") ?? url.searchParams.get("boardId");

  try {
    if (boardId) {
      const doc = adapter().loadKanbanDocument(boardId);
      if (!doc) {
        return NextResponse.json({ error: "Board not found" }, { status: 404 });
      }
      return NextResponse.json({ data: doc });
    }

    const boards = adapter().listBoards();
    return NextResponse.json({ data: { boards } });
  } catch (error) {
    logApiError("GET /api/kanban", boardId ? `board ${boardId}` : "listing boards", error);
    return NextResponse.json({ error: "Failed to load kanban data" }, { status: 500 });
  }
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const body = await request.json();
    const { action } = body as { action?: string };

    // ── Create Board ────────────────────────────────────────────────────────
    if (action === "create-board") {
      const { name, description, teamId, columns } = body as {
        name?: string;
        description?: string;
        teamId?: string;
        columns?: Array<{
          title: string;
          color?: AccentColor;
          position?: number;
          wipLimit?: number | null;
        }>;
      };

      if (!name || typeof name !== "string" || !name.trim()) {
        return NextResponse.json({ error: "Board name is required" }, { status: 400 });
      }

      const board = adapter().createBoard({
        name: name.trim(),
        description: (description ?? "").trim(),
        teamId: teamId?.trim(),
      });

      const defaultColumns = [
        { title: "Backlog", color: "cyan", position: 0, wipLimit: null },
        { title: "To Do", color: "orange", position: 1, wipLimit: null },
        { title: "In Progress", color: "purple", position: 2, wipLimit: null },
        { title: "Review", color: "pink", position: 3, wipLimit: null },
        { title: "Done", color: "green", position: 4, wipLimit: null },
      ];

      const colDefs = columns && columns.length > 0 ? columns : defaultColumns;
      const colMap: Record<string, unknown> = {};
      const columnIds: string[] = [];

      for (const def of colDefs) {
        const col = adapter().createColumn({
          boardId: board.id,
          title: def.title,
          color: def.color ?? "cyan",
          position: def.position ?? 0,
          wipLimit: def.wipLimit ?? null,
        });
        columnIds.push(col.id);
        colMap[col.id] = col;
      }

      const doc = {
        board: { ...board, columnIds },
        columns: colMap,
        cards: {} as Record<string, KanbanCard>,
      };

      appendAuditLine({ action: "kanban.board.create", resource: board.id, ok: true });
      return NextResponse.json({ data: doc }, { status: 201 });
    }

    // ── Update Board ────────────────────────────────────────────────────────
    if (action === "update-board") {
      const { boardId, name, description, teamId } = body as {
        boardId?: string;
        name?: string;
        description?: string;
        teamId?: string;
      };

      if (!boardId) {
        return NextResponse.json({ error: "boardId is required" }, { status: 400 });
      }

      const board = adapter().updateBoard(boardId, {
        name: name?.trim(),
        description: description?.trim(),
        teamId: teamId?.trim(),
      });
      if (!board) {
        return NextResponse.json({ error: "Board not found" }, { status: 404 });
      }

      const doc = adapter().loadKanbanDocument(boardId);
      appendAuditLine({ action: "kanban.board.update", resource: boardId, ok: true });
      return NextResponse.json({ data: doc ?? { board } });
    }

    // ── Delete Board ───────────────────────────────────────────────────────
    if (action === "delete-board") {
      const { boardId } = body as { boardId?: string };
      if (!boardId) {
        return NextResponse.json({ error: "boardId is required" }, { status: 400 });
      }

      const ok = adapter().deleteBoard(boardId);
      if (!ok) {
        return NextResponse.json({ error: "Board not found" }, { status: 404 });
      }

      appendAuditLine({ action: "kanban.board.delete", resource: boardId, ok: true });
      return NextResponse.json({ data: { deleted: boardId } });
    }

    // ── Add Column ─────────────────────────────────────────────────────────
    if (action === "add-column") {
      const { boardId, title, color, wipLimit } = body as {
        boardId?: string;
        title?: string;
        color?: AccentColor;
        wipLimit?: number | null;
      };

      if (!boardId || !title) {
        return NextResponse.json({ error: "boardId and title are required" }, { status: 400 });
      }

      const existing = adapter().listColumns(boardId);
      const col = adapter().createColumn({
        boardId,
        title: title.trim(),
        color: color ?? "cyan",
        position: existing.length,
        wipLimit: wipLimit ?? null,
      });

      const doc = adapter().loadKanbanDocument(boardId);
      appendAuditLine({ action: "kanban.column.add", resource: col.id, ok: true });
      return NextResponse.json({ data: doc }, { status: 201 });
    }

    // ── Update Column ──────────────────────────────────────────────────────
    if (action === "update-column") {
      const { boardId, columnId, title, color, wipLimit } = body as {
        boardId?: string;
        columnId?: string;
        title?: string;
        color?: AccentColor;
        wipLimit?: number | null;
      };

      if (!boardId || !columnId) {
        return NextResponse.json({ error: "boardId and columnId are required" }, { status: 400 });
      }

      const col = adapter().updateColumn(columnId, {
        title: title?.trim(),
        color,
        wipLimit,
      });
      if (!col) {
        return NextResponse.json({ error: "Column not found" }, { status: 404 });
      }

      const doc = adapter().loadKanbanDocument(boardId);
      appendAuditLine({ action: "kanban.column.update", resource: columnId, ok: true });
      return NextResponse.json({ data: doc });
    }

    // ── Delete Column ─────────────────────────────────────────────────────
    if (action === "delete-column") {
      const { boardId, columnId } = body as { boardId?: string; columnId?: string };

      if (!boardId || !columnId) {
        return NextResponse.json({ error: "boardId and columnId are required" }, { status: 400 });
      }

      const ok = adapter().deleteColumn(columnId);
      if (!ok) {
        return NextResponse.json({ error: "Column not found" }, { status: 404 });
      }

      const doc = adapter().loadKanbanDocument(boardId);
      appendAuditLine({ action: "kanban.column.delete", resource: columnId, ok: true });
      return NextResponse.json({ data: doc ?? {} });
    }

    // ── Add Card ───────────────────────────────────────────────────────────
    if (action === "add-card") {
      const { boardId, columnId, title, description, assigneeProfileId, labels } = body as {
        boardId?: string;
        columnId?: string;
        title?: string;
        description?: string;
        assigneeProfileId?: string | null;
        labels?: string[];
      };

      if (!boardId || !columnId || !title) {
        return NextResponse.json(
          { error: "boardId, columnId and title are required" },
          { status: 400 }
        );
      }

      const board = adapter().getBoard(boardId);
      if (!board) {
        return NextResponse.json({ error: "Board not found" }, { status: 404 });
      }

      const col = adapter().getColumn(columnId);
      if (!col) {
        return NextResponse.json({ error: "Column not found" }, { status: 404 });
      }

      const existingCards = adapter().listCards(boardId).filter(
        (c) => c.columnId === columnId
      );

      const card = adapter().createCard({
        boardId,
        columnId,
        title: title.trim(),
        description: (description ?? "").trim(),
        assigneeProfileId: assigneeProfileId ?? null,
        labels: labels ?? [],
        position: existingCards.length,
        status: "todo",
      });

      const doc = adapter().loadKanbanDocument(boardId);
      appendAuditLine({ action: "kanban.card.add", resource: card.id, ok: true });
      return NextResponse.json({ data: { card, board: doc } }, { status: 201 });
    }

    // ── Update Card ────────────────────────────────────────────────────────
    if (action === "update-card") {
      const { boardId, cardId, title, description, assigneeProfileId, labels, status } = body as {
        boardId?: string;
        cardId?: string;
        title?: string;
        description?: string;
        assigneeProfileId?: string | null;
        labels?: string[];
        status?: KanbanCard["status"];
      };

      if (!boardId || !cardId) {
        return NextResponse.json({ error: "boardId and cardId are required" }, { status: 400 });
      }

      const card = adapter().updateCard(cardId, {
        title: title?.trim(),
        description: description?.trim(),
        assigneeProfileId,
        labels,
        status,
      });
      if (!card) {
        return NextResponse.json({ error: "Card not found" }, { status: 404 });
      }

      const doc = adapter().loadKanbanDocument(boardId);
      appendAuditLine({ action: "kanban.card.update", resource: cardId, ok: true });
      return NextResponse.json({ data: { card, board: doc } });
    }

    // ── Move Card ──────────────────────────────────────────────────────────
    if (action === "move-card") {
      const { boardId, cardId, toColumnId, toPosition } = body as {
        boardId?: string;
        cardId?: string;
        toColumnId?: string;
        toPosition?: number;
      };

      if (!boardId || !cardId || !toColumnId) {
        return NextResponse.json(
          { error: "boardId, cardId and toColumnId are required" },
          { status: 400 }
        );
      }

      const card = adapter().moveCard(cardId, toColumnId, toPosition ?? 0);
      if (!card) {
        return NextResponse.json({ error: "Card not found" }, { status: 404 });
      }

      // ── Agent dispatch bridge ─────────────────────────────────────────────
      // When a card moves to "in_progress", automatically dispatch it to the
      // Hermes backend. This is the key integration point that connects
      // the kanban board to the agent execution layer — completely abstracted
      // behind the adapter so any backend can implement this behaviour.
      let missionResult: { missionId: string } | null = null;

      if (card.status === "in_progress" && card.missionIds.length === 0) {
        try {
          // Only dispatch if no prior missions are linked
          missionResult = await dispatchKanbanCard(card);
          appendAuditLine({
            action: "kanban.card.dispatch",
            resource: cardId,
            ok: true,
            detail: `mission=${missionResult.missionId}`,
          });
        } catch (dispatchError) {
          // Dispatch failed but the card move succeeded — log and continue
          // The card is in "in_progress" without an active mission; user can retry
          logApiError(
            "POST /api/kanban move-card dispatch",
            `cardId=${cardId}`,
            dispatchError
          );
        }
      }

      const doc = adapter().loadKanbanDocument(boardId);
      appendAuditLine({ action: "kanban.card.move", resource: cardId, ok: true });
      return NextResponse.json({
        data: {
          card,
          board: doc,
          ...(missionResult ? { mission: missionResult } : {}),
        },
      });
    }

    // ── Delete Card ───────────────────────────────────────────────────────
    if (action === "delete-card") {
      const { boardId, cardId } = body as { boardId?: string; cardId?: string };

      if (!boardId || !cardId) {
        return NextResponse.json({ error: "boardId and cardId are required" }, { status: 400 });
      }

      const ok = adapter().deleteCard(cardId);
      if (!ok) {
        return NextResponse.json({ error: "Card not found" }, { status: 404 });
      }

      const doc = adapter().loadKanbanDocument(boardId);
      appendAuditLine({ action: "kanban.card.delete", resource: cardId, ok: true });
      return NextResponse.json({ data: doc ?? {} });
    }

    // ── Explicit dispatch (manual, from "Dispatch" button) ──────────────────
    if (action === "dispatch-card") {
      const { cardId, profileId, promptSuffix } = body as {
        cardId?: string;
        profileId?: string;
        promptSuffix?: string;
      };

      if (!cardId) {
        return NextResponse.json({ error: "cardId is required" }, { status: 400 });
      }

      const card = adapter().getCard(cardId);
      if (!card) {
        return NextResponse.json({ error: "Card not found" }, { status: 404 });
      }

      const result = await dispatchKanbanCard(card, { profileId, promptSuffix });
      appendAuditLine({
        action: "kanban.card.dispatch",
        resource: cardId,
        ok: true,
        detail: `mission=${result.missionId}`,
      });

      return NextResponse.json({ data: { missionId: result.missionId } });
    }

    // Unknown action
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    logApiError("POST /api/kanban", "processing request", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
