"use client";

// ═══════════════════════════════════════════════════════════════
// AgentGrowthPanel — what this agent has accumulated
//
// Replaces AgentBenchmarkPanel, which showed the experience level next to an
// Agent Rating and a six-axis stat radar. The rating and the radar are gone with
// the benchmark subsystem (org/decisions/ADR-0004): the suites were all closed-book, so
// skills, tools and memory could not move the number, and the radar's axes came
// from hand-picked domain weights with no stated basis.
//
// What is left is every input that was ever a fact rather than a score. Each row
// names a thing the agent did or was given, so the panel makes no capability
// claim it cannot support. ADR-0004's rule that every displayed number names its
// subject is satisfiable here in a way it was not for the radar.
// ═══════════════════════════════════════════════════════════════

import { AgentLevelBadge } from "@/components/achievements";
import { useAgentExperience } from "@/hooks/useAgentExperience";

export default function AgentGrowthPanel({ profileId }: { profileId: string }) {
  const { entries, isLoading } = useAgentExperience();
  const entry = entries.find((e) => e.targetRef === profileId) ?? null;

  if (isLoading) {
    return <div className="text-xs font-mono text-white/40">Loading growth…</div>;
  }

  if (!entry) {
    return (
      <div className="text-xs font-mono text-white/40">
        No completed work yet. This agent starts growing on its first finished run.
      </div>
    );
  }

  const s = entry.experience.signals;
  const rows: Array<[string, number]> = [
    ["Runs completed", s.runsCompleted],
    ["Active days", s.activeDays],
    ["Skills enabled", s.skillsEnabled],
    ["Toolsets attached", s.toolsetCount],
    ["Memory facts", s.memoryFacts],
  ];

  return (
    <div className="space-y-4">
      <AgentLevelBadge experience={entry.experience.level} label={entry.targetLabel} />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-2">
            <dt className="truncate text-xs text-white/40">{label}</dt>
            <dd className="font-mono text-xs font-semibold text-white/80">{value.toLocaleString()}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-white/30">
        {entry.experience.xp.toLocaleString()} XP from work done and equipment acquired. Capability
        measurement is not implemented; see ADR-0004.
      </p>
    </div>
  );
}
