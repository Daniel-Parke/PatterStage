// ═══════════════════════════════════════════════════════════════
// MessageAvatar — Round icon chip for chat message roles
// ═══════════════════════════════════════════════════════════════
//
// Extracted from src/app/orchestration/chat/page.tsx (List 2 — Cron,
// Missions, Chat surface). The 4-line `w-8 h-8 rounded-lg bg-neon-X/20
// border border-neon-X/30 ...` chip appeared at 2 sites in the chat
// page's `messages.map` body (one per role — assistant on the left,
// user on the right) AND once inside `TypingIndicator.tsx` (the
// assistant avatar paired with the "..." dot indicator).
//
// All 3 sites use the IDENTICAL outer div class string with only the
// icon (`Bot` vs `User`) and the colour token (neon-purple vs
// neon-cyan) varying:
//
//   <div className="w-8 h-8 rounded-lg bg-neon-{colour}/20 border border-neon-{colour}/30 flex items-center justify-center shrink-0 mt-1">
//     <Icon className="w-4 h-4 text-neon-{colour}" />
//   </div>
//
// Centralising the shape as a `role`-driven component (rather than
// passing `icon` and `colour` props) keeps the role → icon → colour
// mapping in one place. The two valid roles today (assistant, user)
// map to the exact same colour tokens the inline form used:
//
//   - assistant → Bot   + neon-purple  (lines 561-564 + TypingIndicator line 12-14)
//   - user      → User  + neon-cyan    (lines 596-599)
//
// A future "system" or "tool" role can extend the `AVATARS` map
// without touching any caller. The `AVATAR_ROLE` type is exported
// so the `MessageBubble` component (sister extraction in this same
// commit) can use it as the union of valid `role` values for
// per-message rendering.
//
// The 3 extracted sites are byte-equivalent to the inline form:
// the same `w-8 h-8` size, the same `bg-neon-X/20 border border-neon-X/30`
// background + border, the same `flex items-center justify-center
// shrink-0 mt-1` layout, the same `w-4 h-4 text-neon-X` icon.

import { Bot, User, Cog } from "lucide-react";
import type { ChatMessage } from "@/types/chat";

/**
 * Union of chat-message roles that have an avatar. The chat `ChatMessage`
 * type uses `"user" | "assistant"` (see `src/types/chat.ts`); this
 * narrower type exists so the `AVATARS` map can be exhaustively typed
 * (a future "system" role would force a compile error here, prompting
 * the maintainer to add the entry).
 */
export type AVATAR_ROLE = ChatMessage["role"];

interface AvatarEntry {
  Icon: typeof Bot;
  /** Tailwind class for the icon stroke colour (e.g. "text-neon-purple") */
  iconClass: string;
  /** Tailwind class for the chip background (e.g. "bg-neon-purple/20") */
  bgClass: string;
  /** Tailwind class for the chip border (e.g. "border-neon-purple/30") */
  borderClass: string;
}

const AVATARS: Record<AVATAR_ROLE, AvatarEntry> = {
  assistant: {
    Icon: Bot,
    iconClass: "text-neon-purple",
    bgClass: "bg-neon-purple/20",
    borderClass: "border-neon-purple/30",
  },
  user: {
    Icon: User,
    iconClass: "text-neon-cyan",
    bgClass: "bg-neon-cyan/20",
    borderClass: "border-neon-cyan/30",
  },
  system: {
    Icon: Cog,
    iconClass: "text-neon-yellow",
    bgClass: "bg-neon-yellow/20",
    borderClass: "border-neon-yellow/30",
  },
};

/**
 * The round icon chip shown next to chat messages and the typing
 * indicator. Caller passes a `role`; the helper resolves the icon
 * and colour. The chip's outer markup is byte-equivalent to the
 * pre-extraction inline form — same size, same background, same
 * border, same layout. See file header for the role → entry map.
 */
export default function MessageAvatar({ role }: { role: AVATAR_ROLE }) {
  const { Icon, iconClass, bgClass, borderClass } = AVATARS[role];
  return (
    <div
      className={`w-8 h-8 rounded-lg ${bgClass} border ${borderClass} flex items-center justify-center shrink-0 mt-1`}
    >
      <Icon className={`w-4 h-4 ${iconClass}`} />
    </div>
  );
}
