// Story Weaver — the library, at the door.
//
// This was a hub: six tiles counted from the stories, four buttons to the
// four other Story Weaver screens, and the three most recent stories. The
// library, one click further in, was three of those tiles, three filters and
// EVERY story - a strict superset of the hub. Decision 6 (T-0126) folds the
// hub into it: the rail's one Story Weaver entry lands here, the counts a
// reader came to the hub for are in the subtitle and on the filters, and the
// only door left is the one to a new story, because Characters and Themes
// are panels on Create now and this list IS the library.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Plus } from "lucide-react";

import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import PageLoading, { pendingCount } from "@/components/ui/PageLoading";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { useApiResource } from "@/hooks/useApiResource";
import { useToast } from "@/components/ui/Toast";
import { runWrite } from "@/lib/api-write";
import StoryCard from "@/modules/rec-room/components/StoryCard";
import type { StorySummary } from "@/modules/rec-room/types";

type Filter = "all" | "complete" | "waiting";

const CREATE = "/recroom/story-weaver/create";

/**
 * One vocabulary (decision 13). A story is Completed when every chapter is,
 * whatever its row says; otherwise it reads its own status word, and it is
 * "waiting for you" in the sense the filter means: not finished.
 */
function isComplete(s: StorySummary): boolean {
  const total = s.chapters?.length || 0;
  const done = s.chapters?.filter((c) => c.status === "complete").length || 0;
  return s.status === "complete" || (total > 0 && done === total);
}

export default function StoryWeaverPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const { showToast, toastElement } = useToast();
  const read = useApiResource<StorySummary[]>("/api/stories", {
    body: { action: "list" },
    select: (d) => (d as { stories?: StorySummary[] } | null)?.stories ?? [],
    errorMessage: "Failed to load stories",
  });
  const stories = read.data ?? [];
  const loaded = read.settled;
  const error = read.error;

  // The row's ConfirmButton has already asked; this is the second click. A
  // refusal is a toast in the server's words, and the shelf is re-read only
  // on a success (C6, T-0143).
  const handleDelete = async (id: string) => {
    await runWrite({
      showToast,
      url: "/api/stories",
      body: { action: "delete", storyId: id },
      successMessage: "Story deleted",
      errorMessage: "Failed to delete story",
      onSuccess: async () => {
        await read.refetch();
      },
    });
  };

  const completed = stories.filter(isComplete).length;
  const words = stories.reduce((sum, s) => sum + (s.chapters || []).reduce((ws, c) => ws + (c.wordCount || 0), 0), 0);
  const known = loaded && !error;

  // What the six tiles said, in one line under the title: a count you can read
  // without a row of boxes above the list it counts. Unknown is an em dash,
  // never a confident zero (the PageLoading contract).
  const subtitle = `${pendingCount(known ? stories.length : null)} ${known && stories.length === 1 ? "story" : "stories"} · ${pendingCount(
    known ? completed : null,
  )} completed · ${known ? words.toLocaleString() : pendingCount(null)} words`;

  const filtered = stories.filter((s) => {
    if (filter === "complete") return isComplete(s);
    if (filter === "waiting") return !isComplete(s);
    return true;
  });

  const FILTERS: ReadonlyArray<{ value: Filter; label: string; count: number }> = [
    { value: "all", label: "All", count: stories.length },
    { value: "complete", label: "Completed", count: completed },
    { value: "waiting", label: "Waiting for you", count: stories.length - completed },
  ];
  const filterWord = FILTERS.find((f) => f.value === filter)?.label.toLowerCase() ?? "";

  const toCreate = () => router.push(CREATE);

  return (
    <AppPageShell
      density="prose"
      variant="scanlines"
      header={
        <PageHeader
          icon={BookOpen}
          title="Story Weaver"
          subtitle={subtitle}
          color="purple"
          actions={
            <Button variant="primary" color="purple" icon={Plus} onClick={toCreate}>
              New story
            </Button>
          }
        />
      }
    >
      <div className="space-y-6">
        {error && <LoadErrorBanner error={error} onRetry={() => void read.refetch()} />}

        <SegmentedControl label="Filter stories" options={FILTERS} value={filter} onChange={setFilter} />

        {/* The list. The header is already drawn above whatever this is, so a
            slow read or a failed one never takes the page with it. The empty
            state only after a read that succeeded (the read contract). */}
        {!loaded ? (
          <PageLoading label="Loading your stories" rows={4} rowClassName="h-28" />
        ) : error ? null : filtered.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={filter === "all" ? "Your bookshelf is empty" : `No stories are ${filterWord}`}
            description={
              filter === "all"
                ? "Create your first story to start reading."
                : "Stories will appear here once they match this filter."
            }
            action={
              filter === "all" ? (
                <Button variant="primary" color="purple" icon={Plus} onClick={toCreate}>
                  Create a story
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul data-testid="story-shelf" className="space-y-3">
            {filtered.map((story) => (
              <li key={story.id}>
                <StoryCard story={story} onRead={(id) => router.push(`/recroom/story-weaver/${id}`)} onDelete={handleDelete} />
              </li>
            ))}
          </ul>
        )}
      </div>
      {toastElement}
    </AppPageShell>
  );
}
