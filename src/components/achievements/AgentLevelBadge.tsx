"use client";

// ═══════════════════════════════════════════════════════════════
// AgentLevelBadge — the agent's accumulated growth
//
// Replaces AgentRatingBadge. That badge's ring showed a 0-100 Agent Rating from
// the latest benchmark run, and the level was a sublabel under it. The benchmark
// subsystem is gone (org/decisions/ADR-0004), and with it the rating: its suites were all
// closed-book, so skills, tools and memory could not move the number the rating
// claimed to measure.
//
// What survives is the honest half, and it is now the subject rather than the
// footnote: every input is something the agent actually did or was given
// (completed runs, active days, enabled skills, attached toolsets, memory
// facts). The ring shows progress toward the next level, which is a real
// quantity, instead of a capability score computed from content that could not
// discriminate.
// ═══════════════════════════════════════════════════════════════

import ProgressRing from "@/components/viz/ProgressRing";
import { type NeonColor } from "@/components/viz/colors";

function levelNeon(level: number): NeonColor {
  if (level >= 20) return "green";
  if (level >= 10) return "cyan";
  if (level >= 5) return "yellow";
  return "purple";
}

export default function AgentLevelBadge({
  experience,
  label,
}: {
  experience: { level: number; title: string; progress: number } | null;
  label?: string;
}) {
  const color: NeonColor = experience ? levelNeon(experience.level) : "cyan";
  return (
    <div className="flex items-center gap-3">
      <ProgressRing
        value={experience ? experience.progress : 0}
        color={color}
        size={64}
        thickness={6}
        label={<span className="text-title font-bold">{experience ? experience.level : "—"}</span>}
        sublabel="LEVEL"
      />
      <div className="min-w-0">
        <div className="truncate font-mono text-body font-semibold text-ps-text-primary">{label ?? "Agent"}</div>
        {experience ? (
          <div className="text-body text-neon-purple">{experience.title}</div>
        ) : (
          <div className="text-body text-ps-text-muted">Run a mission to start growing this agent</div>
        )}
      </div>
    </div>
  );
}
