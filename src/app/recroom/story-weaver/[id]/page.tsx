// Story Weaver — Reader V2 (retry, edit chapter, continue story)
//
// Cached reads and explicit mutations share the client query layer (T-0190).
// The reader retains its own write intent, abort controllers, failure ceiling
// and overlay completion state. Presentation lives beside ChapterList.
"use client";
import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { publishApiResource, useApiResource } from "@/hooks/useApiResource";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { useRouter, useParams } from "next/navigation";
import AppPageShell from "@/components/layout/AppPageShell";
import PageTitle from "@/components/layout/PageTitle";
import { loadSettings, DEFAULT_SETTINGS, FONTS, type ReadingSettings } from "@/modules/rec-room/components/ReaderSettings";
import type { Chapter, StoryState } from "@/modules/rec-room/components/story-reader-types";
import { deriveReaderView } from "@/modules/rec-room/components/story-reader-view";
import { ReaderLoading, ReaderNotFound } from "@/modules/rec-room/components/ReaderPlaceholders";
import StoryReaderOverlays from "@/modules/rec-room/components/StoryReaderOverlays";
import ReaderBody from "@/modules/rec-room/components/ReaderBody";
import { ReaderErrorBanner } from "@/modules/rec-room/components/ReaderBanners";
import type { SpendWindowSource } from "@/lib/spend/spend-window";

/** Stop auto-generating after this many consecutive failures. */
const MAX_AUTO_FAILURES = 3;

