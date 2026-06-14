// Account + mastery-track progression. Reuses the v1 XP/level/streak math from
// stats/derive so there is a single curve across the app.

import { computeLevel, computeXp, computeStreaks } from "@/lib/stats/derive";
import { rankForLevel } from "./content/ranks";
import { TRACKS } from "./content/tracks";
import type { MasteryTrack } from "./types";

export { computeLevel, computeXp, computeStreaks, rankForLevel };

/** Build the mastery tracks from a per-track XP map (keyed by TrackDef.metric). */
export function computeTracks(trackXp: Record<string, number>): MasteryTrack[] {
  return TRACKS.map((t) => {
    const xp = Math.max(0, Math.round(trackXp[t.metric] ?? 0));
    return { id: t.id, name: t.name, icon: t.icon, color: t.color, xp, level: computeLevel(xp) };
  });
}
