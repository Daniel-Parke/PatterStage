// ═══════════════════════════════════════════════════════════════════════════════
// kanban-adapter/types.ts — Re-export kanban types for clean public API
//
// All kanban types live in @/types/hermes. This module re-exports them so
// consumers can import from a single well-known path:
//   import type { KanbanBoard, KanbanCard } from "@/lib/kanban-adapter/types";
//
// This indirection keeps the public API stable even if the underlying storage changes.
// ═══════════════════════════════════════════════════════════════════════════════

export type {
  KanbanBoard,
  KanbanColumn,
  KanbanCard,
  KanbanCardStatus,
  KanbanDocument,
  KanbanBoardsResponse,
  KanbanBoardResponse,
  AccentColor,
} from "@/types/hermes";

// ── Card ↔ mission linkage ─────────────────────────────────────────────────────
// This type is specific to the adapter layer (not in hermes.ts).

export interface CardMissionLink {
  id: string;
  cardId: string;
  missionId: string;
  createdAt: string;
}

// ── Audit trail ───────────────────────────────────────────────────────────────

export type KanbanAuditAction =
  | "kanban.board.create"
  | "kanban.board.update"
  | "kanban.board.delete"
  | "kanban.column.add"
  | "kanban.column.update"
  | "kanban.column.delete"
  | "kanban.card.add"
  | "kanban.card.update"
  | "kanban.card.move"
  | "kanban.card.delete"
  | "kanban.card.dispatch";

export interface KanbanAuditEntry {
  action: KanbanAuditAction;
  resource: string;
  detail?: string;
  ok: boolean;
  timestamp: string;
}
