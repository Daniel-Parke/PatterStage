"use client";

import { useEffect, useState } from "react";

/**
 * Below md (768px) the rail is the drawer. This said lg (1024) until T-0128,
 * so a tablet with room to spare for the 64px icon column got the phone's
 * hamburger and sheet instead.
 */
const MOBILE_QUERY = "(max-width: 767px)";

/**
 * Between md and lg the rail is the icon column whatever the collapse
 * preference says: there is room for 64px beside a page at that width and
 * not for labels. At lg the preference is read again.
 */
export const TABLET_QUERY = "(min-width: 768px) and (max-width: 1023px)";

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
