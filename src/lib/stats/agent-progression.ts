// ═══════════════════════════════════════════════════════════════
// stats/agent-progression.ts · capture the per-Body record, so growth outlives
// the history it was derived from
//
// THE PROBLEM THIS SOLVES. Every progression number in PatterStage is derived on
// read. An agent's level and XP come out of `runs`; its achievements come out of
// `analytics_events` plus the live mission, session and schedule counts. Nothing
// is stored. That is fine while history is kept forever, and it stops being fine
// the moment retention starts deleting rows: the next read returns smaller
// numbers, an earned achievement silently un-earns itself, and no reader can
// tell that apart from it never having been earned. WG-ARCH-003 rules that
// recorded growth survives the deletion of the history it came from, and this is
// the capture side of that.
//
// WHAT IS CAPTURED, and why it is exactly what the product already shows. The
// design brief for this work was to snapshot what the UI shows now rather than
// to invent a better computation, so:
//
//   the level half        is `agentExperienceFromPerformance`, the same call
//                         behind AgentGrowthPanel and the dashboard hero badge.
//                         Per-profile, per ADR-0004's per-Body rule.
//
//   the achievement half  is the evaluated achievement list the dashboard
//                         renders, filtered to the agent scope. Rec Room
//                         creative activity is excluded because ADR-0004
//                         decision 5 says it never touches the agent's record.
//
// One honesty note, and it is the reason `achievementsScope` exists as a stored
// field rather than an assumption. Achievements today are computed ONCE for the
// whole install: there is no per-profile achievement computation anywhere in the
// product. Writing that install-wide set onto a per-profile row without saying
// so would make the row claim the Body earned them. So every row names its
// subject, which is ADR-0004 decision 4 applied to storage, and the day a
// per-Body computation lands the older rows still read honestly.
//
// The benchmark axis is NOT here. ADR-0004's amendment marks it DEFERRED with no
// implementation, so there is nothing to capture and nothing to resurrect.
//
// WHEN A ROW IS WRITTEN. When the profile has no row yet, or when the recorded
// ANSWER has moved: the level, the XP, or the set of unlocked achievements. An
// unchanged answer needs no correction, so the steady state is one row per agent
// profile and the table grows only when an agent actually does.
//
// THE ONE EXCEPTION IS THE RETENTION PRUNE (ADR-0009), which passes
// `{ force: true }`. Lazy capture is right for the dashboard's 20-second poll
// and wrong immediately before a deletion: an install whose answer has not moved
// for months has a months-old newest row, and the prune's interlock reads the
// newest row's timestamp to decide what it is allowed to delete. Forcing a row
// makes that timestamp NOW, so the interlock passes on the strength of a capture
// that genuinely just happened rather than on a stale one. The cost is one row
// per profile per applied prune, which is the cheapest possible price for the
// only guarantee this table exists to provide.
//
// Regression is recorded, not suppressed. The achievement inputs are measured
// over a rolling window, so a value can fall and an unlocked achievement can
// read as locked again. The append-only table is what makes that safe: the
// earlier row still says the achievement was unlocked, because nothing is ever
// rewritten. That is the high-water mark, held by the ledger rather than by a
// max() somebody has to remember to write.
// ═══════════════════════════════════════════════════════════════

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
 * unchanged inputs: the `AGENT_XP` weights, the level curve, the signal set, the
 * achievement definitions' `measure` or `target`, or the tier-to-points table.
 *
 * It is what separates "the level moved because the agent grew" from "the level
 * moved because we changed the maths". Two rows with the same `inputsDigest` and
 * different answers are the second case; without this number they are
 * indistinguishable from each other and the record stops being evidence.
 */
export const AGENT_PROGRESSION_COMPUTATION_VERSION = 3;

// VERSION HISTORY
//   1 → 2  (T-0081) The `runsCompleted` signal stopped counting every run and
//          started counting runs that COMPLETED, and `activeDays` began
//          coalescing a NULL profile to "default" the way its sibling aggregate
//          always had. Both change the stored answer for unchanged history,
//          which is exactly what this number exists to separate from an agent
//          having grown. Rows written at version 1 are still true about what
//          version 1 measured; they are not comparable to version 2 rows.

/**
 * The only `achievementsScope` value written today: the achievements were
 * computed once for the whole install, not for this profile.
 */
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
 * Everything the two computations read, and nothing else.
 *
 * `measures` is keyed by achievement id and holds the value that achievement's
 * own `measure` returned. Keying by id rather than storing the raw metrics
 * bundle is deliberate: it is the value that actually decided the answer, it
 * cannot drift when an unrelated metric is added, and it cannot carry a Rec Room
 * count into an agent's record by accident, because the Rec Room definitions are
 * filtered out before this is built.
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
 * Serialise the inputs canonically and hash that exact string.
 *
 * Both halves are returned together so the stored `inputs_json` is always the
 * preimage of the stored `inputs_digest`. That is what lets a later reader
 * verify a row with nothing but a sha256: hash the stored JSON, compare. It also
 * means the digest cannot drift from the JSON through a later edit to one and
 * not the other, because there is one call and no second path.
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

/**
 * Build one profile's record. Pure: given the same performance row, the same
 * active-day count and the same achievements, it returns the same bytes.
 */
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
 * The recorded answer, reduced to one comparable string: level, XP and the set
 * of unlocked achievement ids. Progress toward a still-locked achievement is
 * deliberately NOT part of it, or every token processed would append a row.
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
   * Append a row for every profile even when its answer is unchanged.
   *
   * Only the retention prune sets this, and only immediately before deleting.
   * See the header: the prune's interlock is a timestamp, and a timestamp is
   * only evidence if something actually wrote it just now.
   */
  force?: boolean;
}

/**
 * Capture the current progression for every agent profile, appending a row for
 * each one whose answer has moved. Returns the number of rows appended.
 *
 * Takes the dashboard aggregate's own outputs rather than recomputing them: the
 * caller has already measured every agent's performance and evaluated every
 * achievement, and this records the answer it just gave rather than a second
 * answer computed a moment later from a moved database.
 *
 * It throws on a database failure. The route that calls it decides what that
 * means; swallowing here would report a refused write as "nothing to do", which
 * is the one lie this record cannot afford.
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
 * already paid for it.
 *
 * WHY A READER WRITES. Capture used to happen in exactly one place: inside
 * `GET /api/stats`, the dashboard poll. So an install driven over HTTP -- a QA
 * pass, a scripted operator, anything that never opens the dashboard -- never
 * captured, and `GET /api/agents/progression` answered with rows that had never
 * been written. Spend read live and progression read stored, and the two
 * disagreed. That asymmetry was the whole of finding 12's RC-A.
 *
 * It stays a CORRECTION, not a heartbeat: `captureAgentProgressionSnapshots`
 * writes only when the recorded answer has moved, so a reader polled every
 * twenty seconds still produces one row per agent per genuine change.
 *
 * IT DOES NOT SWALLOW. The caller guards and LOGS, which is what
 * `GET /api/stats` has always done. A swallow here would have been a second
 * rule for the same thing and a quieter one: the error would vanish rather
 * than reach the log, and a capture that had stopped working would look
 * exactly like one that had nothing to write.
 */
export function captureAgentProgressionFromLiveStats(): number {
  const stats = getDashboardStats();
  return captureAgentProgressionSnapshots({
    agents: stats.agents,
    achievements: stats.achievements,
  });
}
