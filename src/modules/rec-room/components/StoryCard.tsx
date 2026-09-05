// StoryCard — Clickable library card for a story
"use client";
import { BookOpen, Trash2 } from "lucide-react";

import ConfirmButton from "@/components/ui/ConfirmButton";
import { timeAgo } from "@/lib/utils";
import { storyStatusLabel } from "@/modules/rec-room/lib/story-status-labels";

interface StoryCardProps {
  story: {
    id: string; title: string; premise?: string; status?: string;
    chapters?: { number: number; title: string; status: string; wordCount?: number }[];
    config?: { genre?: string }; createdAt?: string; updatedAt?: string;
  };
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}

const BADGE_TONE: Record<string, string> = {
  complete: "bg-green-500/10 text-neon-green",
  failed: "bg-red-500/10 text-red-400",
  generating: "bg-orange-500/10 text-orange-400",
};

export default function StoryCard({ story, onRead, onDelete }: StoryCardProps) {
  const totalWords = (story.chapters || []).reduce((sum, c) => sum + (c.wordCount || 0), 0);
  const completeChapters = (story.chapters || []).filter(c => c.status === "complete").length;
  const totalChapters = (story.chapters || []).length;

  return (
    <div
      onClick={() => onRead(story.id)}
      className="rounded-xl border border-neon-purple/15 bg-dark-900/50 p-5 hover:border-neon-purple/30 hover:shadow-[0_0_15px_rgb(var(--ps-rgb-neon-purple)_/_0.06)] transition-all cursor-pointer group flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-ps-text-primary truncate">{story.title}</h3>
          <div className="text-xs font-mono text-ps-text-faint mt-0.5">
            {story.config?.genre || "General"} · {timeAgo(story.updatedAt || story.createdAt || "")}
            {totalChapters > 0 ? ` · ${completeChapters}/${totalChapters} chapters` : ""}
          </div>
        </div>
        {/* The word from the one vocabulary (decision 13), not a bespoke one per card. */}
        <div className={`text-xs font-mono px-2 py-0.5 rounded-full ${BADGE_TONE[story.status ?? ""] ?? "bg-neon-purple/10 text-neon-purple"}`}>
          {storyStatusLabel(story.status)}
        </div>
      </div>
      {story.premise && (
        <p className="text-xs text-ps-text-muted leading-relaxed line-clamp-2 mb-3 flex-1">{story.premise}</p>
      )}
      <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/5">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-ps-text-faint">{totalWords.toLocaleString()} words</span>
          <div className="flex items-center gap-1 text-xs font-mono text-ps-text-muted">
            <BookOpen className="w-3 h-3" /> Read
          </div>
        </div>
        {/* Two clicks, inline, instead of the native confirm the page used to
            raise over this card (T-0096, D51). The click must not reach the
            card, which navigates. */}
        <ConfirmButton
          variant="ghost"
          size="sm"
          aria-label="Delete story"
          title="Delete story"
          confirmLabel="Delete?"
          onClick={(e) => e.stopPropagation()}
          onConfirm={() => onDelete(story.id)}
          className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10"
          armedClassName="text-red-400 bg-red-500/10 ring-1 ring-red-500/30"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </ConfirmButton>
      </div>
    </div>
  );
}
