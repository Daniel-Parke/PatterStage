// ═══════════════════════════════════════════════════════════════
// Hindsight Memory Tab — Browse and search stored memories
// ═══════════════════════════════════════════════════════════════
//
// Memories are consumed directly from the mapped payload produced by
// `mapMemoryItem` in `@/lib/hindsight-bridge` — the API route returns
// `{ content, type, tags, created_at, score, ... }` as plain JSON
// fields, not a Python `repr()` string. The old `parseMemoryContent`
// regex parser is no longer used and has been removed.

import { Brain, Clock, Tag } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { LoadingSpinner, EmptyState } from "@/components/ui/LoadingSpinner";
import { timeAgo } from "@/lib/utils";
import { hindsightFactTypeBadgeColor } from "./utils";
import type { Memory } from "./types";

interface MemoryTabProps {
  memories: Memory[];
  loading: boolean;
  loadingInitial: boolean;
  /**
   * Optional stale-fact filter toggle. When provided, a small banner
   * is rendered above the list showing the threshold and the number
   * of facts currently hidden. The user can click to toggle whether
   * the filter is on. When omitted, no filter UI is shown and the
   * caller is responsible for any filtering.
   */
  showStaleToggle?: {
    showStale: boolean;
    onToggle: () => void;
    hiddenCount: number;
    thresholdDays: number;
  };
}

export default function MemoryTab({ memories, loading, loadingInitial, showStaleToggle }: MemoryTabProps) {
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
      {showStaleToggle && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 rounded-lg border border-white/10 bg-dark-900/30 text-xs text-white/60">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-white/40" />
            <span>
              {showStaleToggle.showStale
                ? <>Showing <span className="text-white/80 font-medium">all</span> memories (stale filter off).</>
                : <>Hiding {showStaleToggle.hiddenCount} {showStaleToggle.hiddenCount === 1 ? "memory" : "memories"} older than {showStaleToggle.thresholdDays} days.</>
              }
            </span>
          </div>
          <button
            type="button"
            onClick={showStaleToggle.onToggle}
            className="px-2.5 py-1 rounded border border-pink-500/30 text-pink-300 hover:bg-pink-500/10 transition-colors"
            title={showStaleToggle.showStale ? "Hide stale memories" : "Show all memories including stale ones"}
          >
            {showStaleToggle.showStale ? "Hide stale" : "Show stale"}
          </button>
        </div>
      )}
      {memories.map((memory, i) => {
        const text = memory.content ?? "";
        const type = memory.type ?? "";
        // Memory.tags is typed as `unknown` on the Memory interface (the
        // mapped payload from hindsight-bridge keeps the raw value). The
        // direct-HTTP bridge always returns string[], but defend against
        // any other shape so a future payload change can't blow up the
        // page render.
        const rawTags = memory.tags as unknown;
        const tags: string[] = Array.isArray(rawTags)
          ? rawTags.filter((t): t is string => typeof t === "string")
          : [];
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