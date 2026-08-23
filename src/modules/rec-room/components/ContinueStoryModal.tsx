// ── ContinueStoryModal — extend a finished story in a stated direction.
// Extracted verbatim from app/recroom/story-weaver/[id]/page.tsx. Story
// Weaver behaviour is out of scope for T-0011: markup and option lists
// are copied unchanged and every value comes from the page.

"use client";

import { PlayCircle } from "lucide-react";
import { WORD_COUNT_OPTIONS } from "@/modules/rec-room/components/ReaderSettings";

export interface ContinueStoryModalProps {
  direction: string;
  onDirectionChange: (value: string) => void;
  count: number;
  onCountChange: (n: number) => void;
  wordCount: string;
  onWordCountChange: (id: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export default function ContinueStoryModal({
  direction,
  onDirectionChange,
  count,
  onCountChange,
  wordCount,
  onWordCountChange,
  onCancel,
  onSubmit,
}: ContinueStoryModalProps) {
  return (
    <div className="fixed inset-0 z-[60] bg-dark-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-dark-900 border border-green-500/20 rounded-xl w-full max-w-lg p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white">Continue Story</h3>
        <p className="text-xs text-ps-text-muted">Describe the direction for the continuation. New chapter outlines will be generated that continue from where the story left off.</p>
        <textarea
          value={direction}
          onChange={(e) => onDirectionChange(e.target.value)}
          rows={3}
          placeholder="e.g., A new threat emerges from the east, forcing the heroes to ally with old enemies..."
          className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-green-500/30 font-mono resize-none"
        />
        <div>
          <label className="text-xs font-mono text-ps-text-muted uppercase tracking-wider block mb-1.5">Additional Chapters</label>
          <div className="flex gap-2">
            {[2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => onCountChange(n)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                  count === n ? "border-green-500/40 bg-green-500/15 text-green-400" : "border-white/8 text-ps-text-muted hover:text-ps-text-muted"
                }`}>{n}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-mono text-ps-text-muted uppercase tracking-wider block mb-1.5">Chapter Length</label>
          <div className="flex flex-wrap gap-2">
            {WORD_COUNT_OPTIONS.map((opt) => (
              <button key={opt.id} onClick={() => onWordCountChange(opt.id)}
                className={`px-2 py-1 rounded text-xs font-mono border transition-all ${
                  wordCount === opt.id ? "border-green-500/40 bg-green-500/15 text-green-400" : "border-white/8 text-ps-text-muted hover:text-ps-text-muted"
                }`}>{opt.label}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel}
            className="px-4 py-2 text-xs text-ps-text-muted hover:text-ps-text-secondary rounded-lg border border-white/10 hover:bg-white/5">
            Cancel
          </button>
          <button onClick={onSubmit} disabled={!direction.trim()}
            className="px-4 py-2 text-xs text-green-400 rounded-lg border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 disabled:opacity-30 flex items-center gap-2">
            <PlayCircle className="w-3 h-3" /> Continue Story
          </button>
        </div>
      </div>
    </div>
  );
}
