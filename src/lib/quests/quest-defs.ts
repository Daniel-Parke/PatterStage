// ═══════════════════════════════════════════════════════════════
// quest-defs.ts — the quests, as data
//
// Decision 4: a real-action quest system, tracked by the analytics events that
// already exist. Every quest here is proved by a fact the server already holds,
// which is the whole design: a quest an operator can tick by clicking a
// checkbox teaches nothing, and one proved by a number nobody records cannot be
// ticked at all.
//
// Content, not code. The chapters, their titles, the sentences and the proofs
// live here so that `docs/quests.md` can be generated from them and so that a
// gate can check every screen is a real route, every event is in the taxonomy
// and every achievement is one that exists. Nothing here reads a database, a
// clock or the environment.
//
// The only imports are TYPE-ONLY. derive.ts imports the counters below as
// values for its chain achievements, so a value import back the other way would
// close a runtime cycle; a type import erases.
// ═══════════════════════════════════════════════════════════════

import type { AnalyticsEventType } from "@/lib/analytics/event-types";
import type { RawMetrics, StoreFacts } from "@/lib/stats/derive";

/**
 * The nouns a quest can teach, from the vocabulary decision 5 fixed and B15
 * wrote a page for. Each id is the basename of a page under docs/concepts/, so
 * a Teaches chip can become a ConceptHint with no second list.
 *
 * @public The list is what makes ConceptId a closed type, so a quest cannot
 * teach a noun the corpus does not define. Read at compile time by every
 * `teaches:` array below rather than at run time, which is exactly the point:
 * the check happens before anything ships.
 */
export const CONCEPT_IDS = [
  "agent",
  "prompt",
  "model",
  "provider",
  "api-key",
  "profile",
  "personality",
  "skill",
  "tool",
  "toolset",
  "memory",
  "session",
  "transcript",
  "mission",
  "run",
  "schedule",
  "workflow",
  "gate",
  "artifact",
  "spend",
] as const;

export type ConceptId = (typeof CONCEPT_IDS)[number];

/** What a Teaches chip says. The concept pages carry the same words. */
export const CONCEPT_LABELS: Record<ConceptId, string> = {
  agent: "Agent",
  prompt: "Prompt",
  model: "Model",
  provider: "Provider",
  "api-key": "API key",
  profile: "Profile",
  personality: "Personality",
  skill: "Skill",
  tool: "Tool",
  toolset: "Toolset",
  memory: "Memory",
  session: "Session",
  transcript: "Transcript",
  mission: "Mission",
  run: "Run",
  schedule: "Schedule",
  workflow: "Workflow",
  gate: "Gate",
  artifact: "Artifact",
  spend: "Spend",
};

/** What a host must have before a quest is even attemptable. */
export type QuestRequirement = "gateway" | "memory" | "composer" | "host-scheduler";

/**
 * What a host cannot do, said to the operator.
 *
 * Data rather than JSX so copy-lint and the oracle can read it, and so the four
 * sentences sit together where they can be compared. Each says what is missing
 * AND what would change it: "unavailable" with no way forward is a dead end
 * wearing an explanation's clothes.
 */
export const HOST_REQUIREMENT_COPY: Record<QuestRequirement, string> = {
  gateway:
    "No agent is reachable yet: install the agent on this machine, or point PatterStage at a gateway, and this one unlocks.",
  // Until T-0113 this could not render: the capability behind it was true on
  // every install, so the sentence stopped at what was missing. It shows now,
  // so it names the way out, like the other three.
  memory:
    "No memory provider is answering, so there is nothing to retain a fact into yet. Connect one on the Memory screen and this one unlocks.",
  composer:
    "The Composer is switched off on this install (PS_COMPOSER). Turn it on to run a workflow.",
  "host-scheduler":
    "Host script scheduling is not available on native Windows. Run PatterStage under WSL2, or wait for PatterStage's own scheduler to take over scripts.",
};

/** How a quest's completion is derived. Exactly one of these two shapes. */
export type QuestProof =
  | { kind: "event"; event: AnalyticsEventType; target: number }
  | { kind: "fact"; fact: keyof StoreFacts; target: number };

export interface QuestDef {
  /** "<chapter>.<step>", which is how the plan addresses them. */
  id: string;
  chapter: number;
  title: string;
  /** One sentence, second person, ending in a full stop. */
  action: string;
  proof: QuestProof;
  /** A registry route, verbatim: no query string, no hash, no trailing slash. */
  screen: string;
  teaches: ConceptId[];
  requires?: QuestRequirement;
  /** An id in ACHIEVEMENT_DEFS. */
  earns?: string;
}

