"use client";

// ═══════════════════════════════════════════════════════════════
// Arcade — the gamification hub (character sheet, roster, mastery,
// quests, synthesis/gacha, vault, achievements, arena scaffold).
// Cosmetic-only RPG/Gacha layer over real agent usage.
// ═══════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import {
  Gamepad2, User, Users, TrendingUp, Target, Sparkles, Boxes, Trophy, Swords,
  Coins, Gem, Flame, Lock, Check, Star,
} from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import RadarChart from "@/components/viz/RadarChart";
import ProgressRing from "@/components/viz/ProgressRing";
import { neon, neonAlpha, type NeonColor } from "@/components/viz/colors";
import UnitCard from "@/components/game/UnitCard";
import GachaReveal from "@/components/game/GachaReveal";
import { useGame } from "@/hooks/useGame";
import { COSMETICS } from "@/lib/game/content/cosmetics";
import { RARITY_COLOR, RARITY_ORDER, type PullResult, type Rarity } from "@/lib/game/types";
import { simulateBattle, type BattleResult } from "@/lib/game/battle/resolve";

const TABS = [
  { id: "character", label: "Character", icon: User },
  { id: "roster", label: "Roster", icon: Users },
  { id: "mastery", label: "Mastery", icon: TrendingUp },
  { id: "quests", label: "Quests", icon: Target },
  { id: "synthesis", label: "Synthesis", icon: Sparkles },
  { id: "vault", label: "Vault", icon: Boxes },
  { id: "achievements", label: "Achievements", icon: Trophy },
  { id: "arena", label: "Arena", icon: Swords },
] as const;
type TabId = (typeof TABS)[number]["id"];

const fmt = (n: number) => Math.round(n).toLocaleString();

