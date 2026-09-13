// ═══════════════════════════════════════════════════════════════
// ui/field/Field — label + hint + error wrapper (the Field Kit primitive)
//
// One consistent label/spacing/typography frame for every form control, so
// inputs look and behave the same across the product (UX_AUDIT B3/B4/X1).
//
// The label is associated with its control BY CONSTRUCTION. `htmlFor` used to
// be an optional prop the caller had to remember, and callers forgot: a
// 2026-08-23 audit found number inputs on the Deep Research page rendering as
// unlabelled spinbuttons to a screen reader, even though a perfectly good
// label sat right above them on screen. A label that is only visual is not a
// label.
//
// So Field now mints an id and hands it to its control automatically. Passing
// `htmlFor` explicitly still wins, for the cases where the control already has
// an id of its own. If the child is not a single element (a fragment, a
// string, several nodes), Field leaves it alone and falls back to wrapping,
// which still associates the two for assistive tech.
// ═══════════════════════════════════════════════════════════════

import { Children, cloneElement, isValidElement, useId } from "react";
import type { ReactNode, ReactElement } from "react";

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className = "",
}: {
  label?: string;
  hint?: string;
  error?: string | null;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  const generatedId = useId();

  // Exactly one element child and no id of its own: give it one, so the label
  // can point at it. Anything else is left untouched.
  // Children.only() THROWS on a lone text node, so it cannot be used to ask
  // "is there exactly one element here". toArray is the safe question, and the
  // test for a bare-text child is what caught that.
  const kids = Children.toArray(children);
  const only = kids.length === 1 ? kids[0] : null;
  const child = isValidElement(only) ? (only as ReactElement<{ id?: string }>) : null;
  const childId = child?.props?.id;
  const controlId = htmlFor ?? childId ?? (child ? generatedId : undefined);

  const control =
    child && !childId && controlId ? cloneElement(child, { id: controlId }) : children;

  const described = error ? `${generatedId}-msg` : hint ? `${generatedId}-msg` : undefined;
  const describedControl =
    described && child && isValidElement(control)
      ? cloneElement(control as ReactElement<{ "aria-describedby"?: string }>, {
          "aria-describedby": described,
        })
      : control;

  return (
    <div className={`space-y-1 ${className}`}>
      {label ? (
        <label
          htmlFor={controlId}
          className="block text-micro font-medium uppercase tracking-wider text-ps-text-muted"
        >
          {label}
        </label>
      ) : null}
      {describedControl}
      {error ? (
        <p id={described} className="text-body text-neon-pink/80">
          {error}
        </p>
      ) : hint ? (
        <p id={described} className="text-body text-ps-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