export interface QuestChapter {
  number: number;
  id: string;
  title: string;
  /** One sentence: what the operator can do once the chapter is done. */
  blurb: string;
  /** Untracked pointers: worth seeing, nothing to prove. */
  seeAlso?: { label: string; href: string }[];
}

export const QUEST_CHAPTERS: readonly QuestChapter[] = [
  {
    number: 1,
    id: "get-running",
    title: "Get running",
    blurb: "An agent that can answer, and one piece of work you gave it, finished.",
  },
  {
    number: 2,
    id: "missions",
    title: "Missions",
    blurb: "Work you can save, repeat, put on a clock, and call off.",
  },
  {
    number: 3,
    id: "shape-your-agent",
    title: "Shape your agent",
    blurb: "An agent that sounds like you want it to and reaches only for what you allow.",
  },
  {
    number: 4,
    id: "automate-and-watch",
    title: "Automate and watch",
    blurb: "Your own scripts on a timer, and the record of what they did.",
  },
  {
    number: 5,
    id: "multi-stage-work",
    title: "Multi-stage work",
    blurb: "Several runs wired together, with you in the loop where it matters.",
  },
  {
    number: 6,
    id: "rec-room",
    title: "Rec Room",
    blurb: "The same machinery, pointed at something long and made up.",
  },
  {
    number: 7,
    id: "keep-it-healthy",
    title: "Keep it healthy",
    blurb: "A copy of everything, taken before you need it.",
  },
];

const ev = (event: AnalyticsEventType, target = 1): QuestProof => ({ kind: "event", event, target });
const fact = (f: keyof StoreFacts, target = 1): QuestProof => ({ kind: "fact", fact: f, target });

/**
 * The thirty-two quests.
 *
 * Two of them do not prove quite what their sentence asks, and both say so
 * here rather than pretending. 2.1 asks for a template and is proved by a
 * SECOND dispatch, because the ledger counts dispatches and carries no metadata
 * about where the prompt came from. 4.4 asks the operator to read a transcript
 * and is proved by one ARRIVING, because reading a session is not a write.
 */
