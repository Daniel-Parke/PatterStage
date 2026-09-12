/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * U18 · The transcript says it once.
 *
 * Two things the chat screen said twice, or in the wrong place (the UI review
 * of 2026-09-08, P2).
 *
 * A failed run is an alert in the transcript with the reason and Retry
 * (T-0128), and the hook ALSO toasted the same sentence over the composer.
 * The hook does not toast a failure the transcript shows; in fast mode the
 * stream's own error goes into the bubble instead of a toast beside a
 * generic sentence. The toast stack, when it does speak, rests above the
 * composer on this screen rather than over it.
 *
 * "Gateway Offline" rendered as a centred card 60% of the column wide,
 * floating between the header and the first message; at 390 it was wider
 * than the column. A standing state is a banner: full width, role=alert, at
 * the top of the transcript. And the composer says why it is disabled rather
 * than accept a message and toast.
 */

import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { useState } from "react";

import type { ChatMessage } from "@/types/chat";

jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());
jest.mock("next/link", () => require("../helpers/mocks").nextLinkMock());
jest.mock("@/lib/chat/chat-utils", () => ({
  fetchConversation: jest.fn(),
  createConversationApi: jest.fn(),
  sendMessageApi: jest.fn(),
  finalizeMessageApi: jest.fn(),
  stopRunApi: jest.fn(),
  resolveApprovalApi: jest.fn(),
  toApiMessages: jest.fn(() => []),
  streamChatResponse: jest.fn(),
}));

import { fetchConversation, sendMessageApi, streamChatResponse } from "@/lib/chat/chat-utils";
import { useChatSend } from "@/hooks/useChatSend";
import GatewayBanner from "@/components/chat/GatewayBanner";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const stable = {
  setActiveId: jest.fn(),
  setConversations: jest.fn(),
  loadConversations: jest.fn(async () => undefined),
  refreshActiveConversation: jest.fn(async () => undefined),
  setIsStreaming: jest.fn(),
  setPendingApproval: jest.fn(),
  messagesEndRef: { current: null },
  abortRef: { current: null },
  streamGenRef: { current: 0 },
  closeStream: jest.fn(),
  streamAgentRun: jest.fn(),
  setModel: jest.fn(),
  showToast: jest.fn(),
};

function makeHarness(mode: "agent" | "fast") {
  return function useHarness() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const send = useChatSend({
      ...stable,
      activeId: "c1",
      messages,
      setMessages,
      pendingApproval: null,
      updateLocalMessage: (id, patch) =>
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m))),
      input,
      setInput,
      mode,
      model: "the-model",
      gatewayOnline: true,
    });
    return { send, messages, setInput };
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (fetchConversation as jest.Mock).mockResolvedValue({ ok: true, messages: [], conversation: { id: "c1", model: "the-model" } });
});

describe("U18 · the transcript says it once", () => {
  it("a failed send is the bubble's to say: no toast repeats it", async () => {
    (sendMessageApi as jest.Mock).mockResolvedValue({ ok: false, error: "POST /v1/runs → 500" });
    const { result } = renderHook(makeHarness("agent"));
    // The load's last step is setModel; sending before it lands lets the
    // load's setMessages wipe the failed pair.
    await waitFor(() => expect(stable.setModel).toHaveBeenCalled());
    act(() => result.current.setInput("hello"));
    await act(async () => {
      await result.current.send.handleSend();
    });
    const failed = result.current.messages.find((m) => m.role === "assistant");
    expect(failed?.status).toBe("failed");
    expect(failed?.error).toBe("POST /v1/runs → 500");
    expect(stable.showToast).not.toHaveBeenCalled();
  });

  it("in fast mode the stream's own error is the bubble's reason, not a toast", async () => {
    (sendMessageApi as jest.Mock).mockResolvedValue({
      ok: true,
      result: { runId: null, assistantMessageId: "a9", userMessageId: "u9" },
    });
    (streamChatResponse as jest.Mock).mockImplementation(
      async (_m: unknown, _model: unknown, _c: unknown, _onDelta: unknown, onError: (e: string) => void) => {
        onError("the model exploded");
        return false;
      },
    );
    const { result } = renderHook(makeHarness("fast"));
    // The load's last step is setModel; sending before it lands lets the
    // load's setMessages wipe the failed pair.
    await waitFor(() => expect(stable.setModel).toHaveBeenCalled());
    act(() => result.current.setInput("hello"));
    await act(async () => {
      await result.current.send.handleSend();
    });
    const failed = result.current.messages.find((m) => m.role === "assistant");
    expect(failed?.status).toBe("failed");
    expect(failed?.error).toBe("the model exploded");
    expect(stable.showToast).not.toHaveBeenCalled();
  });

  it("the offline notice is a full-width alert, not a floating card", () => {
    const { container } = render(<GatewayBanner status="offline" gatewayUrl="http://127.0.0.1:8642" />);
    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent(/Gateway Offline/);
    expect(banner).toHaveClass("w-full");
    expect(banner).not.toHaveClass("max-w-md");
    expect(banner).not.toHaveClass("mx-auto");
    expect(container.querySelector(".max-w-md")).toBeNull();
  });

  it("the checking state is not an alert: it is a status, and it says nothing is wrong", () => {
    render(<GatewayBanner status="checking" />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(/Checking gateway connection/)).toBeInTheDocument();
  });

  it("the composer is disabled with the reason when the gateway is offline, and the toasts lift above it", () => {
    const page = read("src/app/work/chat/page.tsx");
    expect(page).toMatch(/disabled=\{gatewayOnline === false/);
    expect(page).toMatch(/hermes gateway start/);
    expect(page).toMatch(/--ps-toast-lift/);
    expect(read("src/components/ui/Toast.tsx")).toMatch(/var\(--ps-toast-lift/);
  });
});
