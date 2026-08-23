// ── EditChapterModal — rewrite one chapter from a prompt.
// Extracted verbatim from app/recroom/story-weaver/[id]/page.tsx. Story
// Weaver behaviour is out of scope for T-0011: the markup, the option
// lists and the disabled rule are copied unchanged, and every value and
// callback still comes from the page.

"use client";

import { PenLine } from "lucide-react";
import { WORD_COUNT_OPTIONS } from "@/modules/rec-room/components/ReaderSettings";

export interface EditChapterModalProps {
  chapterNumber: number;
  prompt: string;
  onPromptChange: (value: string) => void;
  wordCount: string;
  onWordCountChange: (id: string) => void;
  count: number;
  onCountChange: (n: number) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export default function EditChapterModal({
  chapterNumber,
  prompt,
  onPromptChange,
  wordCount,
  onWordCountChange,
  count,
  onCountChange,
  onCancel,
  onSubmit,
}: EditChapterModalProps) {
  return (
    <div className="fixed inset-0 z-[60] bg-dark-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-dark-900 border border-neon-purple/20 rounded-xl w-full max-w-lg p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white">Edit Chapter {chapterNumber}</h3>
        <p className="text-xs text-ps-text-muted">Describe what you want changed. The chapter will be rewritten, and all subsequent chapters will regenerate with the updated context.</p>
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          rows={4}
          placeholder="e.g., Make the dialogue more tense, add a plot twist about the captain..."
          className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-neon-purple/30 font-mono resize-none"
        />
        <div>
          <label className="text-xs font-mono text-ps-text-muted uppercase tracking-wider block mb-1.5">Chapter Length</label>
          <div className="flex flex-wrap gap-2">
            {WORD_COUNT_OPTIONS.map((opt) => (
              <button key={opt.id} onClick={() => onWordCountChange(opt.id)}
                className={`px-2 py-1 rounded text-xs font-mono border transition-all ${
                  wordCount === opt.id ? "border-neon-purple/40 bg-neon-purple/15 text-neon-purple" : "border-white/8 text-ps-text-muted hover:text-ps-text-muted"
                }`}>{opt.label}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-mono text-ps-text-muted uppercase tracking-wider block mb-1.5">Chapters to Regenerate</label>
          <div className="flex gap-2">
            {[2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => onCountChange(n)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                  count === n ? "border-neon-purple/40 bg-neon-purple/15 text-neon-purple" : "border-white/8 text-ps-text-muted hover:text-ps-text-muted"
                }`}>{n}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel}
            className="px-4 py-2 text-xs text-ps-text-muted hover:text-ps-text-secondary rounded-lg border border-white/10 hover:bg-white/5">
            Cancel
          </button>
          <button onClick={onSubmit} disabled={!prompt.trim()}
            className="px-4 py-2 text-xs text-neon-purple rounded-lg border border-neon-purple/30 bg-neon-purple/10 hover:bg-neon-purple/20 disabled:opacity-30 flex items-center gap-2">
            <PenLine className="w-3 h-3" /> Edit Chapter
          </button>
        </div>
      </div>
    </div>
  );
}
