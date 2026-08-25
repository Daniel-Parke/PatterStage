// ═══════════════════════════════════════════════════════════════
// MessageBubble — one chat message row (avatar + bubble + meta).
//
// Renders a server-shaped ChatMessage. The assistant bubble surfaces, in
// order: collapsible reasoning, tool-call cards, then the markdown reply.
// The empty-state is driven by `status`, NOT by "content is empty" — so a
// completed-but-empty or failed run shows an explicit terminal state instead
// of a permanent "Thinking…" placeholder (the bug this rewrite fixes).
// ═══════════════════════════════════════════════════════════════

import { renderMarkdown } from "@/lib/chat-utils";
import MessageAvatar from "@/components/chat/MessageAvatar";
import ReasoningPanel from "@/components/chat/ReasoningPanel";
import ToolCallList from "@/components/chat/ToolCallList";
import type { ChatMessage } from "@/types/chat";

function AssistantBody({ msg }: { msg: ChatMessage }) {
  const hasContent = msg.content.trim().length > 0;
  if (hasContent) {
    // The content here IS model output, so the question is only whether the
    // renderer is a boundary. renderMarkdown() in @/lib/chat-utils escapes the
    // WHOLE string first (&, <, >, ", ') and only then substitutes its own five
    // constructs, so no byte the model wrote can reach the DOM as markup: a
    // reply containing a script tag renders as the visible text of a script
    // tag. The one interpolation into an attribute, the copy button's
    // data-code, is inside that same escaped string, so the quote that would
    // break out of it is already &quot;.
    return (
      <div
        className="text-sm leading-relaxed prose prose-invert max-w-none"
        // design-lint-disable-next-line no-unsanitised-html -- renderMarkdown escapes the whole message before emitting its own fixed tag set; see the note above and tests/unit/chat-utils-*.
        dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
      />
    );
  }
  // No content yet — render an explicit state from the message status.
  if (msg.status === "streaming" || msg.status === "pending") {
    return <span className="text-ps-text-muted italic text-sm">Thinking…</span>;
  }
  if (msg.status === "failed") {
    return (
      <span className="text-neon-red/80 italic text-sm">
        {msg.error || "The agent run failed."}
      </span>
    );
  }
  if (msg.status === "cancelled") {
    return <span className="text-ps-text-muted italic text-sm">Stopped.</span>;
  }
  return <span className="text-ps-text-muted italic text-sm">(no response)</span>;
}

export default function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && <MessageAvatar role={msg.role} />}

      <div
        className={`max-w-[70%] rounded-xl px-4 py-3 ${
          isUser
            ? "bg-neon-cyan/10 border border-neon-cyan/20 text-white"
            : "bg-white/5 border border-white/10 text-ps-text-primary"
        }`}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <>
            {msg.reasoning ? <ReasoningPanel reasoning={msg.reasoning} /> : null}
            {msg.toolCalls && msg.toolCalls.length > 0 ? (
              <ToolCallList toolCalls={msg.toolCalls} />
            ) : null}
            <AssistantBody msg={msg} />
          </>
        )}
        <div className="text-xs text-ps-text-faint font-mono mt-1 text-right">
          {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      {isUser && <MessageAvatar role={msg.role} />}
    </div>
  );
}
