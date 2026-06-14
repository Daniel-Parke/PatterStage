"use client";

import Link from "next/link";
import { Gamepad2, ChevronRight } from "lucide-react";
import { useGame } from "@/hooks/useGame";
import { RARITY_COLOR } from "@/lib/game/types";
import { neon, neonAlpha, type NeonColor } from "@/components/viz/colors";

/** Surfaces each agent's gamified Unit Card (level/class/power, derived from
 *  real usage) on the Agents page, linking into the Arcade roster. */
export default function AgentRosterStrip() {
  const { snapshot } = useGame();
  if (!snapshot || snapshot.roster.length === 0) return null;

  return (
    <div className="animate-float-in mb-5 rounded-2xl border border-white/10 bg-dark-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-white/50">
          <Gamepad2 className="h-3.5 w-3.5 text-neon-purple" /> Unit Cards · grown from real activity
        </div>
        <Link href="/recroom/arcade" className="flex items-center gap-1 font-mono text-xs text-white/40 transition-colors hover:text-neon-purple">
          Arcade <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {snapshot.roster.map((c) => {
          const rc = RARITY_COLOR[c.rarity] as NeonColor;
          return (
            <Link
              key={c.slug}
              href="/recroom/arcade"
              className="flex items-center gap-2 rounded-xl border p-2 transition-transform hover:-translate-y-0.5"
              style={{ borderColor: neonAlpha(rc, 30), background: neonAlpha(rc, 6) }}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold" style={{ background: neonAlpha(rc, 18), color: neon(rc) }}>
                {c.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs text-white/80">{c.name}</div>
                <div className="truncate text-[10px]" style={{ color: neon(rc) }}>
                  Lv {c.level} · {c.className} · P{c.power}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
