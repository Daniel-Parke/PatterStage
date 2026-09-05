"use client";

import {
  Rocket,
  Target,
  Medal,
  Flame,
  Zap,
  Coins,
  Gem,
  Bot,
  Terminal,
  BookOpen,
  Moon,
  Crown,
  Send,
  Gauge,
  ShieldCheck,
  Library,
  BookCheck,
  PenLine,
  Feather,
  MessagesSquare,
  Infinity as InfinityIcon,
  Timer,
  Repeat,
  CalendarClock,
  ToggleRight,
  SlidersHorizontal,
  Users,
  Cpu,
  Mic,
  MessageCircle,
  Megaphone,
  Trophy,
  Sunrise,
  Boxes,
  Compass,
  Sparkles,
  Flag,
  Wand2,
  Cog,
  GraduationCap,
  Lock,
  type LucideIcon,
} from "lucide-react";
import type { Achievement } from "@/lib/stats/derive";
import { neon, neonAlpha, type NeonColor } from "@/components/viz/colors";

export const ICONS: Record<string, LucideIcon> = {
  Rocket,
  Target,
  Medal,
  Flame,
  Zap,
  Coins,
  Gem,
  Bot,
  Terminal,
  BookOpen,
  Moon,
  Crown,
  Send,
  Gauge,
  ShieldCheck,
  Library,
  BookCheck,
  PenLine,
  Feather,
  MessagesSquare,
  Infinity: InfinityIcon,
  Timer,
  Repeat,
  CalendarClock,
  ToggleRight,
  SlidersHorizontal,
  Users,
  Cpu,
  Mic,
  MessageCircle,
  Megaphone,
  Trophy,
  Sunrise,
  Boxes,
  Compass,
  Sparkles,
  // The quest chains.
  Flag,
  Wand2,
  Cog,
  GraduationCap,
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`;
  return String(n);
}

export default function AchievementBadge({ achievement }: { achievement: Achievement }) {
  const { icon, color, unlocked, progress, name, description, current, target } = achievement;
  const Icon = ICONS[icon] ?? Medal;
  const c = color as NeonColor;
  const tip = unlocked
    ? `${name} — ${description} ✓`
    : `${name} — ${description} (${fmt(Math.min(current, target))}/${fmt(target)})`;

  return (
    <div
      title={tip}
      className="group flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-transform duration-200 hover:-translate-y-0.5"
      style={
        unlocked
          ? { borderColor: neonAlpha(c, 30), background: neonAlpha(c, 8), boxShadow: `0 0 18px ${neonAlpha(c, 12)}` }
          : { borderColor: "var(--color-ps-viz-track)" }
      }
    >
      <div
        className="relative flex h-11 w-11 items-center justify-center rounded-full"
        style={{ background: unlocked ? neonAlpha(c, 18) : "var(--color-ps-viz-empty)" }}
      >
        <Icon className="h-5 w-5" style={{ color: unlocked ? neon(c) : "var(--color-ps-viz-glyph-idle)" }} />
        {!unlocked && (
          <Lock className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-dark-800 p-[3px] text-ps-text-muted" />
        )}
      </div>
      <span
        className={`text-center text-xs font-medium leading-tight ${unlocked ? "text-ps-text-primary" : "text-ps-text-muted"}`}
      >
        {name}
      </span>
      {!unlocked && progress > 0 && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full transition-[width] duration-700"
            style={{ width: `${Math.round(progress * 100)}%`, background: neonAlpha(c, 70) }}
          />
        </div>
      )}
    </div>
  );
}
