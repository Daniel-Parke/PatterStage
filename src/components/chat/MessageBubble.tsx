// ═══════════════════════════════════════════════════════════════
// MessageBubble — Single chat message row (avatar + bubble + ts)
// ═══════════════════════════════════════════════════════════════
//
// Extracted from src/app/orchestration/chat/page.tsx (List 2 — Cron,
// Missions, Chat surface). The 50-line `messages.map((msg) => ...)`
// body inside the chat page's message-list render is the
// single inline site for this component.
//
// Shape:
//
//   <div className="flex gap-3 {justify-end|justify-start}">
//     {role === "assistant" && <avatar left side>}
//     <div className="max-w-[70%] rounded-xl px-4 py-3 {user/assistant bg}">
//       {role === "assistant" ? <dangerouslySetInnerHTML markdown> :
//                              <p className="whitespace-pre-wrap">}
//       <div className="text-[10px] text-white/20 ...">{HH:MM timestamp}</div>
//     </div>
//     {role === "user" && <avatar right side>}
//   </div>
//
// Sister site (NOT a duplicate target, but mentioned for context):
// src/components/session/MessageBubble.tsx renders session-transcript
// bubbles for the Sessions page. That component has very different
// semantics (expandable summary, role-coloured background, tool-call
// rendering, copy-with-feedback, role-icon metadata from
// `ROLE_META`). The chat-page bubble is intentionally a different
// component: it streams live markdown, swaps left/right alignment
// by role, and shows a "Thinking..." placeholder while content is
// empty. The shared elements are limited to "an icon chip on one
// side + a rounded card" — which the chat page now also uses
// `MessageAvatar` for (sister extraction in this same commit).
//
// The "Thinking..." placeholder is intentionally a string literal,
// not the `TypingIndicator` component. `TypingIndicator` is a
// separate concern (rendered below the message list, not as a
// message in it) — moving it inside this component would conflate
// "render one message" with "show an in-flight animation". The
// existing chat-page render at line ~604 keeps the typing indicator
// outside the `.map` body.
//
// Byte-equivalence: the rendered output of this component is
// identical to the pre-extraction inline form. The 3 lines of
// difference are:
//   1. `<MessageAvatar role={msg.role} />` replaces the 2 inline
//      conditional avatar `<div>`s (left for assistant, right for user)
//   2. `renderMarkdown` is imported once at the top instead of via
//      a deep destructure from `@/lib/chat-utils`
//   3. The parent `<div className="flex gap-3 ...">` is now this
//      component's root, not a per-iteration expression inside `.map`
//
// Everything else — the bubble className switch, the "Thinking..."
// placeholder, the timestamp localeTimeString options — is
// byte-identical to the pre-extraction inline form.

import { renderMarkdown } from "@/lib/chat-utils";
import MessageAvatar from "@/components/chat/MessageAvatar";
import type { ChatMessage } from "@/types/chat";

/**
 * Render a single chat message as an avatar + bubble row. Caller
 * passes the message; this component derives alignment, avatar
 * position, and bubble colour from `msg.role`.
 *
 * The component is pure (no internal state) — the chat page owns
 * the streaming state and the `updateSessionMessages` callback. The
 * markdown render uses `renderMarkdown` directly from `@/lib/chat-utils`
 * (the same helper the inline form used).
 */
export default function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div
      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && <MessageAvatar role={msg.role} />}

      <div
        className={`max-w-[70%] rounded-xl px-4 py-3 ${
          isUser
            ? "bg-neon-cyan/10 border border-neon-cyan/20 text-white"
            : "bg-white/5 border border-white/10 text-white/80"
        }`}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {msg.content}
          </p>
        ) : (
          <div
            className="text-sm leading-relaxed prose prose-invert max-w-none"
            dangerouslySetInnerHTML={{
              __html: msg.content
                ? renderMarkdown(msg.content)
                : '<span class="text-white/30 italic">Thinking...</span>',
            }}
          />
        )}
        <div className="text-[10px] text-white/20 font-mono mt-1 text-right">
          {new Date(msg.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>

      {isUser && <MessageAvatar role={msg.role} />}
    </div>
  );
}
