// ═══════════════════════════════════════════════════════════════
// CardDetailModal — Full card editor with goal list and dispatch
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useLayoutEffect } from "react";
import {
  X,
  Trash2,
  Zap,
  Rocket,
  GripVertical,
  ChevronDown,
  ChevronUp,
  User,
} from "lucide-react";
import type {
  KanbanCard,
  KanbanCardStatus,
  GoalSession,
} from "@/types/hermes";
import ProfileSelector from "@/components/ui/ProfileSelector";

interface Props {
  card: KanbanCard | null;
  boardId: string;
  columnId: string;
  goalSession: GoalSession | null;
  open: boolean;
  onClose: () => void;
  onSave: (card: KanbanCard) => void;
  onDispatchMission: (card: KanbanCard) => void;
  onStartGoalLoop: (card: KanbanCard, mode: "sequential" | "parallel", goals: string[]) => void;
  onDeleteCard: (cardId: string) => void;
}

const STATUS_OPTIONS: { value: KanbanCardStatus; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
  { value: "blocked", label: "Blocked" },
];

export default function CardDetailModal({
  card,
  boardId: _boardId,
  columnId: _columnId,
  goalSession,
  open,
  onClose,
  onSave,
  onDispatchMission,
  onStartGoalLoop,
  onDeleteCard,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<KanbanCardStatus>("todo");
  const [assigneeProfileId, setAssigneeProfileId] = useState<string>("");
  const [labels, setLabels] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [newGoal, setNewGoal] = useState("");
  const [goalMode, setGoalMode] = useState<"sequential" | "parallel">("sequential");
  const [saving, setSaving] = useState(false);
  const [goalsExpanded, setGoalsExpanded] = useState(true);

  // Derive form state from card — when card changes (new card selected),
  // useLayoutEffect forces the form to reflect the new card's data immediately.
  useLayoutEffect(() => {
    if (!card) return;
    setTitle(card.title);
    setDescription(card.description);
    setStatus(card.status);
    setAssigneeProfileId(card.assigneeProfileId ?? "");
    setLabels(card.labels);
    setGoals([]);
  }, [card]);

  if (!open || !card) return null;

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);

    const updated: KanbanCard = {
      ...card,
      title: title.trim(),
      description: description.trim(),
      status,
      assigneeProfileId: assigneeProfileId || null,
      labels,
      updatedAt: new Date().toISOString(),
    };

    onSave(updated);
    setSaving(false);
    onClose();
  };

  const handleAddLabel = () => {
    const trimmed = newLabel.trim();
    if (trimmed && !labels.includes(trimmed)) {
      setLabels([...labels, trimmed]);
    }
    setNewLabel("");
  };

  const handleRemoveLabel = (label: string) => {
    setLabels(labels.filter((l) => l !== label));
  };

  const handleAddGoal = () => {
    const trimmed = newGoal.trim();
    if (trimmed) {
      setGoals([...goals, trimmed]);
      setNewGoal("");
    }
  };

  const handleRemoveGoal = (index: number) => {
    setGoals(goals.filter((_, i) => i !== index));
  };

  const handleStartGoalLoop = () => {
    if (goals.length === 0) {
      alert("Add at least one goal first.");
      return;
    }
    onStartGoalLoop(card, goalMode, goals);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 rounded-xl border border-white/10 bg-dark-950 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-neon-purple" />
            Card Details
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/40 hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1.5 uppercase tracking-wider">
              Title
            </label>
            <input
              className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white
                placeholder-white/30 focus:outline-none focus:border-neon-cyan/50 transition-colors"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Card title"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1.5 uppercase tracking-wider">
              Description
            </label>
            <textarea
              className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white
                placeholder-white/30 focus:outline-none focus:border-neon-cyan/50 transition-colors resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What needs to be done?"
              rows={3}
            />
          </div>

          {/* Status + Assignee row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/60 mb-1.5 uppercase tracking-wider">
                Status
              </label>
              <select
                className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white
                  focus:outline-none focus:border-neon-cyan/50 transition-colors appearance-none"
                value={status}
                onChange={(e) => setStatus(e.target.value as KanbanCardStatus)}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/60 mb-1.5 uppercase tracking-wider">
                <User className="w-3 h-3 inline mr-1" />
                Assignee
              </label>
              <ProfileSelector
                value={assigneeProfileId}
                onChange={setAssigneeProfileId}
                placeholder="Unassigned"
              />
            </div>
          </div>

          {/* Labels */}
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1.5 uppercase tracking-wider">
              Labels
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {labels.map((label) => (
                <span
                  key={label}
                  className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/70"
                >
                  {label}
                  <button
                    className="text-white/30 hover:text-white/60 transition-colors"
                    onClick={() => handleRemoveLabel(label)}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 bg-dark-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white
                  placeholder-white/30 focus:outline-none focus:border-neon-cyan/50 transition-colors"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Add label…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddLabel();
                }}
              />
              <button
                className="text-xs px-3 py-1.5 rounded bg-white/10 text-white/60 hover:text-white hover:bg-white/15 transition-colors"
                onClick={handleAddLabel}
              >
                Add
              </button>
            </div>
          </div>

          {/* Goals Section */}
          <div className="border-t border-white/10 pt-4">
            <button
              className="flex items-center justify-between w-full mb-3"
              onClick={() => setGoalsExpanded(!goalsExpanded)}
            >
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-neon-purple" />
                <span className="text-sm font-semibold text-white">
                  Goals
                  {goals.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-white/40">
                      ({goals.length} goal{goals.length !== 1 ? "s" : ""})
                    </span>
                  )}
                </span>
                {goalSession && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-neon-purple/10 text-neon-purple">
                    {goalSession.status}
                  </span>
                )}
              </div>
              {goalsExpanded ? (
                <ChevronUp className="w-4 h-4 text-white/40" />
              ) : (
                <ChevronDown className="w-4 h-4 text-white/40" />
              )}
            </button>

            {goalsExpanded && (
              <div className="space-y-2">
                {/* Existing goals from session */}
                {goalSession?.goals.map((goal, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 p-2 rounded-lg bg-white/5"
                  >
                    <GripVertical className="w-3.5 h-3.5 text-white/20 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/70 leading-snug">{goal}</p>
                      {goalSession.steps[i] && (
                        <span
                          className={`text-[10px] font-mono
                            ${goalSession.steps[i].status === "done" ? "text-neon-green" : ""}
                            ${goalSession.steps[i].status === "in_progress" ? "text-neon-purple" : ""}
                            ${goalSession.steps[i].status === "failed" ? "text-red-400" : ""}
                            ${goalSession.steps[i].status === "pending" ? "text-white/30" : ""}`}
                        >
                          {goalSession.steps[i].status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {/* New goals being added */}
                {goals.map((goal, i) => (
                  <div
                    key={"new-" + i}
                    className="flex items-start gap-2 p-2 rounded-lg bg-neon-purple/5 border border-neon-purple/10"
                  >
                    <GripVertical className="w-3.5 h-3.5 text-neon-purple/40 mt-0.5 flex-shrink-0" />
                    <p className="flex-1 text-sm text-white/70 leading-snug">{goal}</p>
                    <button
                      className="text-white/30 hover:text-red-400 transition-colors flex-shrink-0"
                      onClick={() => handleRemoveGoal(i)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {/* Add new goal */}
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-dark-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white
                      placeholder-white/30 focus:outline-none focus:border-neon-purple/50 transition-colors"
                    value={newGoal}
                    onChange={(e) => setNewGoal(e.target.value)}
                    placeholder="Add a goal…"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddGoal();
                    }}
                  />
                  <button
                    className="text-xs px-3 py-1.5 rounded bg-white/10 text-white/60 hover:text-white hover:bg-white/15 transition-colors"
                    onClick={handleAddGoal}
                  >
                    Add
                  </button>
                </div>

                {/* Goal mode selector */}
                {goals.length > 0 && !goalSession && (
                  <div className="flex items-center gap-3 pt-1">
                    <span className="text-xs text-white/40">Loop mode:</span>
                    <div className="flex gap-1">
                      <button
                        className={`text-xs px-3 py-1 rounded transition-colors ${
                          goalMode === "sequential"
                            ? "bg-neon-purple/20 text-neon-purple border border-neon-purple/30"
                            : "bg-white/5 text-white/40 border border-transparent hover:text-white/60"
                        }`}
                        onClick={() => setGoalMode("sequential")}
                      >
                        Sequential
                      </button>
                      <button
                        className={`text-xs px-3 py-1 rounded transition-colors ${
                          goalMode === "parallel"
                            ? "bg-neon-purple/20 text-neon-purple border border-neon-purple/30"
                            : "bg-white/5 text-white/40 border border-transparent hover:text-white/60"
                        }`}
                        onClick={() => setGoalMode("parallel")}
                      >
                        Parallel
                      </button>
                    </div>
                    <span className="text-[10px] text-white/30">
                      {goalMode === "sequential"
                        ? "One agent per goal in order"
                        : "All goals run simultaneously"}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Active goal session */}
          {goalSession && (
            <div className="border-t border-white/10 pt-4">
              <div className="text-xs text-white/40">
                Active goal loop — {goalSession.goalLoopMode} mode ·{" "}
                {goalSession.steps.filter((s) => s.status === "done").length}/
                {goalSession.steps.length} complete
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-white/10 flex-shrink-0">
          <button
            className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded text-red-400/70
              hover:text-red-400 hover:bg-red-500/10 transition-colors"
            onClick={() => {
              if (confirm("Delete this card?")) {
                onDeleteCard(card.id);
                onClose();
              }
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>

          <div className="flex items-center gap-2">
            {!goalSession && goals.length > 0 && (
              <button
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-neon-purple/30
                  text-neon-purple hover:bg-neon-purple/10 transition-colors"
                onClick={handleStartGoalLoop}
              >
                <Zap className="w-4 h-4" />
                Start Goal Loop
              </button>
            )}
            {card.missionIds.length === 0 && (
              <button
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-neon-cyan/30
                  text-neon-cyan hover:bg-neon-cyan/10 transition-colors"
                onClick={() => onDispatchMission(card)}
              >
                <Rocket className="w-4 h-4" />
                Dispatch
              </button>
            )}
            <button
              className="text-sm px-4 py-1.5 rounded-lg bg-neon-cyan/10 text-neon-cyan
                hover:bg-neon-cyan/20 border border-neon-cyan/20 transition-colors disabled:opacity-50"
              onClick={handleSave}
              disabled={saving || !title.trim()}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
