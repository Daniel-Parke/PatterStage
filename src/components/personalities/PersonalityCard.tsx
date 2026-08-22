// ═══════════════════════════════════════════════════════════════
// PersonalityCard — one profile's SOUL.md voice as a list row
//
// Extracted verbatim from app/operations/personalities/page.tsx so the
// page stays a thin shell (docs/CONTRIBUTING.md, "Where UI lives").
// Presentation only: the expand/copy state is local card state, and
// every mutation is handed back to the page through a prop.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import { Check, ChevronDown, Copy, Edit3, Sparkles } from "lucide-react";
import { getPersonalityEmoji } from "@/lib/personalities";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

/** A personality is a profile's SOUL.md identity: the profile name plus its prompt. */
export interface Personality {
  name: string;
  prompt: string;
}

export default function PersonalityCard({
  personality,
  onEdit,
  onActivate,
  isActive,
}: {
  personality: Personality;
  onEdit: (p: Personality) => void;
  onActivate: (name: string) => void;
  isActive: boolean;
}) {
  const [textExpanded, setTextExpanded] = useState(false);
  // Use the shared `useCopyToClipboard` hook (sister to the
  // MessageBubble migration in components/session/MessageBubble.tsx)
  // so the "[copied, setCopied] + useRef<setTimeout> + unmount
  // cleanup" pattern lives in exactly one place. The 2000ms reset
  // matches the pre-refactor inline timer (MessageBubble uses 1500ms
  // — a different value passed via the hook's `resetMs` option).
  const [copied, copy] = useCopyToClipboard({ resetMs: 2000 });

  const handleCopy = () => {
    copy(personality.prompt);
  };

  const preview =
    personality.prompt.length > 120
      ? personality.prompt.slice(0, 120) + "..."
      : personality.prompt;

  return (
    <div
      className={`rounded-xl border transition-all ${
        isActive
          ? "border-neon-cyan/50 bg-neon-cyan/5"
          : "border-white/10 bg-dark-900/50 hover:border-white/20"
      }`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-lg">{getPersonalityEmoji(personality.name)}</span>
              <h3 className="font-semibold text-white truncate font-mono">
                {personality.name}
              </h3>
              {isActive && (
                <span className="text-[10px] font-mono bg-neon-cyan/15 text-neon-cyan px-1.5 py-0.5 rounded">
                  ACTIVE
                </span>
              )}
            </div>
            <p className="text-xs text-white/40 leading-relaxed">
              {textExpanded ? personality.prompt : preview}
            </p>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setTextExpanded(!textExpanded)}
              className={`p-1.5 rounded-lg text-white/30 hover:bg-white/5 transition-colors ${textExpanded ? "bg-white/5" : ""}`}
              title={textExpanded ? "Collapse" : "Expand prompt"}
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${textExpanded ? "" : "rotate-90"}`} />
            </button>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg text-white/30 hover:bg-white/5 transition-colors"
              title={copied ? "Copied!" : "Copy prompt"}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-neon-green" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
            {!isActive && (
              <button
                onClick={() => onActivate(personality.name)}
                className="p-1.5 rounded-lg text-neon-cyan hover:bg-neon-cyan/10 transition-colors"
                title="Set as active"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => onEdit(personality)}
              className="p-1.5 rounded-lg text-white/30 hover:bg-white/5 transition-colors"
              title="Edit personality"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
