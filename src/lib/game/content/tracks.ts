import type { ColorName } from "../types";

export interface TrackDef {
  id: string;
  name: string;
  icon: string;
  color: ColorName;
  /** Key into the engine's per-track XP map (see engine.ts). */
  metric: string;
  description: string;
}

/** Per-domain mastery tracks — each levels independently from real activity. */
export const TRACKS: TrackDef[] = [
  { id: "operative", name: "Operative", icon: "Rocket", color: "cyan", metric: "missionXp", description: "Dispatching + completing missions" },
  { id: "conductor", name: "Conductor", icon: "Clock", color: "orange", metric: "automationXp", description: "Schedules + scripts on a timer" },
  { id: "archivist", name: "Archivist", icon: "Database", color: "pink", metric: "memoryXp", description: "Memory + hindsight curation" },
  { id: "loremaster", name: "Loremaster", icon: "BookOpen", color: "purple", metric: "storyXp", description: "Story Weaver craft" },
  { id: "engineer", name: "Engineer", icon: "Cpu", color: "green", metric: "modelXp", description: "Models + provider config" },
  { id: "diplomat", name: "Diplomat", icon: "MessageCircle", color: "cyan", metric: "sessionXp", description: "Chat + session work" },
];
