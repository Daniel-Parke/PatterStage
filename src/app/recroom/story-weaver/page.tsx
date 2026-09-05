// Story Weaver — Dashboard
"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Plus, ChevronRight, Sparkles, Library, Users, FileText } from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import StoryCard from "@/modules/rec-room/components/StoryCard";
import { safeApiCall } from "@/lib/api-fetch";
import type { StorySummary } from "@/modules/rec-room/types";

export default function StoryWeaverDashboard() {
  const router = useRouter();
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // The card's ConfirmButton has already asked; this is the second click.
  const handleDelete = async (id: string) => {
    const res = await safeApiCall("/api/stories", {
      method: "POST",
      body: { action: "delete", storyId: id },
    });
    if (!res.ok) setError(res.error ?? "Failed to delete story");
    fetchStories();
  };

  const totalWords = stories.reduce((sum, s) => sum + (s.chapters || []).reduce((ws, c) => ws + (c.wordCount || 0), 0), 0);
  const totalChapters = stories.reduce((sum, s) => sum + (s.chapters || []).length, 0);
  const recent = stories.slice(0, 3);

  return (
    <AppPageShell variant="scanlines">
      <PageHeader
        icon={BookOpen}
        title="Story Weaver"
        subtitle="Collaborative interactive fiction"
        color="purple"
        backHref="/"
        backLabel="HOME"
      />

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8 flex-1 w-full">
        {error && <LoadErrorBanner error={error} onRetry={fetchStories} />}

        {/* Stats, in the one status vocabulary (decision 13): a story is
            Running while a chapter is being written, Waiting for you between
            chapters, Completed when done. */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          {[
            { label: "Stories", value: stories.length },
            { label: "Completed", value: stories.filter(s => s.status === "complete").length },
            { label: "Waiting for you", value: stories.filter(s => s.status === "active").length },
            { label: "Running", value: stories.filter(s => s.status === "generating").length },
            { label: "Chapters", value: totalChapters },
            { label: "Words", value: totalWords.toLocaleString() },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-white/5 bg-dark-900/30 p-4 text-center">
              <div className="text-2xl font-bold text-ps-text-primary">{stat.value}</div>
              <div className="text-xs font-mono text-ps-text-faint uppercase tracking-wider mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <button type="button" onClick={() => router.push("/recroom/story-weaver/create")}
            className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl border border-neon-purple/30 bg-neon-purple/10 text-sm font-mono text-neon-purple hover:bg-neon-purple/20 transition-all shadow-[0_0_20px_rgb(var(--ps-rgb-neon-purple)_/_0.1)]">
            <Plus className="w-4 h-4" /> Create
          </button>
          <button type="button" onClick={() => router.push("/recroom/story-weaver/library")}
            className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl border border-white/10 text-sm font-mono text-ps-text-muted hover:text-ps-text-secondary hover:bg-white/5 transition-all">
            <Library className="w-4 h-4" /> Library
          </button>
          <button type="button" onClick={() => router.push("/recroom/story-weaver/characters")}
            className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl border border-white/10 text-sm font-mono text-ps-text-muted hover:text-ps-text-secondary hover:bg-white/5 transition-all">
            <Users className="w-4 h-4" /> Characters
          </button>
          <button type="button" onClick={() => router.push("/recroom/story-weaver/themes")}
            className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl border border-white/10 text-sm font-mono text-ps-text-muted hover:text-ps-text-secondary hover:bg-white/5 transition-all">
            <FileText className="w-4 h-4" /> Themes
          </button>
        </div>

        {/* Recent Stories */}
        {recent.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-mono text-ps-text-muted uppercase tracking-widest">Recent stories</h2>
              {stories.length > 3 && (
                <button type="button" onClick={() => router.push("/recroom/story-weaver/library")}
                  className="text-xs font-mono text-neon-purple hover:underline flex items-center gap-1">
                  View all <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recent.map((s) => (
                <StoryCard key={s.id} story={s}
                  onRead={(id) => router.push("/recroom/story-weaver/" + id)}
                  onDelete={handleDelete} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state: only after a read that succeeded (the read contract). */}
        {stories.length === 0 && !loading && !error && (
          <div className="text-center py-16">
            <Sparkles className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <h3 className="text-lg font-serif text-ps-text-muted mb-2">Your story awaits</h3>
            <p className="text-sm text-ps-text-faint">Create your first story and let the adventure begin.</p>
          </div>
        )}
      </div>
    </AppPageShell>
  );
}
