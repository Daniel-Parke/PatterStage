// ═══════════════════════════════════════════════════════════════
// KanbanColumn — Droppable column with card list and WIP limit
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import KanbanCard from "./KanbanCard";
import type {
  KanbanColumn as KanbanColumnType,
  KanbanCard as KanbanCardType,
  GoalSession,
} from "@/types/hermes";

const ACCENT_GLOW: Record<string, string> = {
  cyan: "border-neon-cyan/30 bg-neon-cyan/5",
  purple: "border-neon-purple/30 bg-neon-purple/5",
  pink: "border-neon-pink/30 bg-neon-pink/5",
  green: "border-neon-green/30 bg-neon-green/5",
  orange: "border-neon-orange/30 bg-neon-orange/5",
};

const COLOR_DOT: Record<string, string> = {
  cyan: "bg-neon-cyan",
  purple: "bg-neon-purple",
  pink: "bg-neon-pink",
  green: "bg-neon-green",
  orange: "bg-neon-orange",
};

interface Props {
  column: KanbanColumnType;
  cards: KanbanCardType[];
  onCardClick: (card: KanbanCardType) => void;
  onCardDelete: (cardId: string) => void;
  onAddCard: (title: string) => void;
  onDeleteColumn: () => void;
  onUpdateColumn: (updates: { title?: string; wipLimit?: number | null }) => void;
  goalSessions?: Record<string, GoalSession>;
}

export default function KanbanColumn({
  column,
  cards,
  onCardClick,
  onCardDelete,
  onAddCard,
  onDeleteColumn,
  onUpdateColumn,
  goalSessions = {},
}: Props) {
  const [addingCard, setAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(column.title);
  const [editingWip, setEditingWip] = useState(false);
  const [wipValue, setWipValue] = useState(column.wipLimit?.toString() ?? "");

  // Sync wipValue when column.wipLimit changes externally
  useEffect(() => {
    setWipValue(column.wipLimit?.toString() ?? "");
  }, [column.wipLimit]);

  const cardCount = cards.length;
  const wipExceeded = column.wipLimit !== null && cardCount > column.wipLimit;

  const handleAddCard = () => {
    if (newCardTitle.trim()) {
      onAddCard(newCardTitle.trim());
      setNewCardTitle("");
      setAddingCard(false);
    }
  };

  const handleTitleSave = () => {
    if (titleValue.trim() && titleValue !== column.title) {
      onUpdateColumn({ title: titleValue.trim() });
    }
    setEditingTitle(false);
  };

  const handleWipSave = () => {
    const val = wipValue.trim();
    const wip = val === "" ? null : parseInt(val, 10);
    if (val !== "" && !isNaN(wip!)) {
      onUpdateColumn({ wipLimit: wip! });
    } else if (val === "") {
      onUpdateColumn({ wipLimit: null });
    }
    setEditingWip(false);
  };

  return (
    <div
      className={`flex flex-col rounded-xl border max-h-[calc(100vh-220px)]
        ${ACCENT_GLOW[column.color] ?? "border-white/10 bg-white/5"}`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 ${COLOR_DOT[column.color] ?? "bg-white/40"}`}
          />

          {editingTitle ? (
            <input
              className="flex-1 bg-transparent text-sm font-semibold text-white border-b border-neon-cyan/50 outline-none px-1 min-w-0"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTitleSave();
                if (e.key === "Escape") setEditingTitle(false);
              }}
              autoFocus
            />
          ) : (
            <button
              className="text-sm font-semibold text-white/80 hover:text-white truncate"
              onClick={() => setEditingTitle(true)}
            >
              {column.title}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {/* WIP indicator */}
          <div
            className={`text-[11px] font-mono px-1.5 py-0.5 rounded cursor-pointer
              ${wipExceeded ? "bg-red-500/20 text-red-400" : "text-white/40 bg-white/5"}`}
            onClick={() => setEditingWip(!editingWip)}
            title="WIP Limit"
          >
            {editingWip ? (
              <input
                className="w-8 bg-transparent outline-none text-center text-white/80"
                value={wipValue}
                onChange={(e) => setWipValue(e.target.value)}
                onBlur={handleWipSave}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleWipSave();
                  if (e.key === "Escape") setEditingWip(false);
                }}
                placeholder="∞"
                autoFocus
              />
            ) : (
              <span>
                {column.wipLimit !== null ? `${cardCount}/${column.wipLimit}` : cardCount}
              </span>
            )}
          </div>

          <button
            className="p-1 rounded text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
            onClick={() => setAddingCard(true)}
            title="Add Card"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <button
            className="p-1 rounded text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            onClick={onDeleteColumn}
            title="Delete Column"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Cards list — scrollable body */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[80px]">
        {cards.length === 0 && !addingCard && (
          <p className="text-xs text-white/20 text-center py-6">No cards</p>
        )}

        {cards.map((card) => (
          <KanbanCard
            key={card.id}
            card={card}
            goalSession={goalSessions[card.id]}
            onClick={() => onCardClick(card)}
            onDelete={() => onCardDelete(card.id)}
          />
        ))}

        {/* Inline add card form */}
        {addingCard && (
          <div className="rounded-lg border border-neon-cyan/30 bg-dark-800/80 p-2">
            <textarea
              className="w-full bg-transparent text-sm text-white resize-none outline-none placeholder-white/30"
              placeholder="Card title…"
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              rows={2}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAddCard();
                }
                if (e.key === "Escape") {
                  setAddingCard(false);
                  setNewCardTitle("");
                }
              }}
            />
            <div className="flex items-center gap-2 mt-1">
              <button
                className="text-xs px-2 py-1 rounded bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 transition-colors"
                onClick={handleAddCard}
              >
                Add
              </button>
              <button
                className="text-xs px-2 py-1 rounded text-white/40 hover:text-white/60 transition-colors"
                onClick={() => {
                  setAddingCard(false);
                  setNewCardTitle("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
