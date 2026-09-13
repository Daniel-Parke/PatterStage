// ═══════════════════════════════════════════════════════════════
// HelpProvider — the two small Help indexes, handed to the client once
//
// The root layout reads public/help/ off disk on the server and passes the
// results down as props. Nothing under here fetches, which is what keeps Help
// working on an instance behind the cookie with no network: the answers
// travelled with the HTML.
//
// The default value is the empty pair, and that is load bearing rather than
// tidy. A header mounted with no provider above it — a unit test rendering
// PageHeader on its own, an error boundary's fallback — still has to render,
// and the honest answer to "which guide documents this screen" with no
// manifest is "none yet", not a thrown context error.
// ═══════════════════════════════════════════════════════════════

"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { ConceptIndex, HelpScreenIndex } from "@/lib/help/help-manifest";

export interface HelpContextValue {
  screens: HelpScreenIndex;
  concepts: ConceptIndex;
}

const NO_HELP: HelpContextValue = { screens: {}, concepts: {} };

const HelpContext = createContext<HelpContextValue>(NO_HELP);

export function HelpProvider({
  screens,
  concepts,
  children,
}: HelpContextValue & { children: ReactNode }) {
  // Both indexes are read once per process on the server, so their identities
  // only change when the layout itself is re-rendered with a rebuilt corpus.
  const value = useMemo(() => ({ screens, concepts }), [screens, concepts]);
  return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>;
}

/** Registry route to help slug. `{}` until the corpus has been built. */
export function useHelpScreens(): HelpScreenIndex {
  return useContext(HelpContext).screens;
}

/** Concept id to its one-line definition. `{}` until the corpus has been built. */
export function useConcepts(): ConceptIndex {
  return useContext(HelpContext).concepts;
}
