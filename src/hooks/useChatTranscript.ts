// ═══════════════════════════════════════════════════════════════
// useChatTranscript — the rendered turns and the live stream handle
// ═══════════════════════════════════════════════════════════════
//
// Split out of useChatPage (Phase 4 god-file decomposition). Owns the
// message rows on screen, the two flags the composer reads off them
// (`isStreaming`, `pendingApproval`), and the handle to whatever stream
// is currently filling them: the run-event EventSource, the fast-mode
// fetch's AbortController, and the generation counter that makes a
// superseded stream's callbacks no-ops.
//
// Deliberately the first slice composed, and deliberately effect-free:
// every other slice needs `closeStream` or `updateLocalMessage`, so
// this one must be able to exist before any of them.

"use client";

import { useCallback, useRef, useState } from "react";

import type { ChatMessage } from "@/types/chat";
import type { PendingApproval } from "@/hooks/chat-local-message";

export function useChatTranscript() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamGenRef = useRef(0);

  const updateLocalMessage = useCallback(
    (id: string, patch: Partial<ChatMessage>) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    },
    [],
  );

  const closeStream = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  return {
    messages,
    setMessages,
    isStreaming,
    setIsStreaming,
    pendingApproval,
    setPendingApproval,
    messagesEndRef,
    esRef,
    abortRef,
    streamGenRef,
    updateLocalMessage,
    closeStream,
  };
}
