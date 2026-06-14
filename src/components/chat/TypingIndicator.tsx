// ═══════════════════════════════════════════════════════════════
// TypingIndicator — Animated "thinking" indicator for chat
// ═══════════════════════════════════════════════════════════════
//
// Sister extraction in this same commit (List 2 — Cron, Missions,
// Chat): the inline `<div className="w-8 h-8 rounded-lg bg-neon-purple/20
// ...">` assistant-avatar chip was promoted to
// `src/components/chat/MessageAvatar.tsx`. This component now
// delegates the avatar render to that helper, keeping the chip
// shape in lockstep with the per-message avatar in
// `MessageBubble.tsx` (a future "avatar size" or "avatar colour"
// change lands in one place — the AVATARS map).
//
// The 3-dot bounce animation below the avatar is the component's
// own concern (not a message — it's a "in-flight" indicator
// rendered outside the messages `.map`). Kept inline because the
// 3 `<span>` dots are a focused, 1-site use of a magic animation-
// delay sequence that doesn't share structure with anything else
// in the chat surface.

"use client";

import MessageAvatar from "@/components/chat/MessageAvatar";

export default function TypingIndicator() {
  return (
    <div className="flex gap-3 justify-start">
      <MessageAvatar role="assistant" />
      <div className="max-w-[70%] rounded-xl px-4 py-3 bg-white/5 border border-white/10">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}
