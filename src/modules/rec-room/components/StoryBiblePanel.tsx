// ═══════════════════════════════════════════════════════════════
// StoryBiblePanel — surfaces the story's predetermined arc in the reader.
//
// A slide-over showing the throughline, themes, world rules, fixed plot points
// (per chapter), character arcs, the per-chapter outline, and the rolling
// summary — so the operator can SEE the semi-predetermined arc the chapters are
// being conditioned on (closing the "where is this going?" loop). Read-only.
// A right-hand Dialog since U12 (T-0126); the behaviour is the hook's, the
// chrome is the primitive's.
// ═══════════════════════════════════════════════════════════════

"use client";

import { BookMarked, ListOrdered, MapPin, Sparkles, Users } from "lucide-react";

import Card from "@/components/ui/Card";
import Dialog from "@/components/ui/Dialog";
import { safeArc } from "@/modules/rec-room/handlers/shared";

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof MapPin;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 font-mono text-micro uppercase tracking-wider text-neon-purple">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {title}
      </div>
      <div className="text-body leading-relaxed text-ps-text-secondary">{children}</div>
    </div>
  );
}

export default function StoryBiblePanel({
  storyArc,
  rollingSummary,
  open,
  onClose,
}: {
  storyArc: unknown;
  rollingSummary?: string;
  open: boolean;
  onClose: () => void;
}) {
  const arc = safeArc(storyArc);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      placement="right"
      title="Story bible"
      icon={BookMarked}
      iconColor="text-neon-purple"
      closeLabel="Close story bible"
    >
      {!arc ? (
        <p className="text-body italic text-ps-text-muted">No story arc is available for this story yet.</p>
      ) : (
        <div className="space-y-5">
          <Section icon={MapPin} title="Throughline">
            <p>{arc.storyArc || "(unspecified)"}</p>
            {arc.themes?.length > 0 && (
              <p className="mt-2 text-ps-text-muted">
                <span className="text-ps-text-muted">Themes:</span> {arc.themes.join(", ")}
              </p>
            )}
            {arc.worldRules?.length > 0 && (
              <ul className="mt-2 list-disc space-y-0.5 pl-4 text-ps-text-muted">
                {arc.worldRules.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </Section>

          {arc.fixedPlotPoints?.length > 0 && (
            <Section icon={Sparkles} title="Fixed Plot Points">
              <ul className="space-y-1.5">
                {arc.fixedPlotPoints
                  .slice()
                  .sort((a, b) => a.chapter - b.chapter)
                  .map((p, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="shrink-0 font-mono text-micro text-neon-purple">Ch {p.chapter}</span>
                      <span>
                        {p.event}
                        {p.setup ? <span className="text-ps-text-muted"> — {p.setup}</span> : null}
                      </span>
                    </li>
                  ))}
              </ul>
            </Section>
          )}

          {arc.characterArcs?.length > 0 && (
            <Section icon={Users} title="Character Arcs">
              <div className="space-y-2.5">
                {arc.characterArcs.map((c, i) => (
                  <div key={i}>
                    <div className="font-medium text-ps-text-secondary">{c.name}</div>
                    <div className="text-ps-text-muted">{c.journey}</div>
                    <div className="mt-0.5 text-body text-ps-text-muted">
                      {c.startingState} → {c.endingState}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {arc.chapterOutlines?.length > 0 && (
            <Section icon={ListOrdered} title="Chapter Outline">
              <div className="space-y-2">
                {arc.chapterOutlines.map((o, i) => (
                  <Card key={i} variant="raised" padding="sm">
                    <div className="font-medium text-ps-text-secondary">
                      {o.number}. {o.title}
                    </div>
                    <div className="text-ps-text-muted">{o.purpose}</div>
                    {o.keyBeats?.length > 0 && (
                      <div className="mt-1 text-body text-ps-text-muted">{o.keyBeats.join(" · ")}</div>
                    )}
                  </Card>
                ))}
              </div>
            </Section>
          )}

          {rollingSummary && (
            <Section icon={BookMarked} title="Narrative So Far">
              <p className="whitespace-pre-wrap">{rollingSummary}</p>
            </Section>
          )}
        </div>
      )}
    </Dialog>
  );
}
