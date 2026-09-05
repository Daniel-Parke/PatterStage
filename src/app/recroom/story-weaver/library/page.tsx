// Story Weaver — Library
// Browse and read your stories
"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, Sparkles, Clock, CheckCircle2, Loader2, BookMarked, Trash2 } from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import ConfirmButton from "@/components/ui/ConfirmButton";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { safeApiCall } from "@/lib/api-fetch";
import { timeAgo } from "@/lib/utils";
import { storyStatusLabel } from "@/modules/rec-room/lib/story-status-labels";
import type { StorySummary } from "@/modules/rec-room/types";

type Filter = "all" | "complete" | "waiting";

export default function LibraryPage() {
  const router = useRouter();
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const fetchStories = useCallback(async () => {
    setLoading(true);
    const res = await safeApiCall<{ data?: { stories?: StorySummary[] } }>("/api/stories", {
      method: "POST",
      body: { action: "list" },
    });
    if (!res.ok) {
      setError(res.error ?? "Failed to load stories");
    } else {
      setError(null);
      setStories(res.data?.data?.stories ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchStories(); }, [fetchStories]);

  // The row's ConfirmButton has already asked; this is the second click.
  const handleDelete = async (id: string) => {
    const res = await safeApiCall("/api/stories", {
      method: "POST",
      body: { action: "delete", storyId: id },
    });
    if (!res.ok) {
      setError(res.error ?? "Failed to delete story");
      return;
    }
    setStories(prev => prev.filter(s => s.id !== id));
  };

  const isComplete = (s: StorySummary) => {
    const total = s.chapters?.length || 0;
    const done = s.chapters?.filter(c => c.status === "complete").length || 0;
    return s.status === "complete" || (total > 0 && done === total);
  };

  const filtered = stories.filter(s => {
    if (filter === "complete") return isComplete(s);
    if (filter === "waiting") return !isComplete(s);
    return true;
  });

  const totalWords = stories.reduce((sum, s) =>
    sum + (s.chapters || []).reduce((ws, c) => ws + (c.wordCount || 0), 0), 0);
  const completedCount = stories.filter(isComplete).length;

  // One vocabulary (decision 13). A story is Completed when every chapter is,
  // whatever its row says; otherwise it reads its own status word.
  const FILTERS: Array<{ id: Filter; label: string }> = [
    { id: "all", label: `All (${stories.length})` },
    { id: "complete", label: `Completed (${completedCount})` },
    { id: "waiting", label: `Waiting for you (${stories.length - completedCount})` },
  ];
  const filterWord = FILTERS.find((f) => f.id === filter)?.label.replace(/ \(\d+\)$/, "") ?? "";

  return (
    <AppPageShell variant="scanlines">
      <PageHeader
        icon={BookMarked}
        title="Library"
        subtitle="Your personal bookshelf"
        color="purple"
        backHref="/recroom/story-weaver"
        backLabel="STORY WEAVER"
      />

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6 flex-1 w-full">
        {error && <LoadErrorBanner error={error} onRetry={fetchStories} />}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Stories", value: stories.length, icon: BookOpen },
            { label: "Completed", value: completedCount, icon: CheckCircle2 },
            { label: "Words", value: totalWords.toLocaleString(), icon: Sparkles },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-white/5 bg-dark-900/30 p-4 text-center">
              <stat.icon className="w-4 h-4 text-neon-purple mx-auto mb-2" />
              <div className="text-2xl font-bold text-ps-text-primary">{stat.value}</div>
              <div className="text-xs font-mono text-ps-text-faint uppercase tracking-wider mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2" role="group" aria-label="Filter stories">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" onClick={() => setFilter(f.id)} aria-pressed={filter === f.id}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                filter === f.id
                  ? "border-neon-purple/40 bg-neon-purple/15 text-neon-purple"
                  : "border-white/8 text-ps-text-muted hover:text-ps-text-muted"
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Stories. The empty state only after a read that succeeded. */}
        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 text-neon-purple animate-spin mx-auto" />
          </div>
        ) : error ? null : filtered.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <h3 className="text-lg font-serif text-ps-text-muted mb-2">
              {filter === "all" ? "Your bookshelf is empty" : `No stories are ${filterWord.toLowerCase()}`}
            </h3>
            <p className="text-sm text-ps-text-faint mb-6">
              {filter === "all"
                ? "Create your first story to start reading."
                : "Stories will appear here once they match this filter."}
            </p>
            {filter === "all" && (
              <button type="button" onClick={() => router.push("/recroom/story-weaver/create")}
                className="px-6 py-3 rounded-xl border border-neon-purple/30 text-sm font-mono text-neon-purple hover:bg-neon-purple/10">
                Create a story
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((story) => {
              const complete = isComplete(story);
              const chapters = story.chapters || [];
              const completeChapters = chapters.filter(c => c.status === "complete").length;
              const totalChapterWords = chapters.reduce((s, c) => s + (c.wordCount || 0), 0);
              const readingTime = Math.max(1, Math.round(totalChapterWords / 250));
              const word = complete ? "Completed" : storyStatusLabel(story.status);

              return (
                <div
                  key={story.id}
                  onClick={() => router.push("/recroom/story-weaver/" + story.id)}
                  className="rounded-xl border border-white/8 bg-dark-900/40 p-5 hover:border-neon-purple/25 hover:bg-dark-900/60 transition-all cursor-pointer group"
                >
                  <div className="flex items-start gap-4">
                    {/* Book spine indicator */}
                    <div className={`w-1.5 h-full min-h-[60px] rounded-full flex-shrink-0 ${
                      complete ? "bg-gradient-to-b from-semantic-success to-emerald-600" : "bg-gradient-to-b from-neon-purple to-neon-purple/50"
                    }`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link href={"/recroom/story-weaver/" + story.id}
                            className="block text-base font-semibold text-ps-text-primary truncate group-hover:text-white transition-colors">
                            {story.title}
                          </Link>
                          <div className="flex items-center gap-3 mt-1 text-xs font-mono text-ps-text-faint">
                            <span>{story.config?.genre || "General"}</span>
                            <span>·</span>
                            <span>{completeChapters}/{chapters.length} chapters</span>
                            <span>·</span>
                            <span>{totalChapterWords.toLocaleString()} words</span>
                            <span>·</span>
                            <Clock className="w-3 h-3" />
                            <span>~{readingTime} min read</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Two clicks, inline, and reachable by keyboard: the
                              old button was opacity-0 until hovered. */}
                          <ConfirmButton
                            variant="ghost"
                            size="sm"
                            aria-label={`Delete story ${story.title}`}
                            title="Delete story"
                            confirmLabel="Delete?"
                            onClick={(e) => e.stopPropagation()}
                            onConfirm={() => handleDelete(story.id)}
                            className="text-ps-text-faint hover:text-red-400 focus-visible:opacity-100 opacity-60 group-hover:opacity-100"
                            armedClassName="opacity-100 text-red-400 bg-red-500/10 ring-1 ring-red-500/30"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </ConfirmButton>
                          <div className={`text-xs font-mono px-2.5 py-1 rounded-full ${
                            complete
                              ? "bg-green-500/10 text-neon-green"
                              : "bg-neon-purple/10 text-neon-purple"
                          }`}>
                            {word}
                          </div>
                        </div>
                      </div>

                      {story.premise && (
                        <p className="text-xs text-ps-text-muted leading-relaxed mt-2 line-clamp-2">
                          {story.premise}
                        </p>
                      )}

                      {/* Chapter progress bar */}
                      {!complete && chapters.length > 0 && (
                        <div className="mt-3">
                          <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-neon-purple to-neon-pink transition-all"
                              style={{ width: `${(completeChapters / chapters.length) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Last updated */}
                      <div className="mt-2 text-xs font-mono text-ps-text-faint">
                        {complete ? "Completed" : "Last updated"} {timeAgo(story.updatedAt || story.createdAt || "")}
                      </div>
                    </div>

                    {/* Read arrow */}
                    <div className="flex-shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <BookOpen className="w-5 h-5 text-neon-purple" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppPageShell>
  );
}
