// ═══════════════════════════════════════════════════════════════
// Hindsight Memory Tab — Browse and search stored memories
// ═══════════════════════════════════════════════════════════════

import { Brain, Clock, Tag } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { LoadingSpinner, EmptyState } from "@/components/ui/LoadingSpinner";
import { timeAgo } from "@/lib/utils";
import { parseMemoryContent, hindsightFactTypeBadgeColor } from "./utils";
import type { Memory } from "./types";

interface MemoryTabProps {
  memories: Memory[];
  loading: boolean;
  loadingInitial: boolean;
}

export default function MemoryTab({ memories, loading, loadingInitial }: MemoryTabProps) {
  if (loadingInitial || loading) {
    return <LoadingSpinner text={loading ? "Searching memories..." : "Loading recent memories..."} />;
  }

  if (memories.length === 0) {
    return (
      <EmptyState
        icon={Brain}
        title="No memories yet"
        description="Hermes will start storing them as you converse. You can also add one with Add Memory above."
      />
    );
  }

  return (
    <div className="space-y-3">
      {memories.map((memory, i) => {
        const { text, type, tags } = parseMemoryContent(memory.content);
        return (
          <div
            key={memory.id || i}
            className="rounded-xl border border-white/10 bg-dark-900/50 p-4 hover:border-pink-500/20 transition-colors"
          >
            <p className="text-sm text-white/70 leading-relaxed mb-2">{text}</p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-white/30">
              {type && type !== "unknown" && (
                <Badge color={hindsightFactTypeBadgeColor(type)} size="sm">
                  {type}
                </Badge>
              )}
              {tags.length > 0 &&
                tags.map((tag) => (
                  <Badge key={tag} color="pink" size="sm">
                    {tag}
                  </Badge>
                ))}
              {memory.score !== undefined && (
                <span>
                  {typeof memory.score === "number" && memory.score > 0 && memory.score <= 1
                    ? `Relevance: ${(memory.score * 100).toFixed(0)}%`
                    : `Proof count: ${memory.score}`}
                </span>
              )}
              {memory.created_at && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {timeAgo(memory.created_at)}
                </span>
              )}
              {memory.metadata && Object.keys(memory.metadata).length > 0 && (
                <span className="flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  {Object.keys(memory.metadata).join(", ")}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}