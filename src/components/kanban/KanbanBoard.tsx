// ═══════════════════════════════════════════════════════════════
// KanbanBoard — Full board with columns, cards, and goal sessions
// ═══════════════════════════════════════════════════════════════

"use client";

import { useCallback } from "react";
import KanbanColumn from "./KanbanColumn";
import type {
  KanbanBoard as KanbanBoardType,
  KanbanColumn as KanbanColumnType,
  KanbanCard as KanbanCardType,
  GoalSession,
} from "@/types/hermes";
import { Plus } from "lucide-react";

interface Props {
  board: KanbanBoardType;
  columns: Record<string, KanbanColumnType>;
  cards: Record<string, KanbanCardType>;
  goalSessions?: Record<string, GoalSession>;
  onBoardChange: (
    doc: {
      board: KanbanBoardType;
      columns: Record<string, KanbanColumnType>;
      cards: Record<string, KanbanCardType>;
    }
  ) => void;
  onDispatchMission: (card: KanbanCardType) => void;
  onStartGoalLoop: (card: KanbanCardType) => void;
  teamName?: string;
}

export default function KanbanBoard({
  board,
  columns,
  cards,
  goalSessions = {},
  onBoardChange,
  onDispatchMission: _onDispatchMission,
  onStartGoalLoop,
  teamName,
}: Props) {
  // ── Column actions ───────────────────────────────────────────

  const handleAddColumn = useCallback(() => {
    const title = prompt("Column name:");
    if (!title?.trim()) return;

    const colId =
      "col_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const position = board.columnIds.length;

    const now = new Date().toISOString();

    const newCol: KanbanColumnType = {
      id: colId,
      boardId: board.id,
      title: title.trim(),
      color: "cyan",
      position,
      wipLimit: null,
      cardIds: [],
      createdAt: now,
      updatedAt: now,
    };

    onBoardChange({
      board: { ...board, columnIds: [...board.columnIds, colId], updatedAt: new Date().toISOString() },
      columns: { ...columns, [colId]: newCol },
      cards,
    });
  }, [board, columns, cards, onBoardChange]);

  const handleDeleteColumn = useCallback(
    (columnId: string) => {
      if (!confirm("Delete this column and all its cards?")) return;

      const col = columns[columnId];
      const newCards = { ...cards };
      if (col) {
        for (const cardId of col.cardIds) {
          delete newCards[cardId];
        }
      }

      const newCols = { ...columns };
      delete newCols[columnId];

      onBoardChange({
        board: {
          ...board,
          columnIds: board.columnIds.filter((id) => id !== columnId),
          updatedAt: new Date().toISOString(),
        },
        columns: newCols,
        cards: newCards,
      });
    },
    [board, columns, cards, onBoardChange]
  );

  const handleUpdateColumn = useCallback(
    (columnId: string, updates: { title?: string; wipLimit?: number | null }) => {
      const col = columns[columnId];
      if (!col) return;

      onBoardChange({
        board,
        columns: {
          ...columns,
          [columnId]: { ...col, ...updates },
        },
        cards,
      });
    },
    [board, columns, cards, onBoardChange]
  );

  // ── Card actions ─────────────────────────────────────────────

  const handleAddCard = useCallback(
    (columnId: string, title: string) => {
      const cardId =
        "card_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const now = new Date().toISOString();

      const col = columns[columnId];
      const position = col ? col.cardIds.length : 0;

      const newCard: KanbanCardType = {
        id: cardId,
        title,
        description: "",
        columnId,
        boardId: board.id,
        position,
        status: "todo",
        assigneeProfileId: null,
        goalIndices: [],
        missionIds: [],
        labels: [],
        createdAt: now,
        updatedAt: now,
      };

      const newColCardIds = col ? [...col.cardIds, cardId] : [cardId];

      onBoardChange({
        board,
        columns: {
          ...columns,
          [columnId]: col
            ? { ...col, cardIds: newColCardIds }
            : ({ id: columnId, title: "", color: "cyan", position: 0, wipLimit: null, cardIds: newColCardIds } as KanbanColumnType),
        },
        cards: { ...cards, [cardId]: newCard },
      });
    },
    [board, columns, cards, onBoardChange]
  );

  const handleDeleteCard = useCallback(
    (cardId: string) => {
      const card = cards[cardId];
      if (!card) return;

      const col = columns[card.columnId];
      const newColCardIds = col
        ? col.cardIds.filter((id) => id !== cardId)
        : [];

      const newCards = { ...cards };
      delete newCards[cardId];

      onBoardChange({
        board,
        columns: {
          ...columns,
          ...(col ? { [card.columnId]: { ...col, cardIds: newColCardIds } } : {}),
        },
        cards: newCards,
      });
    },
    [board, columns, cards, onBoardChange]
  );

  // ── Render ───────────────────────────────────────────────────

  const sortedColumns = board.columnIds
    .map((id) => columns[id])
    .filter(Boolean)
    .sort((a, b) => a.position - b.position);

  return (
    <div className="flex flex-col h-full">
      {/* Board header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-white">{board.name}</h2>
          {teamName && (
            <p className="text-xs text-white/40 mt-0.5">{teamName}</p>
          )}
          {board.description && (
            <p className="text-sm text-white/50 mt-1">{board.description}</p>
          )}
        </div>
        <button
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-white/10
            text-white/60 hover:text-white hover:border-white/30 transition-colors"
          onClick={handleAddColumn}
        >
          <Plus className="w-4 h-4" />
          Add Column
        </button>
      </div>

      {/* 3-column responsive grid — no horizontal scroll */}
      <div className="flex-1 overflow-y-auto">
        {sortedColumns.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-white/40 mb-3">No columns yet</p>
              <button
                className="text-sm px-4 py-2 rounded-lg bg-neon-purple/10 text-neon-purple
                  hover:bg-neon-purple/20 border border-neon-purple/20 transition-colors"
                onClick={handleAddColumn}
              >
                Create first column
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
            {sortedColumns.map((col) => {
              const colCards = col.cardIds
                .map((id) => cards[id])
                .filter(Boolean)
                .sort((a, b) => a.position - b.position);

              return (
                <KanbanColumn
                  key={col.id}
                  column={col}
                  cards={colCards}
                  onCardClick={onStartGoalLoop}
                  onCardDelete={handleDeleteCard}
                  onAddCard={(title) => handleAddCard(col.id, title)}
                  onDeleteColumn={() => handleDeleteColumn(col.id)}
                  onUpdateColumn={(updates) => handleUpdateColumn(col.id, updates)}
                  goalSessions={goalSessions}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
