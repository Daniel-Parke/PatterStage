// ═══════════════════════════════════════════════════════════════════════════════
// kanban-adapter/index.ts — KanbanAdapter interface
//
// The core abstraction: the kanban backend (Hermes SQLite storage) implements
// this interface. Control Hub's UI and API routes are decoupled from the storage layer.
//
// Usage:
//   const adapter: KanbanAdapter = getKanbanAdapter(); // factory below
//
// To add a new backend:
//   1. Implement KanbanAdapter in src/lib/kanban-adapter/backends/<name>.ts
//   2. Wire it into the factory in getKanbanAdapter()
//   3. Nothing else in ~/control-hub needs to change.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  KanbanBoard,
  KanbanColumn,
  KanbanCard,
  KanbanDocument,
  CardMissionLink,
  KanbanAuditEntry,
} from "./types";

// ── Interface ────────────────────────────────────────────────────────────────

export interface KanbanAdapter {
  /** Human-readable name of this backend */
  readonly name: string;

  // ── Board ────────────────────────────────────────────────────────────────

  listBoards(): KanbanBoard[];
  getBoard(id: string): KanbanBoard | null;
  createBoard(data: {
    name: string;
    description?: string;
    teamId?: string;
  }): KanbanBoard;
  updateBoard(
    id: string,
    updates: { name?: string; description?: string; teamId?: string }
  ): KanbanBoard | null;
  deleteBoard(id: string): boolean;

  // ── Column ───────────────────────────────────────────────────────────────

  listColumns(boardId: string): KanbanColumn[];
  getColumn(id: string): KanbanColumn | null;
  createColumn(data: {
    boardId: string;
    title: string;
    color?: string;
    position?: number;
    wipLimit?: number | null;
  }): KanbanColumn;
  updateColumn(
    id: string,
    updates: {
      title?: string;
      color?: string;
      position?: number;
      wipLimit?: number | null;
    }
  ): KanbanColumn | null;
  deleteColumn(id: string): boolean;

  // ── Card ─────────────────────────────────────────────────────────────────

  listCards(boardId: string): KanbanCard[];
  getCard(id: string): KanbanCard | null;
  createCard(data: {
    boardId: string;
    columnId: string;
    title: string;
    description?: string;
    assigneeProfileId?: string | null;
    labels?: string[];
    status?: KanbanCard["status"];
    position?: number;
  }): KanbanCard;
  updateCard(
    id: string,
    updates: {
      title?: string;
      description?: string;
      columnId?: string;
      position?: number;
      status?: KanbanCard["status"];
      assigneeProfileId?: string | null;
      labels?: string[];
      missionIds?: string[];
    }
  ): KanbanCard | null;
  moveCard(
    cardId: string,
    toColumnId: string,
    toPosition: number
  ): KanbanCard | null;
  deleteCard(id: string): boolean;

  // ── Full document ────────────────────────────────────────────────────────

  /** Load everything needed to render a board in one call */
  loadKanbanDocument(boardId: string): KanbanDocument | null;

  // ── Mission linkage ──────────────────────────────────────────────────────

  /** Link a card to an agent mission */
  linkCardToMission(cardId: string, missionId: string): CardMissionLink;

  /** List mission links for a card */
  listMissionLinks(cardId: string): CardMissionLink[];

  // ── Default board ────────────────────────────────────────────────────────

  /** Ensure at least one board exists; create defaults if needed */
  ensureDefaultBoard(): KanbanBoard;
}

// ── Audit helper (adapter implementors call this) ───────────────────────────

export function buildKanbanAuditEntry(
  action: KanbanAuditEntry["action"],
  resource: string,
  ok: boolean,
  detail?: string
): KanbanAuditEntry {
  return {
    action,
    resource,
    detail,
    ok,
    timestamp: new Date().toISOString(),
  };
}
