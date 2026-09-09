// stats/agent-progression.ts · the per-Body progression record, appended so
// recorded growth survives the deletion of the history it was derived from
// (WG-ARCH-003). Every progression number is otherwise derived on read from
// `runs` and `analytics_events`, and retention would silently un-earn it.
//
// What is captured is what the product already shows: the level half is
// `agentExperienceFromPerformance`, per profile (ADR-0004's per-Body rule); the
// achievement half is the dashboard's evaluated list filtered to the agent
// scope, Rec Room excluded (ADR-0004 decision 5). Achievements are computed ONCE
// for the whole install, so every row names its subject in `achievementsScope`
// (ADR-0004 decision 4) rather than claiming the Body earned them. The benchmark
// axis is DEFERRED by ADR-0004's amendment, so nothing of it is captured.
//
// A row is written when the profile has none, or when the recorded answer
// (level, XP, unlocked set) has moved. The retention prune (ADR-0009) passes
// `{ force: true }`: its interlock reads the newest row's timestamp, and only a
// row written just now is evidence for a deletion.
//
// Regression is recorded, not suppressed: the inputs are measured over a rolling
// window, and the append-only table keeps the earlier row as the high-water mark.

import { createHash } from "crypto";

import {
  ACHIEVEMENT_DEFS,
  achievementScope,
  type Achievement,
  type AchievementTier,
} from "./derive";
import { agentExperienceFromPerformance, type AgentExperienceSignals } from "./agent-experience";
import type { AgentPerformance } from "./agent-stats";
import { getDashboardStats } from "./stats-repository";
import {
  insertAgentProgressionSnapshots,
  readLatestAgentProgressionSnapshots,
  type AgentProgressionSnapshotRow,
  type AgentProgressionSnapshotWrite,
} from "./agent-progression-repository";

/**
 * The formula version. BUMP THIS whenever the stored answer could change for
 * unchanged inputs: the `AGENT_XP` weights, the level curve, the signal set, an
 * achievement's `measure` or `target`, or the tier-to-points table. It is what
 * separates "the agent grew" from "we changed the maths".
 */
export const AGENT_PROGRESSION_COMPUTATION_VERSION = 3;

// VERSION HISTORY
//   1 → 2  (T-0081) `runsCompleted` counts runs that COMPLETED, and `activeDays`
//          coalesces a NULL profile to "default". Version 1 rows are true about
//          what version 1 measured; they are not comparable to version 2 rows.

/** The only `achievementsScope` written today: computed once for the whole install, not per profile. */
export const ACHIEVEMENTS_SCOPE_INSTALL = "install";

/** One achievement as stored: the measurement, never the presentation. */
export interface CapturedAchievement {
  id: string;
  current: number;
  target: number;
  unlocked: boolean;
  tier: AchievementTier;
  points: number;
}

/**
 * Everything the two computations read. `measures` is keyed by achievement id
 * and holds what that achievement's own `measure` returned: the value that
 * decided the answer, immune to an unrelated metric being added, and built
 * after the Rec Room definitions are filtered out.
 */
export interface AgentProgressionInputs {
  signals: AgentExperienceSignals;
  measures: Record<string, number>;
}

/** A computed record, ready to append. */
export interface AgentProgressionRecord {
  profileSlug: string;
  level: number;
  levelTitle: string;
  xp: number;
  achievementsScope: string;
  achievements: CapturedAchievement[];
  inputs: AgentProgressionInputs;
  /** The canonical JSON of `inputs`; hashing this yields `inputsDigest`. */
  inputsJson: string;
  inputsDigest: string;
  computationVersion: number;
}

/** Ids of the achievements that describe the Body (ADR-0004 decision 5 excludes the rest). */
const AGENT_SCOPED_IDS = new Set(
  ACHIEVEMENT_DEFS.filter((d) => achievementScope(d) === "agent").map((d) => d.id),
);

/** Recursively sort object keys so two equal inputs always serialise identically. */
function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) out[key] = canonicalise(source[key]);
    return out;
  }
  return value;
}

/**
 * Canonical JSON of the inputs and its sha256, from one call, so the stored
 * `inputs_json` is always the preimage of `inputs_digest` and a later reader
 * can verify a row with nothing but a hash.
 */
export function digestInputs(inputs: AgentProgressionInputs): { json: string; digest: string } {
  const json = JSON.stringify(canonicalise(inputs));
  return { json, digest: createHash("sha256").update(json).digest("hex") };
}

