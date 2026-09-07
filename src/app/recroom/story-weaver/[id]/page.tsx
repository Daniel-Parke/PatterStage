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
import { loadSettings, DEFAULT_SETTINGS, FONTS, type ReadingSettings } from "@/modules/rec-room/components/ReaderSettings";
import type { Chapter, StoryState } from "@/modules/rec-room/components/story-reader-types";
import { deriveReaderView } from "@/modules/rec-room/components/story-reader-view";
import { ReaderLoading, ReaderNotFound } from "@/modules/rec-room/components/ReaderPlaceholders";
import StoryReaderOverlays from "@/modules/rec-room/components/StoryReaderOverlays";
import ReaderBody from "@/modules/rec-room/components/ReaderBody";
import type { SpendWindowSource } from "@/lib/spend/spend-window";

/** Stop auto-generating after this many consecutive failures. */
const MAX_AUTO_FAILURES = 3;

export default function StoryReaderPage() {
  const router = useRouter();
  const params = useParams();
  const storyId = params.id as string;

  const [story, setStory] = useState<StoryState | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentChapter, setCurrentChapter] = useState(1);
  /**
   * How many billed calls are on the wire.
   *
   * A COUNT, not a boolean. Retry renders beside Stop with nothing disabling
   * it, so a generate and a retry run together perfectly legally, and one
   * shared boolean meant the first to settle ran `false` and took Stop away
   * from the other while it was still running and still billing.
   */
  const [inFlight, setInFlight] = useState(0);
  const generating = inFlight > 0;
  const callStarted = useCallback(() => setInFlight((n) => n + 1), []);
  const callSettled = useCallback(() => setInFlight((n) => Math.max(0, n - 1)), []);
  /** The operator's standing intent to keep writing. NEVER true on mount. */
  const [writing, setWriting] = useState(false);
  /**
   * Every generation currently on the wire, so Stop can pull all of them.
   *
   * This was a single slot, and a single slot is only correct while exactly one
   * call can be in flight. Two can: the Retry control stays live while a chapter
   * is generating, and the second call overwrote the slot, leaving the first one
   * running and billing with nothing left holding its controller.
   */
  const inFlightRef = useRef<Set<AbortController>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bibleOpen, setBibleOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** What this story has cost so far. Null while unknown, never assumed zero. */
  const [spend, setSpend] = useState<SpendWindowSource | null>(null);

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

  const loadSpend = useCallback(async () => {
    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "spend", storyId }),
      });
      const d = await res.json();
      setSpend((d.data?.spend as SpendWindowSource | undefined) ?? null);
    } catch {
      // A figure that will not load must not take the story down with it. The
      // note hides itself rather than drawing a zero nothing measured.
      setSpend(null);
    }
  }, [storyId]);

  // Re-read the figure whenever a paid operation settles, not just on mount.
  // A cost read once is a cost that is always one chapter out of date, and out
  // of date is the number the operator would act on.
  useEffect(() => {
    if (generating || editing || continuing) return;
    void loadSpend();
  }, [generating, editing, continuing, loadSpend]);

  const generateNext = useCallback(async () => {
    if (!story) return;
    const controller = new AbortController();
    inFlightRef.current.add(controller);
    callStarted();
    setError(null);
    try {
      const res = await fetch("/api/stories", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate-chapter", storyId }),
        signal: controller.signal,
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
      // A Stop is not a failure, and does not count toward the ceiling.
      if (e instanceof Error && e.name === "AbortError") {
        setWriting(false);
        // Re-read, because a Stop leaves the SERVER holding the truth and this
        // screen holding what it had before. An abort that lands after the
        // provider answered still writes and bills the chapter (the title and
        // summary calls are both caught server-side), and the write action
        // names no chapter: it writes the first PENDING one. Offering "Write
        // chapter 3" from a stale screen is therefore how the operator pays for
        // chapter 4 (T-0113).
        void loadStory();
        return;
      }
      autoFailuresRef.current += 1;
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      inFlightRef.current.delete(controller);
      callSettled();
    }
  }, [story, storyId, loadStory, callStarted, callSettled]);

  /** Write exactly the next pending chapter, once. Does not arm the loop. */
  const writeNextChapter = useCallback(() => { void generateNext(); }, [generateNext]);
  /** Arm the loop: write chapters until none are pending or Stop is pressed. */
  const keepWriting = useCallback(() => {
    // Arming the loop is a fresh decision, so the failure ceiling starts again
    // from zero. Without this, arming it after a pause would be a dead control:
    // the effect would decline to call and disarm itself, silently.
    autoFailuresRef.current = 0;
    setWriting(true);
  }, []);
  /** Stop before the next call, and abort every call already on the wire. */
  const stopWriting = useCallback(() => {
    setWriting(false);
    // Each call removes its own controller when it settles, so this is only
    // ever the set of generations still running. Aborting all of them is the
    // point: Stop has to mean stopped on every path that bills, not just the
    // most recent one.
    inFlightRef.current.forEach((controller) => controller.abort());
  }, []);

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
    // Nothing is written unless the operator asked for it. This effect used to
    // fire on mount, so opening a half-finished story to re-read it billed a
    // chapter (T-0108, D88).
    if (!writing) return;
    // A call is on the wire. The run is still live, so the intent stands.
    if (!story || generating) return;
    const firstPending = story.chapters?.find((c: Chapter) => c.status === "pending");
    const anyWriting = story.chapters?.some((c: Chapter) => c.status === "writing");
    if (firstPending && !anyWriting && autoFailuresRef.current < MAX_AUTO_FAILURES) {
      generateNext();
      return;
    }
    // The run this intent authorised is over: everything is written, or the
    // ceiling has paused it. Clear the intent HERE, because this effect is the
    // only thing that carries the loop forward. Leaving it set was a money bug:
    // the flag outlived its run, and the next thing to put a pending chapter
    // back in front of the effect resumed billed writing nobody asked for. A
    // Retry does exactly that, and the paused banner tells the operator to
    // press it.
    setWriting(false);
  }, [writing, story, story?.chapters, generating, generateNext]);

  const autoPaused = autoFailuresRef.current >= MAX_AUTO_FAILURES;

  // Retry a failed chapter
  const retryChapter = useCallback(async (chapterNumber: number) => {
    setError(null);
    // A deliberate retry clears the failure ceiling: the operator has decided
    // the cause is fixed. It writes ONE chapter and does not arm the loop.
    autoFailuresRef.current = 0;
    // A retry is billed generation like any other, so it goes on the wire with
    // a signal Stop can pull. It had none, and the header shows Stop while a
    // retry runs, so pressing it aborted nothing and the operator watched the
    // call run to completion. The server already honours the signal: /api/stories
    // hands request.signal to the provider call for retry-chapter.
    const controller = new AbortController();
    inFlightRef.current.add(controller);
    callStarted();
    try {
      const res = await fetch("/api/stories", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry-chapter", storyId, chapterNumber }),
        signal: controller.signal,
      });
      const d = await res.json();
      if (d.data?.story) setStory(d.data.story as StoryState);
      else if (d.error) setError(d.error);
    } catch (e) {
      // A Stop is not a failure. It gives the controls back rather than raising
      // an error the operator must read. What it must NOT do is assume the
      // chapter is as this screen last saw it: the retry reset it to pending
      // server-side before calling the provider, and only a re-read says which
      // of the two the server settled on.
      if (e instanceof Error && e.name === "AbortError") {
        void loadStory();
        return;
      }
      setError(e instanceof Error ? e.message : "Retry failed");
    } finally {
      inFlightRef.current.delete(controller);
      callSettled();
    }
  }, [storyId, loadStory, callStarted, callSettled]);

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
    <AppPageShell density="pane" variant="scanlines" className="flex flex-col">
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
        writing={writing}
        generating={generating}
        onWriteNext={writeNextChapter}
        onKeepWriting={keepWriting}
        onStop={stopWriting}
        onOpenBible={() => setBibleOpen(true)}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onCloseSidebar={() => setSidebarOpen(false)}
        onSelectChapter={handleChapterSelect}
        onEditChapter={openEditModal}
        onRetryChapter={retryChapter}
        onPrev={() => setCurrentChapter(Math.max(1, currentChapter - 1))}
        onNext={handleNextChapter}
        spend={spend}
      />
    </AppPageShell>
  );
}
