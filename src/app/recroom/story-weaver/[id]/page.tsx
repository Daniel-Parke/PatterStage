// Story Weaver — Reader V2 (retry, edit chapter, continue story)
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { ChevronLeft, ChevronRight, BookOpen, Sparkles, Loader2, X, RefreshCw, PenLine, PlayCircle, AlertTriangle } from "lucide-react";
import ChapterList from "@/components/story-weaver/ChapterList";
import GenerateOverlay from "@/components/story-weaver/GenerateOverlay";
import ReaderSettings, { loadSettings, DEFAULT_SETTINGS, FONTS, THEMES, type ReadingSettings } from "@/components/story-weaver/ReaderSettings";

interface Chapter {
  number: number;
  title: string;
  status: string;
  wordCount: number;
  readStatus?: "writing" | "unread" | "read";
  generatedAt?: string | null;
  error?: string;
}

interface StoryState {
  id: string;
  title: string;
  chapters: Chapter[];
  chapterContents?: Record<string, string>;
  storyArc?: unknown;
  rollingSummary?: string;
  status?: string;
  masterPrompt?: string;
  generationError?: string;
  config?: Record<string, unknown>;
  updatedAt?: string;
}

export default function StoryReaderPage() {
  const router = useRouter();
  const params = useParams();
  const storyId = params.id as string;

  const [story, setStory] = useState<StoryState | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentChapter, setCurrentChapter] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "load", storyId }),
      });
      const d = await res.json();
      if (d.data) setStory(d.data as StoryState);
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
      if (d.data?.story) setStory(d.data.story as StoryState);
      else if (d.error) setError(d.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally { setGenerating(false); }
  }, [story, storyId]);

  // Auto-generate next pending chapter
  useEffect(() => {
    if (!story || generating) return;
    const firstPending = story.chapters?.find((c: Chapter) => c.status === "pending");
    const anyWriting = story.chapters?.some((c: Chapter) => c.status === "writing");
    if (firstPending && !anyWriting) {
      generateNext();
    }
  }, [story, story?.chapters, generating, generateNext]);

  // Retry a failed chapter
  const retryChapter = useCallback(async (chapterNumber: number) => {
    setError(null);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-neon-purple animate-spin" />
      </div>
    );
  }

  if (!story) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-white/40 mb-4">Story not found</p>
          <button onClick={() => router.push("/recroom/story-weaver")} className="text-xs text-neon-purple">← Back to Dashboard</button>
        </div>
      </div>
    );
  }

  const chapters: Chapter[] = story.chapters || [];
  const chapterContent = story.chapterContents?.[currentChapter] || "";
  const currentMeta = chapters[currentChapter - 1];
  const nextComplete = chapters.find((c: Chapter) => c.number > currentChapter && c.status === "complete");
  const prevChapter = currentChapter > 1 ? chapters[currentChapter - 2] : null;
  const nextChapter = nextComplete ? chapters[nextComplete.number - 1] : null;
  const anyFailed = chapters.some((c: Chapter) => c.status === "failed");
  const allComplete = chapters.length > 0 && chapters.every((c: Chapter) => c.status === "complete");

  return (
    <div className="min-h-screen bg-dark-950 grid-bg relative scanlines flex flex-col">
      {/* Error banner — rendered above the overlay so it is always visible */}
      {error && (
        <div className="fixed top-0 left-0 right-0 z-[70] bg-red-500/10 border-b border-red-500/20 px-4 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-300 flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400/50 hover:text-red-400"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Progress overlay for continue and edit */}
      <GenerateOverlay
        title={story?.title || "Story"}
        visible={continuing || editing}
        done={continueDone || editDone}
        onComplete={continuing ? handleContinueComplete : handleEditComplete}
      />

      {/* Edit Chapter Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-[60] bg-dark-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-dark-900 border border-purple-500/20 rounded-xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white">Edit Chapter {editChapterNum}</h3>
            <p className="text-xs text-white/40">Describe what you want changed. The chapter will be rewritten, and all subsequent chapters will regenerate with the updated context.</p>
            <textarea
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              rows={4}
              placeholder="e.g., Make the dialogue more tense, add a plot twist about the captain..."
              className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-purple-500/30 font-mono resize-none"
            />
            <div>
              <label className="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-1.5">Chapter Length</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "short", label: "800-1.2k" }, { id: "medium", label: "1.2-1.8k" },
                  { id: "standard", label: "1.8-2.5k" }, { id: "long", label: "2.5-3.5k" },
                  { id: "epic", label: "3.5-5k" }, { id: "marathon", label: "5k+" },
                ].map((opt) => (
                  <button key={opt.id} onClick={() => setEditWordCount(opt.id)}
                    className={`px-2 py-1 rounded text-[10px] font-mono border transition-all ${
                      editWordCount === opt.id ? "border-purple-500/40 bg-purple-500/15 text-neon-purple" : "border-white/8 text-white/30 hover:text-white/50"
                    }`}>{opt.label}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-1.5">Chapters to Regenerate</label>
              <div className="flex gap-2">
                {[2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setEditCount(n)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                      editCount === n ? "border-purple-500/40 bg-purple-500/15 text-neon-purple" : "border-white/8 text-white/30 hover:text-white/50"
                    }`}>{n}</button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditModalOpen(false)}
                className="px-4 py-2 text-xs text-white/40 hover:text-white/60 rounded-lg border border-white/10 hover:bg-white/5">
                Cancel
              </button>
              <button onClick={handleEditChapter} disabled={!editPrompt.trim()}
                className="px-4 py-2 text-xs text-neon-purple rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 disabled:opacity-30 flex items-center gap-2">
                <PenLine className="w-3 h-3" /> Edit Chapter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Continue Story Modal */}
      {continueModalOpen && (
        <div className="fixed inset-0 z-[60] bg-dark-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-dark-900 border border-green-500/20 rounded-xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white">Continue Story</h3>
            <p className="text-xs text-white/40">Describe the direction for the continuation. New chapter outlines will be generated that continue from where the story left off.</p>
            <textarea
              value={continueDirection}
              onChange={(e) => setContinueDirection(e.target.value)}
              rows={3}
              placeholder="e.g., A new threat emerges from the east, forcing the heroes to ally with old enemies..."
              className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-green-500/30 font-mono resize-none"
            />
            <div>
              <label className="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-1.5">Additional Chapters</label>
              <div className="flex gap-2">
                {[2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setContinueCount(n)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                      continueCount === n ? "border-green-500/40 bg-green-500/15 text-green-400" : "border-white/8 text-white/30 hover:text-white/50"
                    }`}>{n}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-1.5">Chapter Length</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "short", label: "800-1.2k" }, { id: "medium", label: "1.2-1.8k" },
                  { id: "standard", label: "1.8-2.5k" }, { id: "long", label: "2.5-3.5k" },
                  { id: "epic", label: "3.5-5k" }, { id: "marathon", label: "5k+" },
                ].map((opt) => (
                  <button key={opt.id} onClick={() => setContinueWordCount(opt.id)}
                    className={`px-2 py-1 rounded text-[10px] font-mono border transition-all ${
                      continueWordCount === opt.id ? "border-green-500/40 bg-green-500/15 text-green-400" : "border-white/8 text-white/30 hover:text-white/50"
                    }`}>{opt.label}</button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setContinueModalOpen(false)}
                className="px-4 py-2 text-xs text-white/40 hover:text-white/60 rounded-lg border border-white/10 hover:bg-white/5">
                Cancel
              </button>
              <button onClick={handleContinue} disabled={!continueDirection.trim()}
                className="px-4 py-2 text-xs text-green-400 rounded-lg border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 disabled:opacity-30 flex items-center gap-2">
                <PlayCircle className="w-3 h-3" /> Continue Story
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Story generation error banner */}
      {story.status === "failed" && story.generationError && (
        <div className="fixed top-0 left-0 right-0 z-[65] bg-red-500/10 border-b border-red-500/20 px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-red-300 font-semibold">Story generation failed</p>
            <p className="text-xs text-red-300/60">{story.generationError}</p>
          </div>
          <button onClick={() => router.push("/recroom/story-weaver/create")}
            className="px-3 py-1.5 text-xs text-red-300 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20">
            Retry from Create
          </button>
        </div>
      )}

      {/* Reader Header */}
      <div className="sticky top-0 lg:top-0 z-30 border-b border-white/10 bg-dark-950/95 backdrop-blur-xl flex-shrink-0">
        <div className="flex items-center justify-between px-3 md:px-6 h-12">
          <button onClick={() => router.push("/recroom/story-weaver")}
            className="p-2.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0 mx-2 text-center">
            <div className="text-[9px] font-mono text-white/20 uppercase tracking-wider">Story Weaver</div>
            <h1 className="text-sm font-semibold text-white truncate">{story.title}</h1>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Continue button for complete stories */}
            {allComplete && (
              <button onClick={() => setContinueModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-green-500/20 text-xs font-bold text-green-400 hover:bg-green-500/10 transition-colors min-h-[44px]"
                title="Continue this story">
                <PlayCircle className="w-4 h-4" />
                <span className="hidden md:inline">Continue</span>
              </button>
            )}
            {/* Retry all failed chapters */}
            {anyFailed && (
              <button onClick={() => {
                const failed = chapters.find((c: Chapter) => c.status === "failed");
                if (failed) retryChapter(failed.number);
              }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-orange-500/20 text-xs font-bold text-orange-400 hover:bg-orange-500/10 transition-colors min-h-[44px]"
                title="Retry failed chapters">
                <RefreshCw className="w-4 h-4" />
                <span className="hidden md:inline">Retry</span>
              </button>
            )}
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-xs font-bold text-white/70 hover:text-white hover:bg-white/5 transition-colors min-w-[44px] min-h-[44px] justify-center"
              title={sidebarOpen ? "Hide Chapters" : "Show Chapters"}>
              <BookOpen className="w-4 h-4" />
              <span className="hidden md:inline">Chapters</span>
            </button>
            <ReaderSettings settings={settings} onChange={setSettings} />
          </div>
        </div>

        {/* Chapter indicator dots */}
        <div className="flex items-center justify-center gap-1.5 pb-2 px-4">
          {chapters.map((ch, i) => (
            <button key={i} onClick={() => ch.status === "complete" && handleChapterSelect(i + 1)}
              className={`w-2 h-2 rounded-full transition-all ${
                i + 1 === currentChapter ? "scale-150" : "opacity-40 hover:opacity-70"
              }`}
              style={{ background: ch.status === "complete" ? (i + 1 === currentChapter ? theme.accent : "#4a3f35") : ch.status === "writing" ? "#3b82f6" : ch.status === "pending" ? "#f59e0b" : ch.status === "failed" ? "#7f1d1d" : "#2a2520" }}
              title={`Chapter ${i + 1}: ${ch.title} (${ch.status})`} />
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex" style={{ height: "calc(100vh - 72px)" }}>
        {/* Chapter Sidebar */}
        {sidebarOpen && (
          <div className="w-56 flex-shrink-0 border-r border-white/5 sticky top-16 overflow-y-auto hidden md:block" style={{ background: theme.panel, maxHeight: "calc(100vh - 64px)" }}>
            <div className="p-4">
              <ChapterList chapters={chapters} currentChapter={currentChapter} onSelect={handleChapterSelect} />
            </div>
          </div>
        )}

        {/* Book Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div ref={contentRef} className="flex-1 w-full overflow-y-auto" style={{ background: theme.bg, filter: `brightness(${settings.brightness})` }}>
            {chapterContent ? (
              <div className="max-w-3xl mx-auto px-6 md:px-16 py-8 md:py-10">
                <div id="chapter-top" className="flex items-center justify-between mb-8 pb-4 border-b scroll-mt-16" style={{
                  borderColor: settings.pageTheme === "light" ? "#d4ccc0" : "#2a2520",
                }}>
                  <h2 style={{
                    color: theme.text,
                    fontFamily: fontObj.family,
                    fontSize: `${settings.fontSize + 6}px`,
                    fontWeight: 600,
                  }}>
                    Chapter {currentChapter}: {currentMeta?.title}
                  </h2>
                  {/* Edit button on completed chapters */}
                  {currentMeta?.status === "complete" && (
                    <button onClick={() => openEditModal(currentChapter)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-[10px] font-mono text-white/40 hover:text-neon-purple hover:border-purple-500/30 transition-colors flex-shrink-0"
                      title="Edit this chapter">
                      <PenLine className="w-3 h-3" />
                      Edit
                    </button>
                  )}
                </div>
                <div className="whitespace-pre-wrap text-justify" style={{
                  color: theme.text, fontFamily: fontObj.family,
                  fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight,
                }}>
                  {chapterContent}
                </div>
              </div>
            ) : currentMeta?.status === "writing" || currentMeta?.status === "pending" ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
                <Sparkles className="w-8 h-8 animate-pulse mb-4" style={{ color: theme.accent }} />
                <p className="text-sm" style={{ color: theme.text, opacity: 0.5, fontFamily: fontObj.family }}>
                  {currentMeta.status === "writing" ? "The muse is visiting..." : "Waiting for its moment..."}
                </p>
                <p className="text-xs mt-2" style={{ color: theme.text, opacity: 0.3 }}>
                  Chapter {currentChapter} is being written
                </p>
              </div>
            ) : currentMeta?.status === "failed" ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] px-6">
                <AlertTriangle className="w-8 h-8 mb-4 text-red-400" />
                <p className="text-sm text-red-300 mb-2">Chapter {currentChapter} failed to generate</p>
                {currentMeta.error && (
                  <p className="text-xs text-red-300/50 mb-4 max-w-md text-center">{currentMeta.error}</p>
                )}
                <div className="flex gap-2">
                  <button onClick={() => retryChapter(currentChapter)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-orange-500/30 text-xs text-orange-400 bg-orange-500/10 hover:bg-orange-500/20">
                    <RefreshCw className="w-3 h-3" /> Retry Chapter
                  </button>
                  <button onClick={() => openEditModal(currentChapter)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-purple-500/30 text-xs text-neon-purple bg-purple-500/10 hover:bg-purple-500/20">
                    <PenLine className="w-3 h-3" /> Rewrite with Prompt
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full min-h-[400px]">
                <p className="text-sm" style={{ color: theme.text, opacity: 0.3 }}>Select a chapter to read</p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between px-4 md:px-6 py-3 border-t flex-shrink-0" style={{ borderColor: settings.pageTheme === "light" ? "#d4ccc0" : "#2a2520", background: theme.panel }}>
            <button onClick={() => setCurrentChapter(Math.max(1, currentChapter - 1))}
              disabled={currentChapter <= 1}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-mono disabled:opacity-20 min-h-[44px] max-w-[45%] truncate"
              style={{ color: theme.text, opacity: 0.6 }}>
              <ChevronLeft className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{prevChapter ? prevChapter.title : "Prev"}</span>
            </button>

            <div className="flex gap-1.5 overflow-x-auto max-w-[200px] md:max-w-none">
              {chapters.map((ch, i) => (
                <button key={i} onClick={() => ch.status === "complete" && handleChapterSelect(i + 1)}
                  className={`w-2.5 h-2.5 rounded-full transition-all flex-shrink-0 ${i + 1 === currentChapter ? "scale-125" : "opacity-40 hover:opacity-70"}`}
                  style={{ background: ch.status === "complete" ? (i + 1 === currentChapter ? theme.accent : "#4a3f35") : ch.status === "writing" ? "#3b82f6" : ch.status === "pending" ? "#f59e0b" : ch.status === "failed" ? "#7f1d1d" : "#2a2520" }} />
              ))}
            </div>

            <button onClick={handleNextChapter}
              disabled={!nextComplete}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-mono disabled:opacity-20 min-h-[44px] max-w-[45%] truncate"
              style={{ color: theme.text }}>
              <span className="truncate">{nextChapter ? nextChapter.title : "Next"}</span>
              <ChevronRight className="w-4 h-4 flex-shrink-0" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-dark-950/80 backdrop-blur-sm" onClick={() => setSidebarOpen(false)}>
          <div className="absolute left-0 top-0 bottom-0 w-72 border-r border-white/10 overflow-y-auto" style={{ background: theme.panel }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-end p-3">
              <button onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-lg text-white/40 hover:text-white/60 hover:bg-white/5 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-3 pb-4">
              <ChapterList chapters={chapters} currentChapter={currentChapter} onSelect={handleChapterSelect} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