export const QUEST_DEFS: readonly QuestDef[] = [
  // ── 1 Get running ────────────────────────────────────────────
  {
    id: "1.1",
    chapter: 1,
    title: "Add a model",
    action: "Add a model on the Models page, so the agent has something to think with.",
    proof: ev("model.added"),
    screen: "/agent/models",
    teaches: ["model", "provider"],
  },
  {
    id: "1.2",
    chapter: 1,
    title: "Add a credential",
    action: "Add the API key your provider needs. Skip this one if your provider is keyless.",
    proof: ev("credential.added"),
    screen: "/agent/models",
    teaches: ["api-key", "provider"],
  },
  {
    id: "1.3",
    chapter: 1,
    title: "Send a first message",
    action: "Say something to your agent in Chat and read what comes back.",
    proof: ev("chat.message_sent"),
    screen: "/work/chat",
    teaches: ["agent", "prompt"],
    requires: "gateway",
    earns: "first-words",
  },
  {
    id: "1.4",
    chapter: 1,
    title: "Dispatch a mission",
    action: "Write one piece of work on the Missions page and dispatch it.",
    proof: ev("mission.dispatched"),
    screen: "/work/missions",
    teaches: ["mission", "run"],
    requires: "gateway",
  },
  {
    id: "1.5",
    chapter: 1,
    title: "See it finish",
    action: "Wait for that mission to finish, then open its session and read the transcript.",
    proof: ev("mission.completed"),
    screen: "/results/sessions",
    teaches: ["session", "transcript"],
    requires: "gateway",
    earns: "first-contact",
  },

  // ── 2 Missions ───────────────────────────────────────────────
  {
    id: "2.1",
    chapter: 2,
    title: "Use a template",
    action: "Load one of the mission templates, adjust it, and dispatch that.",
    proof: ev("mission.dispatched", 2),
    screen: "/work/missions",
    teaches: ["mission"],
    requires: "gateway",
  },
  {
    id: "2.2",
    chapter: 2,
    title: "Save a template",
    action: "Save a mission you would write again as a template of your own.",
    proof: ev("template.saved"),
    screen: "/work/missions",
    teaches: ["mission"],
  },
  {
    id: "2.3",
    chapter: 2,
    title: "Put it on a schedule",
    action: "Give a mission a schedule, so it runs without you starting it.",
    proof: ev("schedule.created"),
    screen: "/work/missions",
    teaches: ["schedule"],
    earns: "automator",
  },
  {
    id: "2.4",
    chapter: 2,
    title: "Watch it fire",
    action: "Come back after the schedule is due and find the run it started.",
    proof: ev("schedule.fired"),
    screen: "/results/sessions",
    teaches: ["schedule", "run"],
  },
  {
    id: "2.5",
    chapter: 2,
    title: "Cancel a mission",
    action: "Stop a mission you no longer want, before it finishes.",
    proof: ev("mission.cancelled"),
    screen: "/work/missions",
    teaches: ["run"],
  },

  // ── 3 Shape your agent ───────────────────────────────────────
  {
    id: "3.1",
    chapter: 3,
    title: "Add a second profile",
    action: "Create a second agent profile, so one agent can work more than one way.",
    proof: fact("profiles", 2),
    screen: "/agent/profiles",
    teaches: ["profile"],
  },
  {
    id: "3.2",
    chapter: 3,
    title: "Give it a personality",
    action: "Write the voice you want that profile to use, on its Identity tab.",
    proof: ev("personality.changed"),
    screen: "/agent/profiles",
    teaches: ["personality", "profile"],
  },
  {
    id: "3.3",
    chapter: 3,
    title: "Toggle a skill",
    action: "Turn a skill on or off and see what the profile is allowed to follow.",
    proof: ev("skill.toggled"),
    screen: "/agent/skills",
    teaches: ["skill"],
  },
  {
    id: "3.4",
    chapter: 3,
    title: "Save a toolset",
    action: "Choose which toolsets this profile may reach for, and save them.",
    proof: ev("toolset.saved"),
    screen: "/agent/tools",
    teaches: ["tool", "toolset"],
  },
  {
    id: "3.5",
    chapter: 3,
    title: "Save a settings section",
    action: "Change one thing in Settings and save it, so the agent reads it next run.",
    proof: ev("config.saved"),
    screen: "/agent/settings",
    teaches: ["agent"],
  },
  {
    id: "3.6",
    chapter: 3,
    title: "Connect memory",
    action: "Point PatterStage at a memory provider and test the connection.",
    proof: fact("memoryConfigured"),
    screen: "/agent/memory",
    teaches: ["memory"],
  },
  {
    id: "3.7",
    chapter: 3,
    title: "Retain a fact",
    action: "Give the agent one thing worth remembering between runs.",
    proof: ev("memory.retained"),
    screen: "/agent/memory",
    teaches: ["memory"],
    requires: "memory",
  },
  {
    id: "3.8",
    chapter: 3,
    title: "Push to Hermes",
    action: "Push a profile to the agent on disk, so the two agree.",
    proof: ev("profile.pushed"),
    screen: "/agent/profiles",
    teaches: ["profile"],
  },

  // ── 4 Automate and watch ─────────────────────────────────────
  {
    id: "4.1",
    chapter: 4,
    title: "Save a script",
    action: "Write a small script of your own and save it.",
    proof: ev("script.saved"),
    screen: "/work/scripts",
    teaches: ["run"],
  },
  {
    id: "4.2",
    chapter: 4,
    title: "Run it",
    action: "Run that script once by hand and read its output.",
    proof: ev("script.run"),
    screen: "/work/scripts",
    teaches: ["run"],
  },
  {
    id: "4.3",
    chapter: 4,
    title: "Schedule it",
    action: "Put the script on a timer, so it runs without you.",
    proof: ev("script.scheduled"),
    screen: "/work/scripts",
    teaches: ["schedule"],
    requires: "host-scheduler",
  },
  {
    id: "4.4",
    chapter: 4,
    title: "Read a transcript",
    action: "Open a session and read what the agent actually said and did.",
    proof: ev("session.started"),
    screen: "/results/sessions",
    teaches: ["session", "transcript"],
  },
  {
    id: "4.5",
    chapter: 4,
    title: "Read its artifact",
    action: "Open something your agent produced and read it in full.",
    proof: ev("artifact.opened"),
    screen: "/results/artifacts",
    teaches: ["artifact"],
  },
  {
    id: "4.6",
    chapter: 4,
    title: "Read the logs",
    action: "Open a log file and see what the host itself recorded.",
    proof: ev("logs.opened"),
    screen: "/results/logs",
    teaches: [],
  },

  // ── 5 Multi-stage work ───────────────────────────────────────
  {
    id: "5.1",
    chapter: 5,
    title: "Run the starter workflow",
    action: "Run one of the workflows that ships with PatterStage, start to finish.",
    proof: ev("composer.run_started"),
    screen: "/work/composer",
    teaches: ["workflow"],
    requires: "composer",
  },
  {
    id: "5.2",
    chapter: 5,
    title: "Approve a gate",
    action: "Answer a workflow that stopped to ask you, and let it carry on.",
    proof: ev("composer.gate_approved"),
    screen: "/work/composer",
    teaches: ["gate", "workflow"],
    requires: "composer",
  },
  {
    id: "5.3",
    chapter: 5,
    title: "Run Deep Research",
    action: "Ask a research question and let the agent go and read for you.",
    proof: ev("research.started"),
    screen: "/work/research",
    teaches: ["artifact"],
    requires: "gateway",
  },
  {
    id: "5.4",
    chapter: 5,
    title: "Save an artifact",
    action: "Keep something the agent produced, so it outlives the run.",
    proof: ev("artifact.saved"),
    screen: "/results/artifacts",
    teaches: ["artifact"],
  },

  // ── 6 Rec Room ───────────────────────────────────────────────
  {
    id: "6.1",
    chapter: 6,
    title: "Start a story",
    action: "Give the Story Weaver a premise and let it plan the chapters.",
    proof: ev("story.created"),
    screen: "/recroom/story-weaver",
    teaches: ["prompt"],
    earns: "storyteller",
  },
  {
    id: "6.2",
    chapter: 6,
    title: "Write a chapter",
    action: "Ask for one chapter and read it.",
    proof: ev("story.chapter_generated"),
    screen: "/recroom/story-weaver",
    teaches: ["model"],
  },
  {
    id: "6.3",
    chapter: 6,
    title: "Finish a story",
    action: "Keep writing until every chapter is done.",
    proof: ev("story.completed"),
    screen: "/recroom/story-weaver",
    teaches: [],
  },

  // ── 7 Keep it healthy ────────────────────────────────────────
  {
    id: "7.1",
    chapter: 7,
    title: "Take a backup",
    action: "Take a copy of your database, before the day you need one.",
    proof: ev("backup.taken"),
    screen: "/agent/settings/system",
    teaches: [],
  },
];

