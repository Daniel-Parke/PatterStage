// ═══════════════════════════════════════════════════════════════
// StoryBiblePanel — surfaces the story's predetermined arc in the reader.
//
// A slide-over showing the throughline, themes, world rules, fixed plot points
// (per chapter), character arcs, the per-chapter outline, and the rolling
// summary — so the operator can SEE the semi-predetermined arc the chapters are
// being conditioned on (closing the "where is this going?" loop). Read-only.
// ═══════════════════════════════════════════════════════════════

"use client";

import { X, BookMarked, MapPin, Users, ListOrdered, Sparkles } from "lucide-react";
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
      <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-neon-purple/80">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <div className="text-xs leading-relaxed text-white/65">{children}</div>
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
  if (!open) return null;
  const arc = safeArc(storyArc);

  return (
    <div className="fixed inset-0 z-[55] flex justify-end bg-dark-950/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto border-l border-neon-purple/20 bg-dark-900 p-5 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <BookMarked className="h-4 w-4 text-neon-purple" />
            <h3 className="text-sm font-semibold text-white">Story Bible</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/40 hover:bg-white/5 hover:text-white/70"
            aria-label="Close story bible"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!arc ? (
          <p className="text-xs italic text-white/30">
            No story arc is available for this story yet.
          </p>
        ) : (
          <>
            <Section icon={MapPin} title="Throughline">
              <p>{arc.storyArc || "(unspecified)"}</p>
              {arc.themes?.length > 0 && (
                <p className="mt-2 text-white/45">
                  <span className="text-white/30">Themes:</span> {arc.themes.join(", ")}
                </p>
              )}
              {arc.worldRules?.length > 0 && (
                <ul className="mt-2 list-disc space-y-0.5 pl-4 text-white/45">
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
                        <span className="shrink-0 font-mono text-[10px] text-neon-purple/70">Ch {p.chapter}</span>
                        <span>
                          {p.event}
                          {p.setup ? <span className="text-white/35"> — {p.setup}</span> : null}
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
                      <div className="font-medium text-white/75">{c.name}</div>
                      <div className="text-white/45">{c.journey}</div>
                      <div className="mt-0.5 text-[11px] text-white/35">
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
                    <div key={i} className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                      <div className="font-medium text-white/70">
                        {o.number}. {o.title}
                      </div>
                      <div className="text-white/40">{o.purpose}</div>
                      {o.keyBeats?.length > 0 && (
                        <div className="mt-1 text-[11px] text-white/35">{o.keyBeats.join(" · ")}</div>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {rollingSummary && (
              <Section icon={BookMarked} title="Narrative So Far">
                <p className="whitespace-pre-wrap">{rollingSummary}</p>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