export default function StoryReaderPage() {
  const router = useRouter();
  const params = useParams();
  const storyId = params.id as string;
  const client = useQueryClient();

  const [story, setStory] = useState<StoryState | null>(null);
  const storyRef = useRef(story);
  storyRef.current = story;
  const activeStoryId = useRef(storyId);
  activeStoryId.current = storyId;
  const titleRepair = useRef({ storyId, attempted: false, active: true });
  if (titleRepair.current.storyId !== storyId) titleRepair.current = { storyId, attempted: false, active: true };
  useEffect(() => {
    const owner = titleRepair.current;
    owner.active = true;
    return () => { owner.active = false; };
  }, [storyId]);
  const publishStory = useCallback(async (update: StoryState | ((current: StoryState) => StoryState)) => {
    await publishApiResource(client, "/api/stories", {
      body: { action: "load", storyId },
      responseBody: current => {
        const confirmed = typeof update === "function" ? update((current ?? storyRef.current) as StoryState) : update;
        if (!confirmed || confirmed.id !== storyId || typeof confirmed.title !== "string" || !Array.isArray(confirmed.chapters)) {
          throw new Error("Story write could not be confirmed");
        }
        if (activeStoryId.current === storyId) storyRef.current = confirmed;
        return { data: confirmed };
      },
    });
    if (activeStoryId.current === storyId) setStory(storyRef.current);
  }, [client, storyId]);
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
  useEffect(() => {
    const controllers = inFlightRef.current;
    return () => controllers.forEach((controller) => controller.abort());
  }, [storyId]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bibleOpen, setBibleOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** What this story has cost so far. Null while unknown, never assumed zero. */

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
  useLayoutEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [currentChapter]);
  /** Consecutive auto-generate failures. A ref: bumping it must not re-run the effect. */
  const autoFailuresRef = useRef(0);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setSidebarOpen(true);
    }
  }, []);

  const [settings, setSettings] = useState<ReadingSettings>(DEFAULT_SETTINGS);
  useEffect(() => { setSettings(loadSettings()); }, []);
  // Writes retain the original fetch transport: no new deadline on billed work.
  const { mutateAsync: writeStory } = useMutation({
    retry: false,
    mutationFn: (options: RequestInit) => fetch("/api/stories", options),
  });
  const storyRead = useApiResource<StoryState>("/api/stories", {
    body: { action: "load", storyId },
    select: (data) => data && typeof data === "object" && Array.isArray((data as StoryState).chapters) ? data as StoryState : undefined,
    errorMessage: "Failed to load story",
  });
  const spendRead = useApiResource<SpendWindowSource | null>("/api/stories", {
    body: { action: "spend", storyId },
    select: (data) => (data as { spend?: SpendWindowSource } | null)?.spend ?? null,
  });
  const spend = spendRead.error ? null : spendRead.data;
  const { refetch: refetchStory } = storyRead;
  const { refetch: refetchSpend } = spendRead;
  const loadStory = useCallback(async () => { await refetchStory(); }, [refetchStory]);
  const loadSpend = useCallback(async () => { await refetchSpend(); }, [refetchSpend]);
  useEffect(() => {
    const loaded = storyRead.data;
    if (!loaded) {
      setStory(previous => previous?.id === storyId ? previous : null);
      return;
    }
    setStory(loaded);
    const owner = titleRepair.current;
    // Historical title repair is nonfatal and never starts generation.
    if (!titleRepair.current.attempted && loaded.chapters.some(c => c.status === "complete" && c.title === `Chapter ${c.number}`)) {
      titleRepair.current.attempted = true;
      void writeStory({ method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync-titles", storyId }),
      }).then(async response => {
        const result = await response.json();
        if (owner.active && titleRepair.current === owner && response.ok && !result.error && result.data?.story?.id === storyId && Array.isArray(result.data.story.chapters)) {
          const repaired = result.data.story as StoryState;
          await publishStory(current => ({
            ...current,
            ...(current.storyArc === loaded.storyArc ? { storyArc: repaired.storyArc } : {}),
            chapters: current.chapters.map(chapter => {
              const original = loaded.chapters.find(previous => previous.number === chapter.number);
              const confirmed = repaired.chapters.find(next => next.number === chapter.number);
              return original?.title === chapter.title && typeof confirmed?.title === "string"
                ? { ...chapter, title: confirmed.title } : chapter;
            }),
          }));
        }
      }).catch(() => { /* non-fatal */ });
    }
  }, [storyRead.data, storyId, writeStory, publishStory]);

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
      const res = await writeStory({
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate-chapter", storyId }),
        signal: controller.signal,
      });
      const d = await res.json();
      if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
      if (!res.ok || d?.error || !Array.isArray(d?.data?.story?.chapters)) throw new Error(d?.error || "Story write could not be confirmed");
      if (d.data?.story) {
        autoFailuresRef.current = 0; // progress: re-arm auto-generation
        await publishStory(d.data.story as StoryState);
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
  }, [story, storyId, loadStory, callStarted, callSettled, writeStory, publishStory]);

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
    if (editDone) { setEditing(false); setEditDone(false); }
    if (continueDone) { setContinuing(false); setContinueDone(false); }
    // Each call removes its own controller when it settles, so this is only
    // ever the set of generations still running. Aborting all of them is the
    // point: Stop has to mean stopped on every path that bills, not just the
    // most recent one.
    inFlightRef.current.forEach((controller) => controller.abort());
  }, [editDone, continueDone]);

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
      const res = await writeStory({
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry-chapter", storyId, chapterNumber }),
        signal: controller.signal,
      });
      const d = await res.json();
      if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
      if (!res.ok || d?.error || !Array.isArray(d?.data?.story?.chapters)) throw new Error(d?.error || "Story write could not be confirmed");
      if (d.data?.story) await publishStory(d.data.story as StoryState);
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
  }, [storyId, loadStory, callStarted, callSettled, writeStory, publishStory]);

  // Edit chapter with prompt
  const handleEditChapter = useCallback(async () => {
    if (!editPrompt.trim()) return;
    setEditModalOpen(false);
    setEditing(true);
    setEditDone(false);
    setError(null);
    const controller = new AbortController();
    inFlightRef.current.add(controller);
    callStarted();
    try {
      const res = await writeStory({
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit-chapter",
          storyId,
          chapterNumber: editChapterNum,
          editPrompt: editPrompt.trim(),
          wordCountRange: editWordCount,
          count: editCount,
        }),
        signal: controller.signal,
      });
      const d = await res.json();
      if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
      if (!res.ok || d?.error || !Array.isArray(d?.data?.story?.chapters)) throw new Error(d?.error || "Story write could not be confirmed");
      if (d.data?.story) {
        await publishStory(d.data.story as StoryState);
        if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
        setEditDone(true);
      }
    } catch (e) {
      setEditing(false);
      setEditDone(false);
      if (controller.signal.aborted) {
        void loadStory();
      } else {
        setError(e instanceof Error ? e.message : "Edit failed");
      }
    } finally {
      inFlightRef.current.delete(controller);
      callSettled();
    }
  }, [storyId, editChapterNum, editPrompt, editWordCount, editCount, writeStory, publishStory, loadStory, callStarted, callSettled]);

  // Continue story
  const handleContinue = useCallback(async () => {
    if (!continueDirection.trim()) return;
    setContinueModalOpen(false);
    setContinuing(true);
    setContinueDone(false);
    setError(null);
    const controller = new AbortController();
    inFlightRef.current.add(controller);
    callStarted();
    try {
      const res = await writeStory({
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "continue",
          storyId,
          direction: continueDirection.trim(),
          count: continueCount,
          wordCountRange: continueWordCount,
        }),
        signal: controller.signal,
      });
      const d = await res.json();
      if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
      if (!res.ok || d?.error || !Array.isArray(d?.data?.chapters)) throw new Error(d?.error || "Story write could not be confirmed");
      if (d.data) {
        await publishStory(d.data as StoryState);
        if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
        setContinueDone(true);
      }
    } catch (e) {
      setContinuing(false);
      setContinueDone(false);
      if (controller.signal.aborted) {
        void loadStory();
      } else {
        setError(e instanceof Error ? e.message : "Continue failed");
      }
    } finally {
      inFlightRef.current.delete(controller);
      callSettled();
    }
  }, [storyId, continueDirection, continueCount, continueWordCount, writeStory, publishStory, loadStory, callStarted, callSettled]);

  const openEditModal = (chapterNumber: number) => {
    setEditChapterNum(chapterNumber);
    setEditPrompt("");
    setEditModalOpen(true);
  };

  const saveReadStatus = useCallback(async (chapterNumber: number): Promise<boolean> => {
    try {
      const response = await writeStory({
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", storyId, chapters: [{ number: chapterNumber, readStatus: "read" }] }),
      });
      const result = await response.json().catch(() => null) as {
        data?: { chapters?: Chapter[] };
        error?: unknown;
      } | null;
      const confirmed = Array.isArray(result?.data?.chapters)
        && result.data.chapters.some((chapter) =>
          chapter.number === chapterNumber && chapter.readStatus === "read"
        );
      if (!response.ok || result?.error || !confirmed) {
        setError(typeof result?.error === "string" ? result.error : "Could not confirm chapter read-status save. Please try again.");
        return false;
      }
      // The update may confirm only one chapter. Preserve the complete load
      // envelope and merge only the field this request actually confirmed.
      if (storyRef.current && activeStoryId.current === storyId) {
        await publishStory(current => ({ ...current, chapters: current.chapters.map(chapter =>
          chapter.number === chapterNumber ? { ...chapter, readStatus: "read" } : chapter,
        ) }));
      }
      return true;
    } catch {
      setError("Could not save chapter read status. Please try again.");
      return false;
    }
  }, [storyId, writeStory, publishStory]);

  const handleNextChapter = useCallback(async () => {
    if (!story) return;
    const chapters: Chapter[] = story.chapters || [];
    const currentMeta = chapters[currentChapter - 1];
    if (currentMeta?.readStatus !== "read") {
      setError(null);
      if (await saveReadStatus(currentChapter)) {
        setStory((prev: StoryState | null) => prev && {
          ...prev,
          chapters: prev.chapters.map((c: Chapter) =>
            c.number === currentChapter ? { ...c, readStatus: "read" as const } : c
          ),
        });
      }
    }
    const nextComplete = chapters.find((c: Chapter) => c.number > currentChapter && c.status === "complete");
    if (nextComplete) {
      setCurrentChapter(nextComplete.number);
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
  }, [story, currentChapter, saveReadStatus]);

  const handleChapterSelect = async (num: number) => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
    setCurrentChapter(num);

    if (window.innerWidth < 768) setSidebarOpen(false);
    setError(null);
    if (await saveReadStatus(num)) {
      setStory((prev: StoryState | null) => prev && {
        ...prev,
        chapters: prev.chapters.map((c: Chapter) =>
          c.number === num && c.status === "complete" ? { ...c, readStatus: "read" as const } : c
        ),
      });
    }
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

  if (storyRead.isLoading && !story) return <ReaderLoading />;

  if (storyRead.error && !story) return <LoadErrorBanner error={storyRead.error} onRetry={() => void loadStory()} />;

  if (!story) return <ReaderNotFound onBack={() => router.push("/recroom/story-weaver")} />;

  const view = deriveReaderView(story, currentChapter);

  return (
    <AppPageShell density="pane" variant="scanlines" className="flex flex-col">
      <PageTitle title={story?.title || "Story Weaver"} />
      {storyRead.error && <LoadErrorBanner error={storyRead.error} onRetry={() => void loadStory()} />}
      <StoryReaderOverlays
        story={story}
        bibleOpen={bibleOpen}
        onCloseBible={() => setBibleOpen(false)}
        overlayVisible={continuing || editing}
        overlayDone={(continueDone || editDone) && !generating}
        onStop={stopWriting}
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

      <div className="contents" inert={editing || continuing} aria-hidden={editing || continuing ? true : undefined}>
      <ReaderBody
        title={story.title}
        errorBanner={error && (
          <ReaderErrorBanner
            error={error}
            autoPaused={autoPaused}
            maxAutoFailures={MAX_AUTO_FAILURES}
            onDismiss={() => setError(null)}
          />
        )}
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
      </div>
    </AppPageShell>
  );
}
