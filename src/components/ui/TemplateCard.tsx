"use client";

import { Search, Bug, GitPullRequest, Wrench, PenTool, Zap,
  Rocket, Cpu, Activity, Shield, Terminal, Database,
  Globe, Code, FileText, Layers, HardDrive, AlertTriangle,
  BarChart3, Brain, TrendingUp, DollarSign, Target, ClipboardList,
  Palette, Megaphone, Microscope, Scale, ShieldCheck, CheckSquare,
  TestTube, ShieldAlert, Gauge, BookOpen, RefreshCw, FlaskConical,
  Sparkles, Clock } from "lucide-react";
import { iconColorMap } from "@/lib/theme";
import type { AccentColor } from "@/types/hermes";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Search, Bug, GitPullRequest, Wrench, PenTool, Zap,
  Rocket, Cpu, Activity, Shield, Terminal, Database,
  Globe, Code, FileText, Layers, HardDrive, AlertTriangle,
  BarChart3, Brain, TrendingUp, DollarSign, Target, ClipboardList,
  Palette, Megaphone, Microscope, Scale, ShieldCheck, CheckSquare,
  TestTube, ShieldAlert, Gauge, BookOpen, RefreshCw, FlaskConical,
  Sparkles, Clock,
};

interface TemplateCardProps {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  isCustom?: boolean;
  compact?: boolean;
  onSelect: () => void;
  actions?: React.ReactNode;
}

export default function TemplateCard({
  name,
  icon,
  color,
  description,
  isCustom,
  compact = false,
  onSelect,
  actions,
}: TemplateCardProps) {
  const IconComponent = iconMap[icon] || Zap;

  if (compact) {
    return (
      <button
        onClick={onSelect}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-white/60 hover:border-white/30 hover:text-white hover:bg-white/[0.07] transition-colors min-w-0 max-w-full"
      >
        <IconComponent className={`w-3 h-3 flex-shrink-0 ${iconColorMap[color as AccentColor] || "text-neon-cyan"}`} />
        <span className="truncate min-w-0">{name}</span>
      </button>
    );
  }

  return (
    <div className="text-left rounded-xl border border-white/10 bg-dark-900/50 p-4 hover:border-white/30 transition-colors group relative">
      <button onClick={onSelect} className="w-full h-full text-left">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <IconComponent className={`w-5 h-5 ${iconColorMap[color as AccentColor] || "text-neon-cyan"}`} />
            {isCustom && (
              <span className="text-[9px] font-mono text-white/20 bg-white/5 px-1.5 py-0.5 rounded">custom</span>
            )}
          </div>
        </div>
        <div className="text-sm font-semibold text-white">{name}</div>
        <div className="text-[10px] text-white/40 mt-1 line-clamp-2">{description}</div>
      </button>
      {actions && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {actions}
        </div>
      )}
    </div>
  );
}
