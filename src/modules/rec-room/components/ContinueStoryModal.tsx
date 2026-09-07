// ── ContinueStoryModal — extend a finished story in a stated direction.
// Extracted from app/recroom/story-weaver/[id]/page.tsx. A dialog on the
// shared contract (useDialogA11y): Escape closes, Tab stays inside, focus
// returns to the button that opened it (T-0096, D116).

"use client";

import { PlayCircle } from "lucide-react";
import { WORD_COUNT_OPTIONS } from "@/modules/rec-room/components/ReaderSettings";
import { useDialogA11y } from "@/hooks/useDialogA11y";

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
  const panelRef = useDialogA11y({ open: true, onClose: onCancel });
  return (
    <div className="fixed inset-0 z-[60] bg-ps-surface-ground/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel} role="presentation">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="continue-story-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="bg-ps-surface-panel border border-green-500/20 rounded-ps-lg w-full max-w-lg p-6 space-y-4"
      >
        <h3 id="continue-story-title" className="text-body font-semibold text-ps-text-primary">Continue story</h3>
        <p className="text-body text-ps-text-muted">Describe the direction for the continuation. New chapter outlines will be generated that continue from where the story left off.</p>
        <textarea
          value={direction}
          onChange={(e) => onDirectionChange(e.target.value)}
          rows={3}
          placeholder="e.g., A new threat emerges from the east, forcing the heroes to ally with old enemies..."
          aria-label="Direction for the continuation"
          className="w-full bg-ps-surface-inset border border-ps-edge rounded-ps-md px-4 py-3 text-body text-ps-text-primary placeholder-ps-text-muted outline-none focus:border-green-500/30 font-mono resize-none"
        />
        <div>
          <label className="text-micro font-mono text-ps-text-muted uppercase tracking-wider block mb-1.5">Additional chapters</label>
          <div className="flex gap-2">
            {[2, 3, 4, 5].map(n => (
              <button key={n} type="button" onClick={() => onCountChange(n)} aria-pressed={count === n}
                className={`px-3 py-1.5 rounded-ps-md text-micro font-mono border transition-all ${
                  count === n ? "border-green-500/40 bg-green-500/15 text-green-400" : "border-ps-edge text-ps-text-muted hover:text-ps-text-muted"
                }`}>{n}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-micro font-mono text-ps-text-muted uppercase tracking-wider block mb-1.5">Chapter length</label>
          <div className="flex flex-wrap gap-2">
            {WORD_COUNT_OPTIONS.map((opt) => (
              <button key={opt.id} type="button" onClick={() => onWordCountChange(opt.id)} aria-pressed={wordCount === opt.id}
                className={`px-2 py-1 rounded-ps-sm text-micro font-mono border transition-all ${
                  wordCount === opt.id ? "border-green-500/40 bg-green-500/15 text-green-400" : "border-ps-edge text-ps-text-muted hover:text-ps-text-muted"
                }`}>{opt.label}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel}
            className="px-4 py-2 text-body text-ps-text-muted hover:text-ps-text-secondary rounded-ps-md border border-ps-edge hover:bg-ps-surface-raised">
            Cancel
          </button>
          <button type="button" onClick={onSubmit} disabled={!direction.trim()}
            className="px-4 py-2 text-body text-green-400 rounded-ps-md border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 disabled:opacity-30 flex items-center gap-2">
            <PlayCircle className="w-3 h-3" /> Continue story
          </button>
        </div>
      </div>
    </div>
  );
}