/** Keep the agent-scoped achievements, in a stable order, as the measurement only. */
export function agentScopedAchievements(evaluated: Achievement[]): CapturedAchievement[] {
  return evaluated
    .filter((a) => AGENT_SCOPED_IDS.has(a.id))
    .map((a) => ({
      id: a.id,
      current: a.current,
      target: a.target,
      unlocked: a.unlocked,
      tier: a.tier,
      points: a.points,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Build one profile's record. Pure: the same inputs return the same bytes. */
export function buildAgentProgressionRecord(
  perf: AgentPerformance,
  achievements: CapturedAchievement[],
): AgentProgressionRecord {
  const experience = agentExperienceFromPerformance(perf);
  const measures: Record<string, number> = {};
  for (const a of achievements) measures[a.id] = a.current;

  const inputs: AgentProgressionInputs = { signals: experience.signals, measures };
  const { json, digest } = digestInputs(inputs);

  return {
    profileSlug: experience.slug,
    level: experience.level.level,
    levelTitle: experience.level.title,
    xp: experience.xp,
    achievementsScope: ACHIEVEMENTS_SCOPE_INSTALL,
    achievements,
    inputs,
    inputsJson: json,
    inputsDigest: digest,
    computationVersion: AGENT_PROGRESSION_COMPUTATION_VERSION,
  };
}

/**
 * The answer as one comparable string: level, XP and the unlocked ids. Progress
 * toward a locked achievement is left out, or every token processed would append a row.
 */
function answerKey(level: number, xp: number, achievements: CapturedAchievement[]): string {
  const unlocked = achievements
    .filter((a) => a.unlocked)
    .map((a) => a.id)
    .sort()
    .join(",");
  return `${level}|${xp}|${unlocked}`;
}

/** The answer a stored row carries. An unparseable row reads as "different", so a fresh one is appended. */
function storedAnswerKey(row: AgentProgressionSnapshotRow): string | null {
  try {
    const parsed = JSON.parse(row.achievementsJson) as CapturedAchievement[];
    if (!Array.isArray(parsed)) return null;
    return answerKey(row.level, row.xp, parsed);
  } catch {
    return null;
  }
}

/** True when this record says something the newest stored row does not already say. */
export function isCorrection(
  record: AgentProgressionRecord,
  previous: AgentProgressionSnapshotRow | undefined,
): boolean {
  if (!previous) return true;
  const before = storedAnswerKey(previous);
  if (before === null) return true;
  return before !== answerKey(record.level, record.xp, record.achievements);
}

/** How a capture behaves when the answer has not moved. */
export interface CaptureAgentProgressionOptions {
  /**
   * Append a row for every profile even when unchanged. Only the retention
   * prune sets this, immediately before deleting (see the header).
   */
  force?: boolean;
}

/**
 * Capture every agent profile, appending a row for each whose answer has moved;
 * returns the rows appended. Takes the dashboard aggregate's own outputs so the
 * record is the answer it just gave, not a second one from a moved database.
 * Throws on a database failure: swallowing would report a refused write as
 * "nothing to do".
 */
export function captureAgentProgressionSnapshots(
  input: {
    agents: AgentPerformance[];
    achievements: Achievement[];
  },
  options: CaptureAgentProgressionOptions = {},
): number {
  const achievements = agentScopedAchievements(input.achievements);
  const previous = new Map(
    readLatestAgentProgressionSnapshots().map((row) => [row.profileSlug, row]),
  );

  const pending: AgentProgressionSnapshotWrite[] = [];
  for (const perf of input.agents) {
    const record = buildAgentProgressionRecord(perf, achievements);
    if (!options.force && !isCorrection(record, previous.get(record.profileSlug))) continue;
    pending.push({
      profileSlug: record.profileSlug,
      level: record.level,
      levelTitle: record.levelTitle,
      xp: record.xp,
      achievementsScope: record.achievementsScope,
      achievementsJson: JSON.stringify(record.achievements),
      inputsJson: record.inputsJson,
      inputsDigest: record.inputsDigest,
      computationVersion: record.computationVersion,
    });
  }

  return insertAgentProgressionSnapshots(pending);
}

/**
 * Capture from the live dashboard computation, for a reader that has not
 * already paid for it. Capture used to happen only in `GET /api/stats`, so an
 * install driven over HTTP never captured and `GET /api/agents/progression`
 * read rows never written: finding 12's RC-A. It stays a correction, not a
 * heartbeat. It does not swallow: the caller guards and logs, as `GET /api/stats`
 * always has, so a capture that stopped working stays visible.
 */
export function captureAgentProgressionFromLiveStats(): number {
  const stats = getDashboardStats();
  return captureAgentProgressionSnapshots({
    agents: stats.agents,
    achievements: stats.achievements,
  });
}