function Card({ children, color = "cyan", className = "" }: { children: React.ReactNode; color?: NeonColor; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-dark-900/50 p-4 ${className}`} style={{ boxShadow: `0 0 22px ${neonAlpha(color, 6)}` }}>
      {children}
    </div>
  );
}

export default function ArcadePage() {
  const { snapshot, events, owned, isLoading, pull, claim, equip } = useGame();
  const [tab, setTab] = useState<TabId>("character");
  const [reveal, setReveal] = useState<PullResult | null>(null);
  const [battle, setBattle] = useState<BattleResult | null>(null);

  const ownedSet = useMemo(() => new Set(owned), [owned]);

  if (isLoading && !snapshot) {
    return (
      <AppPageShell variant="scanlines">
        <div className="flex flex-1 min-h-[50vh] items-center justify-center">
          <LoadingSpinner text="Booting the Arcade…" />
        </div>
      </AppPageShell>
    );
  }
  if (!snapshot) return null;

  const s = snapshot;
  const canPull = s.currency.cores >= s.currency.pullCost;

  const doPull = () =>
    pull.mutate(undefined, {
      onSuccess: (res) => {
        const r = (res.data as { data?: { ok: boolean; result?: PullResult } } | undefined)?.data;
        if (r?.ok && r.result) setReveal(r.result);
      },
    });

  return (
    <AppPageShell variant="scanlines">
      <PageHeader
        icon={Gamepad2}
        title="Arcade"
        subtitle={`Lv ${s.account.level.level} ${s.account.rank.name} · ${s.account.level.title}`}
        color="purple"
        backHref="/"
        actions={
          <div className="flex items-center gap-3 font-mono text-sm">
            <span className="flex items-center gap-1.5" style={{ color: neon("yellow") }}><Coins className="h-4 w-4" /> {fmt(s.currency.cores)}</span>
            <span className="flex items-center gap-1.5" style={{ color: neon("pink") }}><Gem className="h-4 w-4" /> {fmt(s.currency.shards)}</span>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        {/* tab bar */}
        <div className="mb-5 flex flex-wrap gap-1.5">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-mono transition-colors ${active ? "text-neon-purple" : "text-white/40 hover:text-white/70"}`}
                style={active ? { background: neonAlpha("purple", 12), boxShadow: `inset 0 0 0 1px ${neonAlpha("purple", 35)}` } : undefined}
              >
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            );
          })}
        </div>

        {/* ── Character ── */}
        {tab === "character" && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card color="purple" className="lg:col-span-1">
              <div className="flex items-center gap-4">
                <ProgressRing value={s.account.level.progress} color="purple" size={84} thickness={7} label={<span className="text-lg font-bold">{s.account.level.level}</span>} sublabel="LVL" />
                <div>
                  <div className="font-mono text-sm font-semibold text-white">{s.account.rank.name}</div>
                  <div className="text-xs text-white/40">{s.account.level.title}</div>
                  <div className="mt-1 text-[11px] text-white/40">{fmt(s.account.level.xpIntoLevel)} / {fmt(s.account.level.xpForLevel)} XP</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/40"><Coins className="h-3 w-3 text-neon-yellow" /> Cores</div>
                  <div className="font-mono text-lg font-bold text-white">{fmt(s.currency.cores)}</div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/40"><Gem className="h-3 w-3 text-neon-pink" /> Shards</div>
                  <div className="font-mono text-lg font-bold text-white">{fmt(s.currency.shards)}</div>
                </div>
              </div>
            </Card>
            <Card color="cyan" className="flex items-center justify-center">
              <RadarChart axes={s.attributes.map((a) => ({ label: a.label, value: a.value }))} color="cyan" size={240} />
            </Card>
            <Card color="green">
              <div className="mb-2 text-xs font-mono uppercase tracking-wider text-white/50">Recent</div>
              <div className="space-y-1.5">
                {events.length === 0 && <div className="text-sm text-white/30">No activity yet — go run some missions.</div>}
                {events.slice(0, 8).map((e, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-white/60">{String((e.payload as { name?: string }).name ?? e.type)}</span>
                    <span className="font-mono text-white/30">{e.type}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ── Roster ── */}
        {tab === "roster" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {s.roster.map((c) => <UnitCard key={c.slug} card={c} />)}
          </div>
        )}

        {/* ── Mastery ── */}
        {tab === "mastery" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {s.tracks.map((t) => (
              <Card key={t.id} color={t.color}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{t.name}</span>
                  <span className="font-mono text-sm" style={{ color: neon(t.color) }}>Lv {t.level.level}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full" style={{ width: `${Math.round(t.level.progress * 100)}%`, background: neon(t.color) }} />
                </div>
                <div className="mt-1 text-[11px] text-white/40">{fmt(t.level.xpIntoLevel)} / {fmt(t.level.xpForLevel)} XP</div>
              </Card>
            ))}
          </div>
        )}

        {/* ── Quests ── */}
        {tab === "quests" && (
          <div className="space-y-4">
            {(["daily", "weekly"] as const).map((period) => (
              <div key={period}>
                <div className="mb-2 text-xs font-mono uppercase tracking-wider text-white/50">{period}</div>
                <div className="space-y-2">
                  {s.quests.filter((q) => q.def.period === period).map((q) => {
                    const pct = Math.min(100, Math.round((q.progress / q.def.target) * 100));
                    return (
                      <Card key={q.def.id} color={q.complete ? "green" : "cyan"} className="flex items-center gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{q.def.name}</span>
                            <span className="text-xs text-white/40">{q.def.description}</span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/5">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: neon(q.complete ? "green" : "cyan") }} />
                            </div>
                            <span className="font-mono text-[11px] text-white/40">{fmt(Math.min(q.progress, q.def.target))}/{fmt(q.def.target)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-xs" style={{ color: neon("yellow") }}>+{q.def.rewardCores} <Coins className="inline h-3 w-3" /></div>
                          {q.claimed ? (
                            <span className="text-[11px] text-white/30">claimed</span>
                          ) : (
                            <button type="button" disabled={!q.complete || claim.isPending} onClick={() => claim.mutate(q.def.id)} className="mt-1 rounded-lg border border-neon-green/30 bg-neon-green/10 px-3 py-1 text-[11px] font-mono text-neon-green disabled:opacity-30">
                              Claim
                            </button>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Synthesis ── */}
        {tab === "synthesis" && (
          <div className="mx-auto max-w-md text-center">
            <Card color="purple">
              <Sparkles className="mx-auto h-12 w-12 text-neon-purple animate-pulse-glow" />
              <div className="mt-3 text-lg font-bold text-white">Standard Synthesis</div>
              <div className="mt-1 text-xs text-white/50">Fabricate a cosmetic. Pity guarantees Epic+ at {s.currency.pityThreshold}.</div>
              <div className="mt-3 text-xs font-mono text-white/40">Pity {s.currency.pity}/{s.currency.pityThreshold} · {fmt(s.currency.cores)} Cores</div>
              <button type="button" disabled={!canPull || pull.isPending} onClick={doPull} className="mt-4 w-full rounded-xl border border-neon-purple/40 bg-neon-purple/15 px-4 py-3 font-mono text-neon-purple transition-colors hover:bg-neon-purple/25 disabled:opacity-40">
                {pull.isPending ? "Synthesizing…" : `Synthesize · ${s.currency.pullCost} Cores`}
              </button>
              {!canPull && <div className="mt-2 text-[11px] text-white/30">Earn Cores from quests + achievements.</div>}
            </Card>
          </div>
        )}

        {/* ── Vault ── */}
        {tab === "vault" && (
          <div className="space-y-4">
            <div className="text-sm text-white/50">Collection {s.collection.owned}/{s.collection.total} · {Math.round((s.collection.owned / s.collection.total) * 100)}%</div>
            {RARITY_ORDER.slice().reverse().map((rarity) => {
              const items = COSMETICS.filter((c) => c.rarity === rarity);
              if (items.length === 0) return null;
              return (
                <div key={rarity}>
                  <div className="mb-1.5 text-xs font-mono uppercase tracking-wider" style={{ color: neon(RARITY_COLOR[rarity] as NeonColor) }}>{rarity}</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {items.map((c) => {
                      const have = ownedSet.has(c.id);
                      const rc = RARITY_COLOR[c.rarity] as NeonColor;
                      const isEquipped = s.equipped[c.type] === c.id;
                      return (
                        <div key={c.id} className="rounded-xl border p-2.5" style={{ borderColor: have ? neonAlpha(rc, 35) : "rgba(255,255,255,0.05)", background: have ? neonAlpha(rc, 7) : "transparent", opacity: have ? 1 : 0.55 }}>
                          <div className="flex items-center justify-between">
                            <span className="truncate text-xs text-white/80">{c.name}</span>
                            {have ? <Check className="h-3 w-3 text-neon-green" /> : <Lock className="h-3 w-3 text-white/25" />}
                          </div>
                          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-white/35">{c.type}</div>
                          {have && (
                            <button type="button" onClick={() => equip.mutate({ type: c.type, itemId: isEquipped ? "" : c.id })} className="mt-1.5 w-full rounded-md border px-2 py-0.5 text-[10px] font-mono" style={{ borderColor: neonAlpha(rc, 35), color: isEquipped ? "rgba(255,255,255,0.45)" : neon(rc) }}>
                              {isEquipped ? "Equipped" : "Equip"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Achievements ── */}
        {tab === "achievements" && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {s.achievements.map((a) => {
              const rc = RARITY_COLOR[a.def.rarity] as NeonColor;
              return (
                <Card key={a.def.id} color={a.unlocked ? rc : "cyan"} className="flex items-center gap-3" >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: a.unlocked ? neonAlpha(rc, 18) : "rgba(255,255,255,0.04)" }}>
                    {a.unlocked ? <Trophy className="h-4 w-4" style={{ color: neon(rc) }} /> : <Lock className="h-4 w-4 text-white/25" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-medium ${a.unlocked ? "text-white/90" : "text-white/45"}`}>{a.def.name}</div>
                    <div className="text-[11px] text-white/40">{a.def.description}</div>
                    {!a.unlocked && (
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/5">
                        <div className="h-full rounded-full" style={{ width: `${Math.round(a.progress * 100)}%`, background: neonAlpha(rc, 60) }} />
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── Arena (scaffold) ── */}
        {tab === "arena" && (
          <div className="space-y-4">
            <Card color="orange">
              <div className="flex items-center gap-2 text-neon-orange"><Swords className="h-5 w-5" /><span className="font-semibold">Arena — Coming Soon</span></div>
              <p className="mt-2 text-sm text-white/50">Your agents&apos; Unit Cards are battle-ready. A JRPG monster-arena (PvE → online PvP, tournaments, shared card database) is on the roadmap. Here&apos;s a local spar between your two strongest units to preview the system.</p>
              <button
                type="button"
                disabled={s.roster.length < 2}
                onClick={() => setBattle(simulateBattle(s.roster[0], s.roster[1], `spar-${Date.now()}`))}
                className="mt-3 rounded-lg border border-neon-orange/30 bg-neon-orange/10 px-4 py-2 text-sm font-mono text-neon-orange disabled:opacity-40"
              >
                Spar: {s.roster[0]?.name} vs {s.roster[1]?.name}
              </button>
            </Card>
            {battle && (
              <Card color="cyan">
                <div className="text-sm font-mono text-white/70">Winner: <span className="text-neon-green">{battle.winner === "a" ? s.roster[0].name : battle.winner === "b" ? s.roster[1].name : "Draw"}</span> · {battle.turns} rounds</div>
                <div className="mt-2 max-h-48 space-y-0.5 overflow-y-auto text-[11px] font-mono text-white/40">
                  {battle.log.slice(0, 24).map((t, i) => (
                    <div key={i}>{t.attacker} → {t.defender} · −{t.damage}</div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      {reveal && (
        <GachaReveal
          result={reveal}
          onClose={() => setReveal(null)}
          onAgain={doPull}
          canAgain={canPull && !pull.isPending}
        />
      )}
    </AppPageShell>
  );
}
