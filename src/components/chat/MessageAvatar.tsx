// ═══════════════════════════════════════════════════════════════
// MessageAvatar — Round icon chip for chat message roles
// ═══════════════════════════════════════════════════════════════

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
 * and colour.
 */
export default function MessageAvatar({ role }: { role: AVATAR_ROLE }) {
  const { Icon, iconClass, bgClass, borderClass } = AVATARS[role];
  return (
    <div
      className={`w-8 h-8 rounded-ps-md ${bgClass} border ${borderClass} flex items-center justify-center shrink-0 mt-1`}
    >
      <Icon className={`w-4 h-4 ${iconClass}`} />
    </div>
  );
}
