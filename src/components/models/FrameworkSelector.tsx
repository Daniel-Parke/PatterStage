// ═══════════════════════════════════════════════════════════════
// FrameworkSelector — compact framework switcher dropdown
// ═══════════════════════════════════════════════════════════════

"use client";

import { ChevronDown } from "lucide-react";
import { FrameworkEntry, getFramework, listFrameworks } from "@/lib/framework-registry";

interface FrameworkSelectorProps {
  activeFrameworkId: string;
  onFrameworkChange: (id: string) => void;
  className?: string;
}

export default function FrameworkSelector({
  activeFrameworkId,
  onFrameworkChange,
  className = "",
}: FrameworkSelectorProps) {
  const frameworks = listFrameworks();
  const _active = getFramework(activeFrameworkId) ?? frameworks[0];

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className="text-xs text-white/40 font-mono uppercase tracking-widest">
        Framework
      </span>
      <div className="relative">
        <select
          value={activeFrameworkId}
          onChange={(e) => onFrameworkChange(e.target.value)}
          className="h-9 min-h-9 pl-3 pr-8 bg-dark-800 border border-white/10 rounded-lg text-sm text-white font-mono outline-none cursor-pointer transition-colors hover:border-white/20 focus:border-neon-purple/50 appearance-none"
        >
          {frameworks.map((fw: FrameworkEntry) => (
            <option key={fw.id} value={fw.id}>
              {fw.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
      </div>
    </div>
  );
}