// ═══════════════════════════════════════════════════════════════
// ChatModeToggle — pick how a turn is answered.
//   Agent → a real run (tools + memory, streamed run events).
//   Fast  → a raw model completion (no tools), straight from the gateway.
// ═══════════════════════════════════════════════════════════════

"use client";

import { Bot, Zap } from "lucide-react";
import type { ChatMode } from "@/types/chat";

const MODES: { value: ChatMode; label: string; Icon: typeof Bot; title: string }[] = [
  { value: "agent", label: "Agent", Icon: Bot, title: "Tools + memory, via a real agent run" },
  { value: "fast", label: "Fast", Icon: Zap, title: "Raw model reply, no tools" },
];

export function ChatModeToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: ChatMode;
  onChange: (mode: ChatMode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center rounded-lg border border-white/10 bg-white/[0.02] p-0.5">
      {MODES.map((m) => {
        const active = m.value === mode;
        const Icon = m.Icon;
        return (
          <button
            key={m.value}
            onClick={() => onChange(m.value)}
            disabled={disabled}
            title={m.title}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-mono transition-colors disabled:opacity-40 ${
              active
                ? "bg-neon-cyan/20 text-neon-cyan"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            <Icon className="h-3 w-3" />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
