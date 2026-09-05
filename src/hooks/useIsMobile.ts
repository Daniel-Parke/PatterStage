// ═══════════════════════════════════════════════════════════════
// useIsMobile — is the shell below its desktop breakpoint?
//
// The rail is rendered once and is either the desktop rail or the phone's
// drawer depending on this answer (T-0097). It starts false on the server and
// on first paint, so the rail is never inert in HTML a crawler or a keyboard
// user reads before hydration; the effect corrects it on the first frame.
// jsdom has no matchMedia, so a test that wants the drawer mocks it.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useEffect, useState } from "react";

/** Tailwind's lg breakpoint is 1024px; below it the rail is the drawer. */
const MOBILE_QUERY = "(max-width: 1023px)";

export function useIsMobile(query: string = MOBILE_QUERY): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(query);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, [query]);
  return mobile;
}