/** What a host has. Every field is TRUE while unknown: see questAvailable. */
export interface QuestHostCapabilities {
  gateway: boolean;
  memory: boolean;
  composer: boolean;
  hostScheduler: boolean;
}

/**
 * Can this host attempt this quest?
 *
 * A quest with no `requires` is always available. The default for an UNREAD
 * capability is true, decided at the call site rather than here: a quest hidden
 * because a status endpoint had not answered yet would be a quest the operator
 * never sees on a slow morning.
 */
export function questAvailable(
  def: { requires?: QuestRequirement },
  host: QuestHostCapabilities,
): boolean {
  switch (def.requires) {
    case undefined:
      return true;
    case "gateway":
      return host.gateway;
    case "memory":
      return host.memory;
    case "composer":
      return host.composer;
    case "host-scheduler":
      return host.hostScheduler;
  }
}

/**
 * Is this proof met by these metrics?
 *
 * A boolean fact is met when it is true; a numeric one when it reaches the
 * target. Pure: no IO, no clock, no environment. Everything that decides
 * whether a quest is done goes through here, so there is one answer rather than
 * one per surface.
 */
export function proofMet(proof: QuestProof, m: RawMetrics): boolean {
  if (proof.kind === "event") return (m.eventCounts[proof.event] ?? 0) >= proof.target;
  const value = m.facts[proof.fact];
  return typeof value === "boolean" ? value === true : value >= proof.target;
}

export function questsInChapter(chapter: number): readonly QuestDef[] {
  return QUEST_DEFS.filter((q) => q.chapter === chapter);
}

/**
 * How many of a chapter's quests the metrics prove.
 *
 * The chain achievements measure THIS rather than the latch, because
 * evaluateAchievements runs before evaluateQuests and must not depend on it.
 * The achievements' own high-water mark is the progression ledger, as it is for
 * every other achievement.
 */
export function questsMetInChapter(m: RawMetrics, chapter: number): number {
  return questsInChapter(chapter).filter((q) => proofMet(q.proof, m)).length;
}

/** How many of all thirty-two the metrics prove. Feeds `curriculum`. */
export function questsMet(m: RawMetrics): number {
  return QUEST_DEFS.filter((q) => proofMet(q.proof, m)).length;
}
