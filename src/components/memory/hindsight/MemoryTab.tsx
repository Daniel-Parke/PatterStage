// ═══════════════════════════════════════════════════════════════
// Hindsight Memory Tab — Browse and search stored memories
// ═══════════════════════════════════════════════════════════════
//
// Memories are consumed directly from the mapped payload produced by
// `mapMemoryItem` in `@/lib/memory/hindsight-bridge` — the API route returns
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
  /** The query whose results are on screen, when the list came from a Recall. */
  activeQuery?: string | null;
  /** Drop the query and go back to the recent list. */
  onClearQuery?: () => void;
  /** No memory provider answered, so there is no store to be empty. */
  unreachable?: boolean;
}

export default function MemoryTab({
  memories,
  loading,
  loadingInitial,
  showStaleToggle,
  activeQuery = null,
  onClearQuery,
  unreachable = false,
}: MemoryTabProps) {
  if (loadingInitial || loading) {
    return <LoadingSpinner text={loading ? "Searching memories..." : "Loading recent memories..."} />;
  }

  // An empty list means one of four things, and the page used to say the same
  // one for all of them: a fresh install's sentence, printed over a store that
  // nothing is answering for, or one whose facts are all older than the age
  // filter, or a search that simply missed (T-0101, D61 and D62).
  const emptyState = () => {
    if (unreachable) {
      return (
        <EmptyState
          icon={Brain}
          title="Memory is not connected"
          description="Nothing answered at the endpoint above. Check the host and port on the card at the top of this page, then test the connection."
        />
      );
    }
    if (activeQuery) {
      return (
        <div className="space-y-3">
          <EmptyState
            icon={Brain}
            title={`No memories matched "${activeQuery}"`}
            description="The store may still hold plenty; this search found none of it. Try fewer words, or clear the search to see what was stored recently."
          />
          {onClearQuery && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={onClearQuery}
                className="px-3 py-1.5 rounded-lg border border-pink-500/30 text-xs font-mono text-pink-300 transition-colors hover:bg-pink-500/10"
              >
                Clear search
              </button>
            </div>
          )}
        </div>
      );
    }
    if (showStaleToggle && showStaleToggle.hiddenCount > 0) {
      return (
        <EmptyState
          icon={Clock}
          title={`Every memory is older than ${showStaleToggle.thresholdDays} days`}
          description={`${showStaleToggle.hiddenCount} ${showStaleToggle.hiddenCount === 1 ? "fact is" : "facts are"} hidden by the age filter. Show them with the button above.`}
        />
      );
    }
    return (
      <EmptyState
        icon={Brain}
        title="No memories yet"
        description="Hermes will start storing them as you converse. You can also add one with Add Memory above."
      />
    );
  };

  return (
    <div className="space-y-3">
      {/* Above the empty branch, not inside the list: the button that reveals
          the hidden facts used to be unreachable on exactly the store that
          needed it (T-0101, D61). It appears only when it has something to
          say: "Hiding 0 memories" on an empty store is noise, and it is not
          even true (found on the proof walk). */}
      {showStaleToggle && (showStaleToggle.hiddenCount > 0 || showStaleToggle.showStale) && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 rounded-lg border border-white/10 bg-dark-900/30 text-xs text-ps-text-secondary">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-ps-text-muted" />
            <span>
              {showStaleToggle.showStale
                ? <>Showing <span className="text-ps-text-primary font-medium">all</span> memories (stale filter off).</>
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
      {memories.length === 0 && emptyState()}
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
            <p className="text-sm text-ps-text-secondary leading-relaxed mb-2">{text}</p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-ps-text-muted">
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
              {/* A proof count, called what it is. It used to be mapped into a
                  field called `score` and rendered as a percentage whenever it
                  was 1, which is the commonest fact there is: a fabricated
                  confidence figure on most of the store (T-0101, D63). */}
              {typeof memory.proofCount === "number" && memory.proofCount > 0 && (
                <span>Proof count: {memory.proofCount}</span>
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