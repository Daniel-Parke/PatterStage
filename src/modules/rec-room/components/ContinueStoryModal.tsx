// ── ContinueStoryModal — extend a finished story in a stated direction.
// A Dialog on the shared contract (T-0096, D116): Escape closes, Tab stays
// inside, focus returns to the button that opened it. The two choices are
// radiogroups rather than rows of coloured buttons, so a screen reader is
// told which one is chosen (U12, T-0126).

"use client";

import { PlayCircle } from "lucide-react";

import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { Field, Textarea } from "@/components/ui/field";
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

const COUNTS = [2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }));
const LENGTHS = WORD_COUNT_OPTIONS.map((o) => ({ value: o.id, label: o.label }));
const LABEL = "block font-mono text-micro uppercase tracking-wider text-ps-text-muted";

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
    <Dialog
      open
      onClose={onCancel}
      title="Continue story"
      icon={PlayCircle}
      iconColor="text-neon-green"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" color="green" icon={PlayCircle} onClick={onSubmit} disabled={!direction.trim()}>
            Continue story
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-body text-ps-text-muted">
          Describe the direction for the continuation. New chapter outlines will be generated that continue from where the story left off.
        </p>
        <Field label="Direction for the continuation">
          <Textarea
            value={direction}
            onChange={(e) => onDirectionChange(e.target.value)}
            rows={3}
            placeholder="e.g., A new threat emerges from the east, forcing the heroes to ally with old enemies..."
          />
        </Field>
        <div className="space-y-1.5">
          <span className={LABEL}>Additional chapters</span>
          <SegmentedControl label="Additional chapters" options={COUNTS} value={String(count)} onChange={(v) => onCountChange(Number(v))} />
        </div>
        <div className="space-y-1.5">
          <span className={LABEL}>Chapter length</span>
          <SegmentedControl label="Chapter length" options={LENGTHS} value={wordCount} onChange={onWordCountChange} className="flex-wrap" />
        </div>
      </div>
    </Dialog>
  );
}
