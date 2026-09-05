// ═══════════════════════════════════════════════════════════════
// useChatConversations — the sidebar list and which one is active
// ═══════════════════════════════════════════════════════════════
//
// Split out of useChatPage (Phase 4 god-file decomposition). Owns the
// server-persisted conversation list, the active id, and the four
// things a user does to a row: start a new one, select it, delete it,
// export it. Plus `refreshActiveConversation`, the reconciliation read
// the stream falls back to when the socket closes without a terminal
// event.
//
// Composed after useChatTranscript because every one of these actions
// tears down whatever stream is live before it changes what is on
// screen.

"use client";

import { useCallback, useEffect, useState } from "react";
import type { Dispatch, MouseEvent, RefObject, SetStateAction } from "react";

import type { ToastType } from "@/components/ui/Toast";
import type { ChatConversation, ChatMessage } from "@/types/chat";
import { safeApiCall } from "@/lib/api-fetch";
import {
  fetchConversation,
  createConversationApi,
  deleteConversationApi,
  conversationToJson,
  conversationToCsv,
  sanitiseFilename,
  downloadFile,
} from "@/lib/chat-utils";
import { stopEvent, type PendingApproval } from "@/hooks/chat-local-message";

type ToastFn = (message: string, type?: ToastType) => void;

export interface UseChatConversationsArgs {
  /** Tear down the live run-event stream / fast-mode fetch. */
  closeStream: () => void;
  // No `messages` here on purpose: the export used to read the open
  // conversation's turns rather than the clicked row's (D43), and the only way
  // to make that mistake unrepeatable is to stop handing this hook the
  // transcript at all.
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setIsStreaming: Dispatch<SetStateAction<boolean>>;
  setPendingApproval: Dispatch<SetStateAction<PendingApproval | null>>;
  /** The model a newly created conversation is stamped with. */
  model: string;
  setInput: Dispatch<SetStateAction<string>>;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  showToast: ToastFn;
}

export function useChatConversations({
  closeStream,
  setMessages,
  setIsStreaming,
  setPendingApproval,
  model,
  setInput,
  inputRef,
  showToast,
}: UseChatConversationsArgs) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  // The list read's failure, kept apart from the list: the sidebar rendered
  // "No conversations yet" over a 500 because the reader swallowed the
  // failure into an empty array (T-0096, the read contract).
  const [listError, setListError] = useState<string | null>(null);

  // ── Load conversations on mount ─────────────────────────────
  const loadConversations = useCallback(async () => {
    const res = await safeApiCall<{ data?: { conversations?: ChatConversation[] } }>("/api/chat");
    if (!res.ok) {
      setListError(res.error ?? "Failed to load conversations");
      return [] as ChatConversation[];
    }
    const list = res.data?.data?.conversations ?? [];
    setListError(null);
    setConversations(list);
    return list;
  }, []);

  useEffect(() => {
    void (async () => {
      const list = await loadConversations();
      if (list.length > 0) setActiveId(list[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshActiveConversation = useCallback(async () => {
    if (!activeId) return;
    const loaded = await fetchConversation(activeId);
    // A reconciliation read that failed leaves the transcript as it is; the
    // stream's own terminal state already says what happened.
    if (loaded.ok && loaded.messages) setMessages(loaded.messages);
  }, [activeId, setMessages]);

  // ── New conversation ────────────────────────────────────────
  const handleNewChat = useCallback(async () => {
    closeStream();
    // Reuse an existing blank "New Chat" instead of creating a duplicate.
    // Sending a message auto-titles the conversation, so a still-"New Chat"
    // entry is an unused blank one — and creating a second collides on the
    // session title (invalid_title). Just switch to the existing blank.
    const existingBlank = conversations.find((c) => c.title === "New Chat");
    if (existingBlank) {
      setActiveId(existingBlank.id);
      setMessages([]);
      setInput("");
      inputRef.current?.focus();
      return;
    }
    const conversation = await createConversationApi({ title: "New Chat", model });
    if (!conversation) {
      showToast("Failed to start a new conversation", "error");
      return;
    }
    setConversations((prev) => [conversation, ...prev]);
    setActiveId(conversation.id);
    setMessages([]);
    setInput("");
    inputRef.current?.focus();
  }, [closeStream, conversations, model, showToast, setMessages, setInput, inputRef]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      if (id === activeId) return;
      closeStream();
      setIsStreaming(false);
      setPendingApproval(null);
      setActiveId(id);
    },
    [activeId, closeStream, setIsStreaming, setPendingApproval],
  );

  // ── Delete conversation ─────────────────────────────────────
  const handleDeleteConversation = useCallback(
    async (id: string, e?: MouseEvent) => {
      stopEvent(e);
      if (id === activeId) closeStream();
      const { ok, error } = await deleteConversationApi(id);
      if (!ok) {
        showToast(error || "Failed to delete conversation", "error");
        return;
      }
      setConversations((prev) => {
        const remaining = prev.filter((c) => c.id !== id);
        if (id === activeId) setActiveId(remaining.length > 0 ? remaining[0].id : null);
        return remaining;
      });
      showToast("Conversation deleted", "success");
    },
    [activeId, closeStream, showToast],
  );

  // ── Download conversation ───────────────────────────────────
  //
  // This read is the fix for D43. The handler used to close over `messages` —
  // the turns of whatever conversation was CURRENTLY OPEN — and serialise them
  // under the CLICKED row's title and id. Every sidebar row carries the two
  // download buttons and none of them selects the row first, so exporting any
  // row but the active one handed the operator a different conversation's words
  // in a file named after this one. Plausible, silent and wrong. So we fetch the
  // row's own transcript, and say so when we cannot.
  const handleDownloadConversation = useCallback(
    async (conversation: ChatConversation, format: "json" | "csv", e?: MouseEvent) => {
      stopEvent(e);
      const loaded = await fetchConversation(conversation.id);
      if (!loaded.ok || !loaded.messages) {
        showToast("Failed to export conversation", "error");
        return;
      }
      const safeTitle = sanitiseFilename(conversation.title);
      const ts = Date.now();
      if (format === "json") {
        downloadFile(
          conversationToJson(conversation, loaded.messages),
          `${safeTitle}_${ts}.json`,
          "application/json",
        );
        showToast("Conversation exported as JSON", "success");
      } else {
        downloadFile(conversationToCsv(loaded.messages), `${safeTitle}_${ts}.csv`, "text/csv");
        showToast("Conversation exported as CSV", "success");
      }
    },
    [showToast],
  );

  const activeConversation = conversations.find((c) => c.id === activeId);
  const hasActiveConversation = activeConversation !== undefined;

  return {
    conversations,
    setConversations,
    listError,
    activeId,
    setActiveId,
    activeConversation,
    hasActiveConversation,
    loadConversations,
    refreshActiveConversation,
    handleNewChat,
    handleSelectConversation,
    handleDeleteConversation,
    handleDownloadConversation,
  };
}
