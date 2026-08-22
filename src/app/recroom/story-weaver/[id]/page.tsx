// Story Weaver — Reader V2 (retry, edit chapter, continue story)
//
// Thin page shell. Story Weaver BEHAVIOUR is out of scope for T-0011 /
// WO-0025, so nothing here changed: the loads, the auto-generate effect
// and its failure ceiling, the retry/edit/continue calls and the
// read-status bookkeeping are all as they were. Only the markup moved,
// into src/modules/rec-room/components/ beside ChapterList and friends.
//
// OVER THE 350 TARGET, and why: all of the markup is out, and what is
// left is the story API calls, that effect and the reader's own state.
// Reshaping any of it would be a behaviour change the programme rules
// out, so the file stops at the presentation boundary, inside the 400
// ceiling, rather than being forced under 350.
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import AppPageShell from "@/components/layout/AppPageShell";
import PageTitle from "@/components/layout/PageTitle";
import { loadSettings, DEFAULT_SETTINGS, FONTS, THEMES, type ReadingSettings } from "@/modules/rec-room/components/ReaderSettings";
import type { Chapter, StoryState } from "@/modules/rec-room/components/story-reader-types";
import { deriveReaderView } from "@/modules/rec-room/components/story-reader-view";
import { ReaderLoading, ReaderNotFound } from "@/modules/rec-room/components/ReaderPlaceholders";
import StoryReaderOverlays from "@/modules/rec-room/components/StoryReaderOverlays";
import ReaderBody from "@/modules/rec-room/components/ReaderBody";

/** Stop auto-generating after this many consecutive failures. */
const MAX_AUTO_FAILURES = 3;

