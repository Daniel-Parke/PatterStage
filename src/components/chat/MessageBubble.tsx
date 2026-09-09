// ═══════════════════════════════════════════════════════════════
// MessageBubble — one chat message row (avatar + bubble + meta).
//
// Renders a server-shaped ChatMessage. The assistant bubble surfaces, in
// order: collapsible reasoning, tool-call cards, then the markdown reply.
// The empty-state is driven by `status`, NOT by "content is empty" — so a
// completed-but-empty or failed run shows an explicit terminal state instead
// of a permanent "Thinking…" placeholder (the bug this rewrite fixes).
// ═══════════════════════════════════════════════════════════════

import { AlertTriangle, RotateCcw } from "lucide-react";

import { renderMarkdown } from "@/lib/chat-utils";
import Button from "@/components/ui/Button";
import MessageAvatar from "@/components/chat/MessageAvatar";
import ReasoningPanel from "@/components/chat/ReasoningPanel";
import ToolCallList from "@/components/chat/ToolCallList";
import type { ChatMessage } from "@/types/chat";

function AssistantBody({ msg, onRetry }: { msg: ChatMessage; onRetry?: () => void }) {
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
        className="text-body leading-relaxed prose prose-invert max-w-none"
        // design-lint-disable-next-line no-unsanitised-html -- renderMarkdown escapes the whole message before emitting its own fixed tag set; see the note above and tests/unit/chat-utils-*.
        dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
      />
    );
  }
  // No content yet — render an explicit state from the message status.
  if (msg.status === "streaming" || msg.status === "pending") {
    return <span className="text-ps-text-muted italic text-body">Thinking…</span>;
  }
  if (msg.status === "failed") {
    // A failed run is an error, not a line of red italic prose where the reply
    // would have been: announced (role=alert), seen at a glance (the icon),
    // explained (the reason the gateway gave), and with a way forward. The
    // read contract (T-0105) gives a failed READ Retry where the content would
    // have been; a failed WRITE gets the same here. Retry is the page's to
    // wire, so it renders only when the page hands one in (T-0128).
    return (
      <div role="alert" className="flex flex-wrap items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-fail" aria-hidden />
        <div className="min-w-0 flex-1 text-body">
          <p className="font-semibold text-status-fail">The run failed.</p>
          <p className="text-ps-text-secondary">{msg.error || "No reason came back with it."}</p>
        </div>
        {onRetry && (
          // basis-full below sm, like every banner's action (T-0131): beside
          // the words in a phone-width bubble, Retry left them 35% of the
          // row and the reason read one word per line.
          <Button type="button" size="sm" icon={RotateCcw} onClick={onRetry} className="basis-full sm:basis-auto">
            Retry
          </Button>
        )}
      </div>
    );
  }
  if (msg.status === "cancelled") {
    return <span className="text-ps-text-muted italic text-body">Stopped.</span>;
  }
  return <span className="text-ps-text-muted italic text-body">(no response)</span>;
}

export default function MessageBubble({ msg, onRetry }: { msg: ChatMessage; onRetry?: () => void }) {
  const isUser = msg.role === "user";
  const isFailed = !isUser && msg.status === "failed";
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && <MessageAvatar role={msg.role} />}

      <div
        // 85% on a phone: 70% of a 358px transcript is 250px, and a bubble
        // that narrow wrapped a failed run's reason one word per line
        // (T-0131). From sm the 70% that keeps a conversation readable holds.
        className={`max-w-[85%] sm:max-w-[70%] rounded-ps-lg px-4 py-3 ${
          isUser
            ? "bg-neon-cyan/10 border border-neon-cyan/20 text-ps-text-primary"
            : isFailed
              ? "bg-ps-surface-raised border border-status-fail/40 text-ps-text-primary"
              : "bg-ps-surface-raised border border-ps-edge-hairline text-ps-text-primary"
        }`}
      >
        {isUser ? (
          <p className="text-body leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <>
            {msg.reasoning ? <ReasoningPanel reasoning={msg.reasoning} /> : null}
            {msg.toolCalls && msg.toolCalls.length > 0 ? (
              <ToolCallList toolCalls={msg.toolCalls} />
            ) : null}
            <AssistantBody msg={msg} onRetry={onRetry} />
          </>
        )}
        <div className="text-micro text-ps-text-faint font-mono mt-1 text-right">
          {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      {isUser && <MessageAvatar role={msg.role} />}
    </div>
  );
}
