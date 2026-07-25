// Story Weaver — Library
// Browse and read your stories
"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, Sparkles, Clock, CheckCircle2, Loader2, BookMarked, Trash2 } from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import { timeAgo } from "@/lib/utils";
import type { StorySummary } from "@/modules/rec-room/types";

export default function LibraryPage() {
  const router = useRouter();
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "complete" | "in-progress">("all");

  const fetchStories = useCallback(async () => {
    try {
      const res = await fetch("/api/stories", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      });
      const d = await res.json();
      setStories(d.data?.stories || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStories(); }, [fetchStories]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this story?")) return;
    try {
      await fetch("/api/stories", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", storyId: id }),
      });
      setStories(prev => prev.filter(s => s.id !== id));
    } catch {}
  };

  const isComplete = (s: StorySummary) => {
    const total = s.chapters?.length || 0;
    const done = s.chapters?.filter(c => c.status === "complete").length || 0;
    return s.status === "complete" || (total > 0 && done === total);
  };

  const filtered = stories.filter(s => {
    if (filter === "complete") return isComplete(s);
    if (filter === "in-progress") return !isComplete(s);
    return true;
  });

  const totalWords = stories.reduce((sum, s) =>
    sum + (s.chapters || []).reduce((ws, c) => ws + (c.wordCount || 0), 0), 0);
  const completedCount = stories.filter(isComplete).length;

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
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Stories", value: stories.length, icon: BookOpen },
            { label: "Completed", value: completedCount, icon: CheckCircle2 },
            { label: "Words Written", value: totalWords.toLocaleString(), icon: Sparkles },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-white/5 bg-dark-900/30 p-4 text-center">
              <stat.icon className="w-4 h-4 text-neon-purple/50 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white/80">{stat.value}</div>
              <div className="text-[10px] font-mono text-white/25 uppercase tracking-wider mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {[
            { id: "all" as const, label: `All (${stories.length})` },
            { id: "complete" as const, label: `Completed (${completedCount})` },
            { id: "in-progress" as const, label: `In Progress (${stories.length - completedCount})` },
          ].map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                filter === f.id
                  ? "border-neon-purple/40 bg-neon-purple/15 text-neon-purple"
                  : "border-white/8 text-white/30 hover:text-white/50"
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Stories */}
        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 text-neon-purple animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <h3 className="text-lg font-serif text-white/50 mb-2">
              {filter === "all" ? "Your bookshelf is empty" : `No ${filter} stories`}
            </h3>
            <p className="text-sm text-white/25 mb-6">
              {filter === "all"
                ? "Create your first story to start reading."
                : "Stories will appear here once they match this filter."}
            </p>
            {filter === "all" && (
              <button onClick={() => router.push("/recroom/story-weaver/create")}
                className="px-6 py-3 rounded-xl border border-neon-purple/30 text-sm font-mono text-neon-purple hover:bg-neon-purple/10">
                Create a Story
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
                            className="block text-base font-semibold text-white/90 truncate group-hover:text-white transition-colors">
                            {story.title}
                          </Link>
                          <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-white/25">
                            <span>{story.config?.genre || "General"}</span>
                            <span>·</span>
                            <span>{chapters.length} chapters</span>
                            <span>·</span>
                            <span>{totalChapterWords.toLocaleString()} words</span>
                            <span>·</span>
                            <Clock className="w-3 h-3" />
                            <span>~{readingTime} min read</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(story.id); }}
                            className="p-1 text-white/10 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete story">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <div className={`text-[9px] font-mono px-2.5 py-1 rounded-full ${
                          complete
                            ? "bg-green-500/10 text-neon-green"
                            : "bg-neon-purple/10 text-neon-purple"
                        }`}>
                          {complete ? "Complete" : `${completeChapters}/${chapters.length}`}
                        </div>
                        </div>
                      </div>

                      {story.premise && (
                        <p className="text-xs text-white/30 leading-relaxed mt-2 line-clamp-2">
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
                      <div className="mt-2 text-[9px] font-mono text-white/15">
                        {complete ? "Finished" : "Last updated"} {timeAgo(story.updatedAt || story.createdAt || "")}
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
