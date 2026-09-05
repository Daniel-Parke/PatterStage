// ═══════════════════════════════════════════════════════════════
// ConceptHint — the word on the screen, and what it means
//
// Seventeen words carry this product: mission, run, gate, toolset, profile. An
// operator meets them on a screen and not in the docs, so the sentence that
// defines one has to be a press away from the word itself rather than a page
// they have to go and find.
//
// It is a disclosure, not a modal. Nothing is covered, no focus is trapped and
// the page does not stop scrolling: the panel is a small box beside the word,
// and Escape, a press elsewhere or focus leaving all put the screen back
// exactly as it was. That is also why the dialog hook is not used here — this
// control has no business joining the dialog stack for a definition.
//
// A word the corpus does not define renders as plain text with no control at
// all. public/help/ is generated at build time and git-ignored, so a fresh
// clone has no concepts whatsoever, and on those nine screens a button that
// opened an empty box would be worse than no button.
// ═══════════════════════════════════════════════════════════════

"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from "react";

import { useConcepts } from "@/components/help/HelpProvider";

export interface ConceptHintProps {
  /** A concepts.json id. An id the corpus does not carry renders as text. */
  id: string;
  /** The term as this screen words it. Defaults to the corpus's own term. */
  children?: ReactNode;
  className?: string;
}

export default function ConceptHint({ id, children, className }: ConceptHintProps) {
  const entry = useConcepts()[id];
  const [open, setOpen] = useState(false);
  // Two hints for the same word on one screen would otherwise point their
  // triggers at the same panel id, and a screen reader would read the first
  // definition for both.
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);

  // A press anywhere else is a dismissal. mousedown rather than click, so the
  // panel is gone before whatever was pressed reacts to it.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (wrapperRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  if (!entry) return <>{children}</>;

  const closeAndReturnFocus = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key !== "Escape" || !open) return;
    // The keystroke belongs to the panel while the panel is open: a Sheet or a
    // Modal further up must not also close because a definition was dismissed.
    event.stopPropagation();
    closeAndReturnFocus();
  };

  const handleBlur = (event: FocusEvent<HTMLSpanElement>) => {
    const next = event.relatedTarget;
    // No next target means the browser could not say where focus went (a click
    // on the page chrome, or jsdom). Leaving the panel up is the safer half of
    // that guess; the pointer and Escape paths both still close it.
    if (!next || wrapperRef.current?.contains(next)) return;
    setOpen(false);
  };

  return (
    // Spans throughout, and display comes from a class. These hints sit inside
    // paragraphs and headings, and a <div> inside a <p> is invalid HTML that
    // the parser recovers from by closing the paragraph early — the rendered
    // tree then stops matching the source (T-0071's lesson, one element down).
    <span ref={wrapperRef} className="relative inline-block" onKeyDown={handleKeyDown} onBlur={handleBlur}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-describedby={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={`border-b border-dotted border-neon-cyan/50 text-inherit transition-colors hover:text-neon-cyan ${className ?? ""}`}
      >
        {children ?? entry.term}
      </button>
      {open && (
        <span
          id={panelId}
          className="absolute left-0 top-full z-50 mt-1 block w-64 rounded-lg border border-white/10 bg-dark-900 p-3 text-left shadow-lg"
        >
          {/* Styled as a heading, not tagged as one. A real <h3> here would
              push an extra level into the outline of every screen that carries
              a hint, and it would come and go with the panel. */}
          <span className="block text-sm font-semibold text-white">{entry.term}</span>
          <span className="mt-1 block text-xs text-ps-text-secondary">{entry.short}</span>
          <Link
            href={`/help/${entry.slug}`}
            className="mt-2 inline-block text-xs text-neon-cyan hover:underline"
          >
            Read more about {entry.term}
          </Link>
        </span>
      )}
    </span>
  );
}
