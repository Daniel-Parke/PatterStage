"use client";

import Link from "next/link";
import { Gamepad2, Coins, Sparkles, Target, Trophy, ChevronRight } from "lucide-react";
import { useGame } from "@/hooks/useGame";
import { neon, neonAlpha, type NeonColor } from "@/components/viz/colors";

/** Compact gamification band on the dashboard — links into the Arcade. */
export default function GamificationBand() {
  const { snapshot } = useGame();
  if (!snapshot) return null;
  const s = snapshot;
  const dailies = s.quests.filter((q) => q.def.period === "daily");
  const dailyDone = dailies.filter((q) => q.complete).length;
  const claimable = s.quests.filter((q) => q.complete && !q.claimed).length;
  const unlocked = s.achievements.filter((a) => a.unlocked).length;
  const canPull = s.currency.cores >= s.currency.pullCost;
  const rc = s.account.rank.color as NeonColor;

  const Stat = ({ icon: Icon, color, label, value }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: NeonColor; label: string; value: string }) => (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5" style={{ color: neon(color) }} />
      <span className="text-white/40">{label}</span>
      <span className="font-mono text-white/80">{value}</span>
    </div>
  );

  return (
    <Link
      href="/recroom/arcade"
      className="animate-float-in group flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-white/10 bg-dark-900/50 px-4 py-3 transition-colors hover:border-neon-purple/40"
      style={{ boxShadow: `0 0 22px ${neonAlpha(rc, 8)}` }}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: neonAlpha(rc, 16), color: neon(rc) }}>
          <Gamepad2 className="h-4.5 w-4.5" />
        </div>
        <div>
          <div className="text-sm font-semibold text-white">Lv {s.account.level.level} · {s.account.rank.name}</div>
          <div className="text-[11px] text-white/40">{s.account.level.title}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
        <Stat icon={Coins} color="yellow" label="Cores" value={s.currency.cores.toLocaleString()} />
        <Stat icon={Target} color="cyan" label="Daily" value={`${dailyDone}/${dailies.length}`} />
        <Stat icon={Trophy} color="purple" label="Unlocked" value={`${unlocked}/${s.achievements.length}`} />
        {claimable > 0 && (
          <span className="rounded-full bg-neon-green/15 px-2 py-0.5 font-mono text-[11px] text-neon-green">{claimable} to claim</span>
        )}
        {canPull && (
          <span className="flex items-center gap-1 rounded-full bg-neon-purple/15 px-2 py-0.5 font-mono text-[11px] text-neon-purple">
            <Sparkles className="h-3 w-3" /> Synthesis ready
          </span>
        )}
      </div>

      <span className="ml-auto flex items-center gap-1 text-xs font-mono text-white/40 group-hover:text-neon-purple">
        Arcade <ChevronRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}
