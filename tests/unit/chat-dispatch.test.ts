/** @jest-environment node */

// S5b — chat-dispatch: a user turn becomes an agent run threaded onto the
// conversation's Hermes session. Guards the empty-/failed-run handling (the
// stuck-"Thinking…" bug fix): the assistant placeholder is promoted to
// `streaming` on submit and to `failed` on submit error — never left pending.

jest.mock("@/lib/chat-repository", () => ({
  getConversation: jest.fn(),
  createMessage: jest.fn(),
  updateMessage: jest.fn(),
  updateConversation: jest.fn(),
  getMessages: jest.fn(),
}));
jest.mock("@/lib/runs-repository", () => ({
  createRun: jest.fn(),
  attachBackendRun: jest.fn(),
  updateRun: jest.fn(),
  getRun: jest.fn(),
}));
jest.mock("@/lib/runtime", () => ({
  runtime: { submitRun: jest.fn() },
}));
jest.mock("@/lib/db", () => ({ uuid: jest.fn(() => "run-ch-1") }));
jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));
jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));
jest.mock("@/lib/api-fetch", () => ({ messageFromError: (_e: unknown, f: string) => f }));

import { dispatchChatTurn, reconcilePendingChatMessages } from "@/lib/orchestration/chat-dispatch";
import {
  getConversation,
  createMessage,
  updateMessage,
  updateConversation,
  getMessages,
} from "@/lib/chat-repository";
import { createRun, attachBackendRun, updateRun, getRun } from "@/lib/runs-repository";
import { runtime } from "@/lib/runtime";
import { recordEvent } from "@/lib/analytics/record-event";

const mockGetConversation = getConversation as jest.Mock;
const mockCreateMessage = createMessage as jest.Mock;
const mockUpdateMessage = updateMessage as jest.Mock;
const mockUpdateConversation = updateConversation as jest.Mock;
const mockGetMessages = getMessages as jest.Mock;
const mockCreateRun = createRun as jest.Mock;
const mockAttachBackendRun = attachBackendRun as jest.Mock;
const mockUpdateRun = updateRun as jest.Mock;
const mockGetRun = getRun as jest.Mock;
const mockSubmitRun = runtime.submitRun as jest.Mock;
const mockRecordEvent = recordEvent as jest.Mock;

const conversation = {
  id: "c1",
  title: "T",
  sessionId: "sess-1",
  profileName: "bob",
  model: "gpt",
  previousResponseId: null,
  createdAt: "",
  updatedAt: "",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetConversation.mockReturnValue(conversation);
  mockCreateMessage
    .mockReturnValueOnce({ id: "user-msg" })
    .mockReturnValueOnce({ id: "assistant-msg" });
});

describe("dispatchChatTurn", () => {
  it("submits a run on the conversation's session and promotes the assistant turn to streaming", async () => {
    mockSubmitRun.mockResolvedValue({ runId: "backend-1", status: "started", sessionId: "sess-1" });

    const result = await dispatchChatTurn("c1", "hello");

    expect(result).toMatchObject({ ok: true, runId: "run-ch-1", assistantMessageId: "assistant-msg" });
    // Run row created under the CH id, submitted with the session threaded.
    expect(mockCreateRun).toHaveBeenCalledWith({ id: "run-ch-1", profileName: "bob" });
    expect(mockSubmitRun).toHaveBeenCalledWith(
      expect.objectContaining({ input: "hello", idempotencyKey: "run-ch-1", sessionId: "sess-1", profileName: "bob" }),
    );
    expect(mockAttachBackendRun).toHaveBeenCalledWith("run-ch-1", expect.objectContaining({ runId: "backend-1" }));
    // The placeholder is promoted to streaming — never left pending.
    expect(mockUpdateMessage).toHaveBeenCalledWith("assistant-msg", { status: "streaming" });
    expect(mockRecordEvent).toHaveBeenCalledWith("chat.message_sent", expect.objectContaining({ entityId: "c1" }));
  });

  it("adopts a backend-assigned session id when the conversation had none", async () => {
    mockGetConversation.mockReturnValue({ ...conversation, sessionId: null });
    mockSubmitRun.mockResolvedValue({ runId: "backend-2", status: "started", sessionId: "sess-new" });

    await dispatchChatTurn("c1", "hi");

    expect(mockUpdateConversation).toHaveBeenCalledWith("c1", { sessionId: "sess-new" });
  });

  it("marks the run and assistant turn failed on submit error (no stuck placeholder)", async () => {
    mockSubmitRun.mockRejectedValue(new Error("gateway offline"));

    const result = await dispatchChatTurn("c1", "hello");

    expect(result.ok).toBe(false);
    expect(mockUpdateRun).toHaveBeenCalledWith("run-ch-1", expect.objectContaining({ status: "failed" }));
    expect(mockUpdateMessage).toHaveBeenCalledWith("assistant-msg", expect.objectContaining({ status: "failed" }));
  });

  it("returns an error when the conversation does not exist", async () => {
    mockGetConversation.mockReturnValue(null);
    const result = await dispatchChatTurn("missing", "hi");
    expect(result).toEqual({ ok: false, error: "conversation not found" });
    expect(mockCreateMessage).not.toHaveBeenCalled();
  });
});

describe("reconcilePendingChatMessages", () => {
  beforeEach(() => {
    // Reset the createMessage queue from the outer beforeEach (unused here).
    mockCreateMessage.mockReset();
  });

  it("finalizes a streaming assistant turn whose run completed", () => {
    mockGetMessages.mockReturnValueOnce([
      { id: "a1", role: "assistant", status: "streaming", runId: "run-ch-1", content: "" },
    ]);
    mockGetRun.mockReturnValue({ id: "run-ch-1", status: "completed", output: "final answer", error: null });

    reconcilePendingChatMessages("c1");

    expect(mockUpdateMessage).toHaveBeenCalledWith(
      "a1",
      expect.objectContaining({ content: "final answer", status: "complete" }),
    );
  });

  it("leaves an in-flight run alone", () => {
    mockGetMessages.mockReturnValue([
      { id: "a1", role: "assistant", status: "streaming", runId: "run-ch-1", content: "partial" },
    ]);
    mockGetRun.mockReturnValue({ id: "run-ch-1", status: "started", output: null, error: null });

    reconcilePendingChatMessages("c1");

    expect(mockUpdateMessage).not.toHaveBeenCalled();
  });

  it("keeps streamed content when a terminal run has empty output", () => {
    mockGetMessages.mockReturnValueOnce([
      { id: "a1", role: "assistant", status: "streaming", runId: "run-ch-1", content: "partial text" },
    ]);
    mockGetRun.mockReturnValue({ id: "run-ch-1", status: "failed", output: "", error: "boom" });

    reconcilePendingChatMessages("c1");

    expect(mockUpdateMessage).toHaveBeenCalledWith(
      "a1",
      expect.objectContaining({ content: "partial text", status: "failed", error: "boom" }),
    );
  });
});
