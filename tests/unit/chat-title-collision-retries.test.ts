/** @jest-environment node */

// T-0089: round 6, finding 5, surfacing refuted. The gateway answers 400 when
// a session title already exists. PatterStage did not surface that: the catch
// swallowed it, created the conversation with sessionId null and answered
// 201, so the second "Summarise the report" chat silently lost its memory
// continuity. A collision is a name problem, not a gateway problem: retry
// once with a suffix.

import { NextRequest } from "next/server";
import { RuntimeRequestError } from "@/lib/runtime/types";

const mockCreateSession = jest.fn();
jest.mock("@/lib/runtime", () => ({ runtime: { createSession: (...a: unknown[]) => mockCreateSession(...a) } }));
const mockCreateConversation = jest.fn();
jest.mock("@/lib/chat-repository", () => ({
  createConversation: (input: unknown) => mockCreateConversation(input),
  listConversations: jest.fn(() => []),
}));
jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn(), serverErrorFromCatch: jest.fn() }));

import { POST } from "@/app/api/chat/route";

function post(body: unknown) {
  return POST(new NextRequest("http://localhost/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateConversation.mockImplementation((input: Record<string, unknown>) => ({ id: "c1", ...input }));
});

it("retries once with a suffixed title and keeps the session", async () => {
  mockCreateSession
    .mockRejectedValueOnce(new RuntimeRequestError("session title already exists", 400))
    .mockResolvedValueOnce({ id: "sess_2" });

  const res = await post({ title: "Summarise the report" });

  expect(res.status).toBe(201);
  expect(mockCreateSession).toHaveBeenCalledTimes(2);
  const [first, second] = mockCreateSession.mock.calls.map((c) => (c[0] as { title: string }).title);
  expect(first).toBe("Summarise the report");
  expect(second).not.toBe(first);
  expect(second).toContain("Summarise the report");
  expect(mockCreateConversation).toHaveBeenCalledWith(expect.objectContaining({ sessionId: "sess_2", title: "Summarise the report" }));
});

it("does not retry a failure that is not a 400", async () => {
  mockCreateSession.mockRejectedValueOnce(new RuntimeRequestError("gateway down", 503));

  const res = await post({ title: "Anything" });

  expect(res.status).toBe(201);
  expect(mockCreateSession).toHaveBeenCalledTimes(1);
  expect(mockCreateConversation).toHaveBeenCalledWith(expect.objectContaining({ sessionId: null }));
});

it("GREEN CONTROL: a clean create needs no retry", async () => {
  mockCreateSession.mockResolvedValueOnce({ id: "sess_1" });

  await post({ title: "Fresh" });

  expect(mockCreateSession).toHaveBeenCalledTimes(1);
  expect(mockCreateConversation).toHaveBeenCalledWith(expect.objectContaining({ sessionId: "sess_1" }));
});
