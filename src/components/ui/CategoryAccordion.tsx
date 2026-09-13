"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface CategoryAccordionProps {
  name: string;
  count: number;
  color?: string;
  defaultOpen?: boolean;
  expandable?: boolean;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}

const dotColorMap: Record<string, string> = {
  pink: "bg-neon-pink",
  cyan: "bg-neon-cyan",
  purple: "bg-neon-purple",
  green: "bg-neon-green",
  orange: "bg-neon-orange",
  blue: "bg-cherenkov-300",
};

export default function CategoryAccordion({
  name,
  count,
  color = "cyan",
  defaultOpen = false,
  expandable = true,
  children,
  headerRight,
}: CategoryAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const dotColor = dotColorMap[color] || dotColorMap.cyan;
  const isExpanded = !expandable || open;

  return (
    <div className="overflow-hidden">
      {/* Header */}
      <button
        onClick={() => expandable && setOpen(!open)}
        className={`w-full flex items-center justify-between px-1 py-1.5 ${expandable ? "hover:bg-ps-surface-raised cursor-pointer" : "cursor-default"} transition-colors`}
      >
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
          <span className="text-micro font-medium text-ps-text-muted uppercase tracking-wider">{name}</span>
          <span className="text-micro font-mono text-ps-text-faint">
            {count}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {headerRight}
          {expandable && (
            isExpanded ? (
              <ChevronDown className="w-3 h-3 text-ps-viz-glyph-idle" />
            ) : (
              <ChevronRight className="w-3 h-3 text-ps-viz-glyph-idle" />
            )
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-1 pb-2">
          {children}
        </div>
      )}
    </div>
  );
}
