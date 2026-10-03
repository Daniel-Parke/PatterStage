// ═══════════════════════════════════════════════════════════════
// useChatConversations — the sidebar list and which one is active
// ═══════════════════════════════════════════════════════════════
//
// Owns the server-persisted conversation list, the active id, and the four
// things a user does to a row: start a new one, select it, delete it,
// export it. Plus `refreshActiveConversation`, the reconciliation read
// the stream falls back to when the socket closes without a terminal
// event.
//
// Composed after useChatTranscript because every one of these actions
// tears down whatever stream is live before it changes what is on
// screen.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, MouseEvent, RefObject, MutableRefObject, SetStateAction } from "react";

import type { FeedbackContextValue } from "@/components/ui/feedback-context";
import type { ChatConversation, ChatMessage } from "@/types/chat";
import { useApiResource } from "@/hooks/useApiResource";
import {
  fetchConversation,
  createConversationApi,
  deleteConversationApi,
  conversationToJson,
  conversationToCsv,
  sanitiseFilename,
  downloadFile,
} from "@/lib/chat/chat-utils";
import { stopEvent, type PendingApproval } from "@/hooks/chat-local-message";

type ToastFn = FeedbackContextValue["showToast"];

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
  inputVersion: MutableRefObject<number>;
  streamGenRef: MutableRefObject<number>;
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
  inputVersion,
  streamGenRef,
  inputRef,
  showToast,
}: UseChatConversationsArgs) {
  // The list is a read like any other (T-0129): cached, deduped, and re-read
  // through `refetch` after a send lands. The local copy below exists because
  // the row actions edit the list ahead of the server (a new row is prepended
  // the moment it is created, a deleted one drops at once) and the send hook
  // writes titles through `setConversations`; the read seeds it and every
  // later answer replaces it.
  const list = useApiResource<ChatConversation[]>("/api/chat", {
    select: (p) => (p as { conversations?: ChatConversation[] } | null)?.conversations ?? [],
    errorMessage: "Failed to load conversations",
  });
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const setActiveId = useCallback<Dispatch<SetStateAction<string | null>>>((update) => {
    const id = typeof update === "function" ? update(activeIdRef.current) : update;
    activeIdRef.current = id;
    setActiveIdState(id);
  }, []);
  // The list read's failure, kept apart from the list: the sidebar rendered
  // "No conversations yet" over a 500 because the reader swallowed the
  // failure into an empty array (T-0096, the read contract).
  const listError = list.error;

  // The first answer picks the active row, and only the first: a later
  // re-read must not move the operator off the conversation they opened.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!list.data) return;
    setConversations(list.data);
    if (seededRef.current) return;
    seededRef.current = true;
    if (list.data.length > 0) setActiveId(list.data[0].id);
  }, [list.data, setActiveId]);

  const { refetch: refetchList } = list;
  const loadConversations = useCallback(async () => {
    const answer = await refetchList();
    return answer.data?.value ?? ([] as ChatConversation[]);
  }, [refetchList]);

  const refreshActiveConversation = useCallback(async (gen = streamGenRef.current, id = activeId) => {
    if (!id || gen !== streamGenRef.current) return;
    const loaded = await fetchConversation(id);
    // A reconciliation read that failed leaves the transcript as it is; the
    // stream's own terminal state already says what happened.
    if (gen === streamGenRef.current && loaded.ok && loaded.messages) setMessages(loaded.messages);
  }, [activeId, setMessages, streamGenRef]);

  // ── New conversation ────────────────────────────────────────
  const handleNewChat = useCallback(async () => {
    closeStream();
    const gen = streamGenRef.current;
    const draftVersion = inputVersion.current;
    seededRef.current = true;
    setIsStreaming(false);
    setPendingApproval(null);
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
      if (gen === streamGenRef.current) showToast("Failed to start a new conversation", "error");
      return;
    }
    setConversations((prev) => [conversation, ...prev]);
    if (gen !== streamGenRef.current) return;
    setActiveId(conversation.id);
    setMessages([]);
    if (draftVersion === inputVersion.current) setInput("");
    inputRef.current?.focus();
  }, [closeStream, conversations, model, showToast, setMessages, setInput, inputRef, inputVersion, streamGenRef, setIsStreaming, setPendingApproval, setActiveId]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      if (id === activeId) return;
      closeStream();
      seededRef.current = true;
      setIsStreaming(false);
      setPendingApproval(null);
      setMessages([]);
      setActiveId(id);
    },
    [activeId, closeStream, setIsStreaming, setPendingApproval, setMessages, setActiveId],
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
      if (activeIdRef.current === id) {
        closeStream();
        setIsStreaming(false);
        setPendingApproval(null);
        setMessages([]);
      }
      setConversations((prev) => {
        const remaining = prev.filter((c) => c.id !== id);
        setActiveId((current) => current === id ? (remaining[0]?.id ?? null) : current);
        return remaining;
      });
      showToast("Conversation deleted", "success");
    },
    [activeId, closeStream, showToast, setIsStreaming, setPendingApproval, setMessages, setActiveId],
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
