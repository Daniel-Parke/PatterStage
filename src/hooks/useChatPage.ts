// ═══════════════════════════════════════════════════════════════
// useChatPage — composition root of the server-persisted agent chat.
//
// Conversations live on the server (chat-repository). A turn is sent via
// POST /api/chat/[id]/messages; in "agent" mode the reply streams from the
// run-event SSE (/api/runs/[runId]/events) — rendering deltas, reasoning,
// tool cards, and HITL approvals — and is finalized via PATCH. "Fast" mode
// streams a raw model reply from the gateway. An assistant turn is never left
// as a stuck "Thinking…" placeholder: empty/aborted/failed runs resolve to an
// explicit terminal status.
//
// The slices, in the order they are composed:
//   useChatInput           draft text, mode toggle, model picker
//   useChatTranscript      the rendered turns + the live stream handle
//   useGatewayHealth       online/auth banners + the model registry
//   useChatConversations   the sidebar list, active id, row actions
//   useAgentRunStream      run events into one assistant message
//   useChatSend            send / stop / approve, and the two transcript
//                          effects
//
// Order is load-bearing: the transcript's `closeStream` has to exist
// before anything that tears a stream down, and the effects must still
// fire in the sequence gateway health, load conversations, load the
// active conversation, auto-scroll, unmount cleanup, copy delegation.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useEffect } from "react";

import { useToast } from "@/components/ui/Toast";
import { COPY_BTN_CLASS, COPY_BTN_DATA_ATTR } from "@/lib/chat-utils";
import { useGatewayHealth } from "@/hooks/useGatewayHealth";
import { useChatInput } from "@/hooks/useChatInput";
import { useChatTranscript } from "@/hooks/useChatTranscript";
import { useChatConversations } from "@/hooks/useChatConversations";
import { useAgentRunStream } from "@/hooks/useAgentRunStream";
import { useChatSend } from "@/hooks/useChatSend";

export function useChatPage() {
  const { showToast, toastElement } = useToast();

  const composer = useChatInput();
  const transcript = useChatTranscript();

  const {
    online: gatewayOnline,
    authConfigured: gatewayAuthConfigured,
    agentDefaultModelSet,
    registryModelIds,
    modelLabels,
    modelsError,
    modelsLoading,
  } = useGatewayHealth();

  const conversations = useChatConversations({
    closeStream: transcript.closeStream,
    messages: transcript.messages,
    setMessages: transcript.setMessages,
    setIsStreaming: transcript.setIsStreaming,
    setPendingApproval: transcript.setPendingApproval,
    model: composer.model,
    setInput: composer.setInput,
    inputRef: composer.inputRef,
    showToast,
  });

  const { streamAgentRun } = useAgentRunStream({
    esRef: transcript.esRef,
    streamGenRef: transcript.streamGenRef,
    updateLocalMessage: transcript.updateLocalMessage,
    setIsStreaming: transcript.setIsStreaming,
    setPendingApproval: transcript.setPendingApproval,
    loadConversations: conversations.loadConversations,
    refreshActiveConversation: conversations.refreshActiveConversation,
  });

  const send = useChatSend({
    activeId: conversations.activeId,
    setActiveId: conversations.setActiveId,
    setConversations: conversations.setConversations,
    loadConversations: conversations.loadConversations,
    refreshActiveConversation: conversations.refreshActiveConversation,
    messages: transcript.messages,
    setMessages: transcript.setMessages,
    setIsStreaming: transcript.setIsStreaming,
    pendingApproval: transcript.pendingApproval,
    setPendingApproval: transcript.setPendingApproval,
    messagesEndRef: transcript.messagesEndRef,
    abortRef: transcript.abortRef,
    streamGenRef: transcript.streamGenRef,
    updateLocalMessage: transcript.updateLocalMessage,
    closeStream: transcript.closeStream,
    streamAgentRun,
    input: composer.input,
    setInput: composer.setInput,
    mode: composer.mode,
    model: composer.model,
    setModel: composer.setModel,
    gatewayOnline,
    showToast,
  });

  // Cleanup any live stream on unmount.
  useEffect(() => transcript.closeStream, [transcript.closeStream]);

  // ── Copy-code-block delegation (renderMarkdown injects the buttons) ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains(COPY_BTN_CLASS)) {
        const code = target.getAttribute(COPY_BTN_DATA_ATTR) || "";
        void navigator.clipboard.writeText(code).then(() => showToast("Code copied", "success"));
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [showToast]);

  return {
    toastElement,
    // model dropdown
    model: composer.model,
    handleModelChange: composer.handleModelChange,
    registryModelIds,
    modelLabels,
    modelsLoading,
    modelsError,
    // mode toggle
    mode: composer.mode,
    handleModeChange: composer.handleModeChange,
    // conversations
    conversations: conversations.conversations,
    activeConversation: conversations.activeConversation,
    activeId: conversations.activeId,
    hasActiveConversation: conversations.hasActiveConversation,
    handleSelectConversation: conversations.handleSelectConversation,
    handleNewChat: conversations.handleNewChat,
    handleDeleteConversation: conversations.handleDeleteConversation,
    handleDownloadConversation: conversations.handleDownloadConversation,
    // gateway banners
    gatewayOnline,
    gatewayAuthConfigured,
    agentDefaultModelSet,
    // messages + streaming
    messages: transcript.messages,
    isStreaming: transcript.isStreaming,
    pendingApproval: transcript.pendingApproval,
    handleApproval: send.handleApproval,
    messagesEndRef: transcript.messagesEndRef,
    inputRef: composer.inputRef,
    input: composer.input,
    setInput: composer.setInput,
    handleKeyDown: send.handleKeyDown,
    handleSend: send.handleSend,
    handleStop: send.handleStop,
  };
}