export default function StoryReaderPage() {
  const router = useRouter();
  const params = useParams();
  const storyId = params.id as string;

  const [story, setStory] = useState<StoryState | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentChapter, setCurrentChapter] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bibleOpen, setBibleOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit chapter state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editChapterNum, setEditChapterNum] = useState(0);
  const [editPrompt, setEditPrompt] = useState("");
  const [editing, setEditing] = useState(false);
  const [editDone, setEditDone] = useState(false);
  const [editWordCount, setEditWordCount] = useState("standard");
  const [editCount, setEditCount] = useState(3);

  // Continue story state
  const [continueModalOpen, setContinueModalOpen] = useState(false);
  const [continueDirection, setContinueDirection] = useState("");
  const [continueCount, setContinueCount] = useState(3);
  const [continuing, setContinuing] = useState(false);
  const [continueDone, setContinueDone] = useState(false);
  const [continueWordCount, setContinueWordCount] = useState("standard");

  const contentRef = useRef<HTMLDivElement>(null);
  /** Consecutive auto-generate failures. A ref: bumping it must not re-run the effect. */
  const autoFailuresRef = useRef(0);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setSidebarOpen(true);
    }
  }, []);

  const [settings, setSettings] = useState<ReadingSettings>(DEFAULT_SETTINGS);
  useEffect(() => { setSettings(loadSettings()); }, []);
  const loadStory = useCallback(async () => {
    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "load", storyId }),
      });
      const d = await res.json();
      if (!d.data) return;
      const loaded = d.data as StoryState;
      setStory(loaded);

      // Backfill chapter titles for stories generated before safeArc was fixed.
      // Chapters with placeholder "Chapter N" titles need re-extracting from content.
      const hasPlaceholders = loaded.chapters?.some(
        (c: Chapter) => c.status === "complete" && c.title === `Chapter ${c.number}`
      );
      if (hasPlaceholders) {
        try {
          const syncRes = await fetch("/api/stories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "sync-titles", storyId }),
          });
          const syncData = await syncRes.json();
          if (syncData.data?.story) {
            setStory(syncData.data.story as StoryState);
          }
        } catch { /* non-fatal */ }
      }
    } catch {} finally { setLoading(false); }
  }, [storyId]);

  useEffect(() => { loadStory(); }, [loadStory]);

  const generateNext = useCallback(async () => {
    if (!story) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/stories", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate-chapter", storyId }),
      });
      const d = await res.json();
      if (d.data?.story) {
        autoFailuresRef.current = 0; // progress: re-arm auto-generation
        setStory(d.data.story as StoryState);
      } else if (d.error) {
        autoFailuresRef.current += 1;
        setError(d.error);
      }
    } catch (e) {
      autoFailuresRef.current += 1;
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally { setGenerating(false); }
  }, [story, storyId]);

  /**
   * Auto-generate the next pending chapter.
   *
   * This effect had no failure ceiling. A failed generate returns `{ error }`
   * with NO story, so `story` kept its pending chapter while `generating` flipped
   * back to false — re-firing the effect, calling the LLM again, forever. A
   * server that is down or a model that is rejecting the prompt turned a single
   * click into an unbounded billed retry loop.
   *
   * Consecutive failures are counted in a ref (not state, so incrementing it
   * cannot itself re-trigger the effect). Any successful chapter re-arms it.
   */
  useEffect(() => {
    if (!story || generating) return;
    if (autoFailuresRef.current >= MAX_AUTO_FAILURES) return;
    const firstPending = story.chapters?.find((c: Chapter) => c.status === "pending");
    const anyWriting = story.chapters?.some((c: Chapter) => c.status === "writing");
    if (firstPending && !anyWriting) {
      generateNext();
    }
  }, [story, story?.chapters, generating, generateNext]);

  const autoPaused = autoFailuresRef.current >= MAX_AUTO_FAILURES;

  // Retry a failed chapter
  const retryChapter = useCallback(async (chapterNumber: number) => {
    setError(null);
    // A deliberate retry re-arms auto-generation: the operator has decided the
    // cause is fixed, so the failure ceiling starts again from zero.
    autoFailuresRef.current = 0;
    setGenerating(true);
    try {
      const res = await fetch("/api/stories", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry-chapter", storyId, chapterNumber }),
      });
      const d = await res.json();
      if (d.data?.story) setStory(d.data.story as StoryState);
      else if (d.error) setError(d.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retry failed");
    } finally { setGenerating(false); }
  }, [storyId]);

  // Edit chapter with prompt
  const handleEditChapter = useCallback(async () => {
    if (!editPrompt.trim()) return;
    setEditModalOpen(false);
    setEditing(true);
    setError(null);
    try {
      const res = await fetch("/api/stories", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit-chapter",
          storyId,
          chapterNumber: editChapterNum,
          editPrompt: editPrompt.trim(),
          wordCountRange: editWordCount,
          count: editCount,
        }),
      });
      const d = await res.json();
      if (d.data?.story) {
        setStory(d.data.story as StoryState);
        setEditDone(true);
      } else if (d.error) {
        setError(d.error);
        setEditDone(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Edit failed");
      setEditDone(true);
    }
  }, [storyId, editChapterNum, editPrompt, editWordCount, editCount]);

  // Continue story
  const handleContinue = useCallback(async () => {
    if (!continueDirection.trim()) return;
    setContinueModalOpen(false);
    setContinuing(true);
    setError(null);
    try {
      const res = await fetch("/api/stories", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "continue",
          storyId,
          direction: continueDirection.trim(),
          count: continueCount,
          wordCountRange: continueWordCount,
        }),
      });
      const d = await res.json();
      if (d.data) {
        setStory(d.data as StoryState);
        setContinueDone(true);
      } else if (d.error) {
        setError(d.error);
        setContinueDone(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Continue failed");
      setContinueDone(true);
    }
  }, [storyId, continueDirection, continueCount, continueWordCount]);

  const openEditModal = (chapterNumber: number) => {
    setEditChapterNum(chapterNumber);
    setEditPrompt("");
    setEditModalOpen(true);
  };

  const handleNextChapter = useCallback(async () => {
    if (!story) return;
    const chapters: Chapter[] = story.chapters || [];
    const currentMeta = chapters[currentChapter - 1];
    if (currentMeta?.readStatus !== "read") {
      try {
        const updatedChapters = chapters.map((c: Chapter) =>
          c.number === currentChapter ? { ...c, readStatus: "read" as const } : c
        );
        const updatedStory = { ...story, chapters: updatedChapters };
        setStory(updatedStory);
        await fetch("/api/stories", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update", storyId, chapters: updatedChapters }),
        });
      } catch {}
    }
    const nextComplete = chapters.find((c: Chapter) => c.number > currentChapter && c.status === "complete");
    if (nextComplete) {
      setCurrentChapter(nextComplete.number);
      setTimeout(() => document.getElementById("chapter-top")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      setStory((prev: StoryState | null) => {
        if (!prev) return prev;
        return {
          ...prev,
          chapters: prev.chapters.map((c: Chapter) =>
            c.number === nextComplete.number && !c.readStatus ? { ...c, readStatus: "unread" as const } : c
          ),
        };
      });
    }
  }, [story, currentChapter, storyId]);

  const handleChapterSelect = async (num: number) => {
    setCurrentChapter(num);
    setTimeout(() => document.getElementById("chapter-top")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);

    const updatedChapters = (story?.chapters || []).map((c: Chapter) =>
      c.number === num && c.status === "complete" ? { ...c, readStatus: "read" as const } : c
    );
    setStory((prev: StoryState | null) => {
      if (!prev) return prev;
      return { ...prev, chapters: updatedChapters };
    });
    try {
      await fetch("/api/stories", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", storyId, chapters: updatedChapters }),
      });
    } catch {}
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  // The `|| THEMES.dark` is unreachable through `loadSettings`, which normalises an
  // unsupported stored value (a pre-WO-0005 `sepia` or `light`) back to dark. It
  // stays as the runtime guard for any other path that hands this component a
  // settings object, because a missing theme here would render an unstyled page.
  const theme = THEMES[settings.pageTheme] || THEMES.dark;
  const fontObj = FONTS.find(f => f.name === settings.fontFamily) || FONTS[0];

  const handleContinueComplete = useCallback(() => {
    setContinueModalOpen(false);
    setContinueDirection("");
    setContinuing(false);
    setContinueDone(false);
  }, []);

  const handleEditComplete = useCallback(() => {
    setEditModalOpen(false);
    setEditPrompt("");
    setEditing(false);
    setEditDone(false);
  }, []);

  if (loading) return <ReaderLoading />;

  if (!story) return <ReaderNotFound onBack={() => router.push("/recroom/story-weaver")} />;

  const view = deriveReaderView(story, currentChapter);

  return (
    <AppPageShell variant="scanlines" className="flex flex-col">
      <PageTitle title={story?.title || "Story Weaver"} />
      <StoryReaderOverlays
        story={story}
        error={error}
        autoPaused={autoPaused}
        maxAutoFailures={MAX_AUTO_FAILURES}
        onDismissError={() => setError(null)}
        bibleOpen={bibleOpen}
        onCloseBible={() => setBibleOpen(false)}
        overlayVisible={continuing || editing}
        overlayDone={continueDone || editDone}
        onOverlayComplete={continuing ? handleContinueComplete : handleEditComplete}
        editModalOpen={editModalOpen}
        editChapterNum={editChapterNum}
        editPrompt={editPrompt}
        onEditPromptChange={setEditPrompt}
        editWordCount={editWordCount}
        onEditWordCountChange={setEditWordCount}
        editCount={editCount}
        onEditCountChange={setEditCount}
        onCancelEdit={() => setEditModalOpen(false)}
        onSubmitEdit={handleEditChapter}
        continueModalOpen={continueModalOpen}
        continueDirection={continueDirection}
        onContinueDirectionChange={setContinueDirection}
        continueCount={continueCount}
        onContinueCountChange={setContinueCount}
        continueWordCount={continueWordCount}
        onContinueWordCountChange={setContinueWordCount}
        onCancelContinue={() => setContinueModalOpen(false)}
        onSubmitContinue={handleContinue}
        onRetryFromCreate={() => router.push("/recroom/story-weaver/create")}
      />

      <ReaderBody
        title={story.title}
        view={view}
        currentChapter={currentChapter}
        theme={theme}
        fontFamily={fontObj.family}
        settings={settings}
        onSettingsChange={setSettings}
        sidebarOpen={sidebarOpen}
        contentRef={contentRef}
        onBack={() => router.push("/recroom/story-weaver")}
        onContinue={() => setContinueModalOpen(true)}
        onRetryFailed={() => {
          const failed = view.chapters.find((c: Chapter) => c.status === "failed");
          if (failed) retryChapter(failed.number);
        }}
        onOpenBible={() => setBibleOpen(true)}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onCloseSidebar={() => setSidebarOpen(false)}
        onSelectChapter={handleChapterSelect}
        onEditChapter={openEditModal}
        onRetryChapter={retryChapter}
        onPrev={() => setCurrentChapter(Math.max(1, currentChapter - 1))}
        onNext={handleNextChapter}
      />
    </AppPageShell>
  );
}
