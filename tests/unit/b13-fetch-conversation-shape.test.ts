/** @jest-environment node */

// ═══════════════════════════════════════════════════════════════
// B13 sweep answer: `fetchConversation` itself.
//
// The chat oracle mocks this function, because what it is about is which
// conversation the page asks for and what it does with the answer. That left
// the function's own contract untested: a version that reported every failure
// as a success, or that handed back an undefined transcript as though it were
// an empty one, passed the whole suite. Both matter — the download path writes
// a file from `loaded.messages`, and the load path clears the screen on
// `!loaded.ok`.
// ═══════════════════════════════════════════════════════════════

const safeApiCall = jest.fn();
jest.mock("@/lib/api-fetch", () => ({
  safeApiCall: (...a: unknown[]) => safeApiCall(...a),
  messageFromError: (_e: unknown, fallback: string) => fallback,
}));

import { fetchConversation } from "@/lib/chat-utils";

const CONVERSATION = { id: "c-1", title: "Alpha", model: "m", createdAt: "", updatedAt: "" };
const MESSAGES = [{ id: "m-1", role: "user", content: "hello", createdAt: "" }];

beforeEach(() => jest.clearAllMocks());

describe("fetchConversation", () => {
  it("asks for the id it was given", async () => {
    safeApiCall.mockResolvedValue({ ok: true, data: { data: { conversation: CONVERSATION, messages: MESSAGES } } });
    await fetchConversation("c-9");
    expect(safeApiCall).toHaveBeenCalledWith("/api/chat/c-9");
  });

  it("unwraps both envelopes on a good read", async () => {
    safeApiCall.mockResolvedValue({ ok: true, data: { data: { conversation: CONVERSATION, messages: MESSAGES } } });
    const loaded = await fetchConversation("c-1");
    expect(loaded.ok).toBe(true);
    expect(loaded.conversation).toEqual(CONVERSATION);
    expect(loaded.messages).toEqual(MESSAGES);
  });

  it("reports a refused read as a failure, carrying the reason", async () => {
    safeApiCall.mockResolvedValue({ ok: false, error: "Conversation unavailable (500)" });
    const loaded = await fetchConversation("c-1");
    // ok:true here would let the download path serialise `undefined` messages
    // and the load path leave the previous conversation on screen.
    expect(loaded.ok).toBe(false);
    expect(loaded.error).toBe("Conversation unavailable (500)");
    expect(loaded.messages).toBeUndefined();
  });

  it("reports a 200 with no payload as a failure, not as an empty transcript", async () => {
    safeApiCall.mockResolvedValue({ ok: true, data: {} });
    const loaded = await fetchConversation("c-1");
    // An empty transcript and an unreadable one look identical on screen, and
    // exporting the first is a file with no turns in it.
    expect(loaded.ok).toBe(false);
    expect(loaded.error).toMatch(/empty/i);
  });

  it("a genuinely empty conversation is still a success", async () => {
    safeApiCall.mockResolvedValue({ ok: true, data: { data: { conversation: CONVERSATION, messages: [] } } });
    const loaded = await fetchConversation("c-1");
    expect(loaded.ok).toBe(true);
    expect(loaded.messages).toEqual([]);
  });
});
