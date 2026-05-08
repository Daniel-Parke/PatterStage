// ═══════════════════════════════════════════════════════════════
// Kanban Page — Multi-Agent Coordination Kanban
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Layout,
  Loader2,
  ChevronRight,
  Bot,
  ArrowLeft,
} from "lucide-react";
import KanbanBoardComponent from "@/components/kanban/KanbanBoard";
import CardDetailModal from "@/components/kanban/CardDetailModal";
import GoalLoopPanel from "@/components/kanban/GoalLoopPanel";
import { useToast } from "@/components/ui/Toast";
import type {
  KanbanBoard,
  KanbanColumn,
  KanbanCard,
  KanbanDocument,
  GoalSession,
} from "@/types/hermes";

// ── API helpers ────────────────────────────────────────────────

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Board Selector ─────────────────────────────────────────────

function BoardSelector({
  boards,
  selectedId,
  onSelect,
  onCreate,
}: {
  boards: KanbanBoard[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors
          ${selectedId === null
            ? "border-neon-purple/50 bg-neon-purple/10 text-neon-purple"
            : "border-white/10 text-white/50 hover:text-white/80 hover:border-white/20"
          }`}
        onClick={() => onSelect("__all__")}
      >
        <Layout className="w-3.5 h-3.5" />
        All Boards
      </button>
      {boards.map((b) => (
        <button
          key={b.id}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors
            ${b.id === selectedId
              ? "border-neon-purple/50 bg-neon-purple/10 text-neon-purple"
              : "border-white/10 text-white/50 hover:text-white/80 hover:border-white/20"
            }`}
          onClick={() => onSelect(b.id)}
        >
          <Layout className="w-3.5 h-3.5" />
          {b.name}
        </button>
      ))}
      <button
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-dashed border-white/20
          text-white/40 hover:text-white/70 hover:border-white/30 transition-colors"
        onClick={onCreate}
      >
        <Plus className="w-3.5 h-3.5" />
        New Board
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function KanbanPage() {
  const router = useRouter();
  const { showToast, toastElement } = useToast();
  const [boards, setBoards] = useState<KanbanBoard[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [doc, setDoc] = useState<KanbanDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Card detail modal
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);
  const [selectedColumnId, setSelectedColumnId] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);

  // Goal sessions (keyed by cardId)
  const [goalSessions, setGoalSessions] = useState<Record<string, GoalSession>>({});
  const [goalPolling, setGoalPolling] = useState(false);

  // ── Load boards on mount ─────────────────────────────────────

  const loadBoards = useCallback(async () => {
    try {
      const data = await apiFetch("/api/kanban");
      setBoards(data.data?.boards ?? []);
      if (!selectedBoardId && (data.data?.boards?.length ?? 0) > 0) {
        setSelectedBoardId(data.data.boards[0].id);
      }
    } catch (e) {
      showToast("Failed to load boards", "error");
    }
  }, [showToast, selectedBoardId]);

  useEffect(() => {
    loadBoards();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load selected board document ─────────────────────────────

  const loadBoardDoc = useCallback(async (boardId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/api/kanban?id=" + boardId);
      if (data.error) throw new Error(data.error);
      setDoc(data.data);

      // Load goal sessions for this board
      const sessionsData = await apiFetch("/api/goals?boardId=" + boardId);
      const sessions: Record<string, GoalSession> = {};
      for (const s of sessionsData.data?.sessions ?? []) {
        sessions[s.cardId] = s;
      }
      setGoalSessions(sessions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load board");
      showToast("Failed to load board", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (selectedBoardId) {
      loadBoardDoc(selectedBoardId);
    }
  }, [selectedBoardId, loadBoardDoc]);

  // ── Poll active goal sessions ─────────────────────────────────

  const pollGoalSessions = useCallback(async () => {
    if (Object.keys(goalSessions).length === 0) return;
    setGoalPolling(true);
    try {
      const updated: Record<string, GoalSession> = {};
      for (const [cardId, session] of Object.entries(goalSessions)) {
        if (session.status !== "active") {
          updated[cardId] = session;
          continue;
        }
        // Check completion for any active step with a mission
        const activeStep = session.steps.find(
          (s) => s.status === "active" && s.missionId
        );
        if (activeStep) {
          try {
            const result = await apiFetch("/api/goals", {
              method: "POST",
              body: JSON.stringify({
                action: "check-completion",
                sessionId: session.id,
                goalIndex: activeStep.index,
              }),
            });
            if (result.data?.session) {
              updated[cardId] = result.data.session;
              continue;
            }
          } catch {
            // Silently continue polling
          }
        }
        updated[cardId] = session;
      }
      setGoalSessions(updated);
    } finally {
      setGoalPolling(false);
    }
  }, [goalSessions]);

  useEffect(() => {
    const interval = setInterval(pollGoalSessions, 15000);
    return () => clearInterval(interval);
  }, [pollGoalSessions]);

  // ── Board change handler (optimistic update + API persist) ───

  const handleBoardChange = useCallback(
    async (newDoc: KanbanDocument) => {
      setDoc(newDoc);

      // Persist the full board state
      try {
        await apiFetch("/api/kanban", {
          method: "POST",
          body: JSON.stringify({
            action: "update-board",
            boardId: newDoc.board.id,
            name: newDoc.board.name,
            description: newDoc.board.description,
            teamId: newDoc.board.teamId,
          }),
        });

        // Sync columns (add any new ones)
        for (const col of Object.values(newDoc.columns)) {
          const existing = doc?.columns[col.id];
          if (!existing) {
            await apiFetch("/api/kanban", {
              method: "POST",
              body: JSON.stringify({
                action: "add-column",
                boardId: newDoc.board.id,
                title: col.title,
                color: col.color,
                wipLimit: col.wipLimit,
              }),
            });
          } else if (existing.title !== col.title || existing.wipLimit !== col.wipLimit) {
            await apiFetch("/api/kanban", {
              method: "POST",
              body: JSON.stringify({
                action: "update-column",
                boardId: newDoc.board.id,
                columnId: col.id,
                title: col.title,
                wipLimit: col.wipLimit,
              }),
            });
          }
        }

        // Sync cards
        for (const card of Object.values(newDoc.cards)) {
          const existing = doc?.cards[card.id];
          if (!existing) {
            await apiFetch("/api/kanban", {
              method: "POST",
              body: JSON.stringify({
                action: "add-card",
                boardId: newDoc.board.id,
                columnId: card.columnId,
                title: card.title,
                description: card.description,
                assigneeProfileId: card.assigneeProfileId,
                labels: card.labels,
              }),
            });
          } else if (
            existing.title !== card.title ||
            existing.description !== card.description ||
            existing.status !== card.status ||
            existing.assigneeProfileId !== card.assigneeProfileId
          ) {
            await apiFetch("/api/kanban", {
              method: "POST",
              body: JSON.stringify({
                action: "update-card",
                boardId: newDoc.board.id,
                cardId: card.id,
                title: card.title,
                description: card.description,
                status: card.status,
                assigneeProfileId: card.assigneeProfileId,
                labels: card.labels,
              }),
            });
          }
        }
      } catch (e) {
        showToast("Failed to save board changes", "error");
        // Reload to recover
        if (selectedBoardId) loadBoardDoc(selectedBoardId);
      }
    },
    [doc, selectedBoardId, loadBoardDoc, showToast]
  );

  // ── Create Board ─────────────────────────────────────────────

  const handleCreateBoard = useCallback(async () => {
    const name = prompt("Board name:");
    if (!name?.trim()) return;

    try {
      const res = await apiFetch("/api/kanban", {
        method: "POST",
        body: JSON.stringify({
          action: "create-board",
          name: name.trim(),
          description: "",
          teamId: "",
        }),
      });

      const newBoard = res.data?.board as KanbanBoard;
      if (newBoard?.id) {
        await loadBoards();
        setSelectedBoardId(newBoard.id);
        showToast(`Board "${newBoard.name}" created`, "success");
      }
    } catch (e) {
      showToast("Failed to create board", "error");
    }
  }, [loadBoards, showToast]);

  // ── Card Modal ───────────────────────────────────────────────

  const handleCardClick = useCallback((card: KanbanCard) => {
    setSelectedCard(card);
    setSelectedColumnId(card.columnId);
    setModalOpen(true);
  }, []);

  const handleSaveCard = useCallback(
    async (card: KanbanCard) => {
      if (!doc) return;
      const newCards = { ...doc.cards, [card.id]: card };
      const newDoc = { ...doc, cards: newCards };
      await handleBoardChange(newDoc);

      // Persist via API
      try {
        await apiFetch("/api/kanban", {
          method: "POST",
          body: JSON.stringify({
            action: "update-card",
            boardId: card.boardId,
            cardId: card.id,
            title: card.title,
            description: card.description,
            status: card.status,
            assigneeProfileId: card.assigneeProfileId,
            labels: card.labels,
          }),
        });
      } catch {
        showToast("Failed to save card", "error");
      }
    },
    [doc, handleBoardChange, showToast]
  );

  const handleDeleteCard = useCallback(
    async (cardId: string) => {
      if (!doc) return;
      if (!confirm("Delete this card?")) return;

      const card = doc.cards[cardId];
      if (!card) return;

      // Optimistic update
      const newCards = { ...doc.cards };
      delete newCards[cardId];
      const newColCardIds = (doc.columns[card.columnId]?.cardIds ?? []).filter(
        (id) => id !== cardId
      );
      const newDoc = {
        ...doc,
        cards: newCards,
        columns: {
          ...doc.columns,
          [card.columnId]: { ...doc.columns[card.columnId], cardIds: newColCardIds },
        },
      };
      setDoc(newDoc);

      try {
        await apiFetch("/api/kanban", {
          method: "POST",
          body: JSON.stringify({
            action: "delete-card",
            boardId: card.boardId,
            cardId,
          }),
        });
        showToast("Card deleted", "success");
      } catch {
        showToast("Failed to delete card", "error");
        if (selectedBoardId) loadBoardDoc(selectedBoardId);
      }
    },
    [doc, selectedBoardId, loadBoardDoc, showToast]
  );

  // ── Dispatch Mission ──────────────────────────────────────────

  const handleDispatchMission = useCallback(
    async (card: KanbanCard) => {
      setModalOpen(false);
      showToast("Redirecting to dispatch mission…", "info");
      setTimeout(() => {
        router.push(
          `/missions?template=new&name=${encodeURIComponent(card.title)}&context=${encodeURIComponent(card.description)}`
        );
      }, 1000);
    },
    [router, showToast]
  );

  // ── Start Goal Loop ───────────────────────────────────────────

  const handleStartGoalLoop = useCallback(
    async (card: KanbanCard, mode: "sequential" | "parallel", goals: string[]) => {
      if (!goals.length) return;

      try {
        const res = await apiFetch("/api/goals", {
          method: "POST",
          body: JSON.stringify({
            action: "start",
            boardId: card.boardId,
            cardId: card.id,
            goalLoopMode: mode,
            goals,
            assignedProfileId: card.assigneeProfileId,
          }),
        });

        const session = res.data?.session as GoalSession;
        if (session?.id) {
          setGoalSessions((prev) => ({ ...prev, [card.id]: session }));
          showToast(
            `Goal loop started (${goals.length} goal${goals.length !== 1 ? "s" : ""}, ${mode})`,
            "success"
          );
          setModalOpen(false);
        }
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Failed to start goal loop", "error");
      }
    },
    [showToast]
  );

  // ── Goal session controls ────────────────────────────────────

  const handlePauseSession = useCallback(
    async (sessionId: string) => {
      try {
        const res = await apiFetch("/api/goals", {
          method: "POST",
          body: JSON.stringify({ action: "pause", sessionId }),
        });
        const updated = res.data?.session as GoalSession;
        if (updated?.cardId) {
          setGoalSessions((prev) => ({ ...prev, [updated.cardId]: updated }));
        }
      } catch {
        showToast("Failed to pause goal loop", "error");
      }
    },
    [showToast]
  );

  const handleResumeSession = useCallback(
    async (sessionId: string) => {
      try {
        const res = await apiFetch("/api/goals", {
          method: "POST",
          body: JSON.stringify({ action: "resume", sessionId }),
        });
        const updated = res.data?.session as GoalSession;
        if (updated?.cardId) {
          setGoalSessions((prev) => ({ ...prev, [updated.cardId]: updated }));
        }
      } catch {
        showToast("Failed to resume goal loop", "error");
      }
    },
    [showToast]
  );

  const handleCancelSession = useCallback(
    async (sessionId: string) => {
      if (!confirm("Cancel this goal loop?")) return;
      try {
        const res = await apiFetch("/api/goals", {
          method: "POST",
          body: JSON.stringify({ action: "cancel", sessionId }),
        });
        const updated = res.data?.session as GoalSession;
        if (updated?.cardId) {
          setGoalSessions((prev) => {
            const next = { ...prev };
            delete next[updated.cardId];
            return next;
          });
        }
        showToast("Goal loop cancelled", "success");
      } catch {
        showToast("Failed to cancel goal loop", "error");
      }
    },
    [showToast]
  );

  const handleCheckCompletion = useCallback(
    async (sessionId: string, goalIndex: number) => {
      try {
        const res = await apiFetch("/api/goals", {
          method: "POST",
          body: JSON.stringify({ action: "check-completion", sessionId, goalIndex }),
        });
        const updated = res.data?.session as GoalSession;
        if (updated?.cardId) {
          setGoalSessions((prev) => ({ ...prev, [updated.cardId]: updated }));
        }
      } catch {
        showToast("Failed to check completion", "error");
      }
    },
    [showToast]
  );

  // ── Active goal session panel (for the selected card) ─────────

  const activeGoalSession = selectedCard ? goalSessions[selectedCard.id] : null;

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="pl-64 flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-white/30 hover:text-white/60 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Bot className="w-6 h-6 text-neon-purple" />
              Kanban
            </h1>
            <p className="text-xs text-white/40 mt-0.5">
              Multi-Agent Coordination Board
            </p>
          </div>
        </div>

        {/* Board selector */}
        <div className="flex items-center gap-2">
          <BoardSelector
            boards={boards}
            selectedId={selectedBoardId}
            onSelect={setSelectedBoardId}
            onCreate={handleCreateBoard}
          />
          <Link
            href="/kanban/teams"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border
              border-white/10 text-white/50 hover:text-white/80 hover:border-white/20 transition-colors ml-4"
          >
            <Bot className="w-3.5 h-3.5" />
            Teams
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-neon-purple animate-spin" />
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-400 mb-3">{error}</p>
            <button
              className="text-sm px-4 py-2 rounded-lg bg-white/10 text-white/70 hover:text-white transition-colors"
              onClick={() => selectedBoardId && loadBoardDoc(selectedBoardId)}
            >
              Retry
            </button>
          </div>
        </div>
      ) : doc ? (
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Board */}
          <div className="flex-1 min-w-0">
            <KanbanBoardComponent
              board={doc.board}
              columns={doc.columns}
              cards={doc.cards}
              goalSessions={goalSessions}
              onBoardChange={handleBoardChange}
              onDispatchMission={handleDispatchMission}
              onStartGoalLoop={(card) => {
                handleCardClick(card);
              }}
            />
          </div>

          {/* Goal Loop Sidebar (when a card with active session is selected) */}
          {activeGoalSession && (
            <div className="w-80 flex-shrink-0 overflow-y-auto">
              <div className="sticky top-0">
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                  Goal Loop
                </p>
                <GoalLoopPanel
                  session={activeGoalSession}
                  onPause={() => handlePauseSession(activeGoalSession.id)}
                  onResume={() => handleResumeSession(activeGoalSession.id)}
                  onCancel={() => handleCancelSession(activeGoalSession.id)}
                  onCheckCompletion={(idx) =>
                    handleCheckCompletion(activeGoalSession.id, idx)
                  }
                  polling={goalPolling}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Layout className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/50 mb-4">No board selected</p>
            <button
              className="text-sm px-4 py-2 rounded-lg bg-neon-purple/10 text-neon-purple
                hover:bg-neon-purple/20 border border-neon-purple/20 transition-colors"
              onClick={handleCreateBoard}
            >
              Create your first board
            </button>
          </div>
        </div>
      )}

      {/* Card Detail Modal */}
      {selectedCard && doc && (
        <CardDetailModal
          card={selectedCard}
          boardId={doc.board.id}
          columnId={selectedColumnId}
          goalSession={goalSessions[selectedCard.id] ?? null}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSave={handleSaveCard}
          onDispatchMission={handleDispatchMission}
          onStartGoalLoop={handleStartGoalLoop}
          onDeleteCard={handleDeleteCard}
        />
      )}

      {toastElement}
    </div>
  );
}
