/**
 * U14 · Retry re-sends the prompt.
 *
 * What a retry IS, decided once in the hook rather than in the bubble: the
 * failed assistant turn and the user turn that asked for it leave the
 * transcript, and the same words are sent again as a new turn, so the screen
 * reads as one attempt rather than a prompt stated twice with a failure in
 * between. A second failure lands on the new turn, with its own reason and
 * its own Retry.
 *
 * The hook already owned the send; this splits the body it ran for `input`
 * into one that runs for any text, and handleSend and handleRetry both call
 * it. The harness holds the message list in real state so the hook's own
 * updates are what the assertions read.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";

import type { ChatMessage } from "@/types/chat";

jest.mock("@/lib/chat-utils", () => ({
  fetchConversation: jest.fn(),
  createConversationApi: jest.fn(),
  sendMessageApi: jest.fn(),
  finalizeMessageApi: jest.fn(),
  stopRunApi: jest.fn(),
  resolveApprovalApi: jest.fn(),
  toApiMessages: jest.fn(() => []),
  streamChatResponse: jest.fn(),
}));

import { fetchConversation, sendMessageApi } from "@/lib/chat-utils";
import { useChatSend } from "@/hooks/useChatSend";

const PROMPT = "Summarise the last run";

const userTurn: ChatMessage = {
  id: "u1",
  conversationId: "c1",
  role: "user",
  content: PROMPT,
  status: "complete",
  createdAt: "2026-06-01T09:30:00Z",
  updatedAt: "2026-06-01T09:30:00Z",
};
const failedTurn: ChatMessage = {
  id: "a1",
  conversationId: "c1",
  role: "assistant",
  content: "",
  runId: null,
  status: "failed",
  error: "gateway said no",
  createdAt: "2026-06-01T09:30:01Z",
  updatedAt: "2026-06-01T09:30:02Z",
};

function useHarness() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const send = useChatSend({
    activeId: "c1",
    setActiveId: jest.fn(),
    setConversations: jest.fn(),
    loadConversations: jest.fn(async () => undefined),
    refreshActiveConversation: jest.fn(async () => undefined),
    messages,
    setMessages,
    setIsStreaming: jest.fn(),
    pendingApproval: null,
    setPendingApproval: jest.fn(),
    messagesEndRef: { current: null },
    abortRef: { current: null },
    streamGenRef: { current: 0 },
    updateLocalMessage: (id, patch) =>
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m))),
    closeStream: jest.fn(),
    streamAgentRun: jest.fn(),
    input,
    setInput,
    mode: "agent",
    model: "the-model",
    setModel: jest.fn(),
    gatewayOnline: true,
    showToast: jest.fn(),
  });
  return { send, messages };
}

beforeEach(() => {
  jest.clearAllMocks();
  (fetchConversation as jest.Mock).mockResolvedValue({
    ok: true,
    messages: [userTurn, failedTurn],
    conversation: { id: "c1", model: "the-model" },
  });
  (sendMessageApi as jest.Mock).mockResolvedValue({ ok: false, error: "still no" });
});

describe("U14 · Retry re-sends the prompt", () => {
  it("sends the same words again and shows one attempt", async () => {
    const { result } = renderHook(useHarness);
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    await act(async () => {
      await result.current.send.handleRetry("a1");
    });

    expect(sendMessageApi).toHaveBeenCalledTimes(1);
    expect(sendMessageApi).toHaveBeenCalledWith("c1", PROMPT, "agent");

    const users = result.current.messages.filter((m) => m.role === "user");
    expect(users.map((m) => m.content)).toEqual([PROMPT]);
    expect(result.current.messages.find((m) => m.id === "a1")).toBeUndefined();

    // The second failure is reported on the new turn.
    const assistants = result.current.messages.filter((m) => m.role === "assistant");
    expect(assistants).toHaveLength(1);
    expect(assistants[0].status).toBe("failed");
    expect(assistants[0].error).toBe("still no");
  });

  it("does nothing for an id that is not a failed assistant turn", async () => {
    const { result } = renderHook(useHarness);
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    await act(async () => {
      await result.current.send.handleRetry("u1");
      await result.current.send.handleRetry("nope");
    });

    expect(sendMessageApi).not.toHaveBeenCalled();
    expect(result.current.messages).toHaveLength(2);
  });
});
