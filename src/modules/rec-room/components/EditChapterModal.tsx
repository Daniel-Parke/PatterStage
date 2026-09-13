// ── EditChapterModal — rewrite one chapter from a prompt.
// A Dialog on the shared contract (T-0096, D116): Escape closes, Tab stays
// inside, focus returns to the button that opened it. The two choices are
// radiogroups, as in ContinueStoryModal (U12, T-0126).

"use client";

import { PenLine } from "lucide-react";

import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { Field, Textarea } from "@/components/ui/field";
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

const COUNTS = [2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }));
const LENGTHS = WORD_COUNT_OPTIONS.map((o) => ({ value: o.id, label: o.label }));
const LABEL = "block font-mono text-micro uppercase tracking-wider text-ps-text-muted";

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
    <Dialog
      open
      onClose={onCancel}
      title={`Edit chapter ${chapterNumber}`}
      icon={PenLine}
      iconColor="text-neon-purple"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" color="purple" icon={PenLine} onClick={onSubmit} disabled={!prompt.trim()}>
            Edit chapter
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-body text-ps-text-muted">
          Describe what you want changed. The chapter will be rewritten, and all subsequent chapters will regenerate with the updated context.
        </p>
        <Field label={`What to change in chapter ${chapterNumber}`}>
          <Textarea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            rows={4}
            placeholder="e.g., Make the dialogue more tense, add a plot twist about the captain..."
          />
        </Field>
        <div className="space-y-1.5">
          <span className={LABEL}>Chapter length</span>
          <SegmentedControl label="Chapter length" options={LENGTHS} value={wordCount} onChange={onWordCountChange} className="flex-wrap" />
        </div>
        <div className="space-y-1.5">
          <span className={LABEL}>Chapters to regenerate</span>
          <SegmentedControl label="Chapters to regenerate" options={COUNTS} value={String(count)} onChange={(v) => onCountChange(Number(v))} />
        </div>
      </div>
    </Dialog>
  );
}
