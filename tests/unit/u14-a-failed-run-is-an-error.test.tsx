/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * U14 · A failed run is an error.
 *
 * When an agent run failed, the assistant's bubble rendered the reason as a
 * line of red italic prose, in the same bubble a reply would have filled, and
 * offered nothing: no role a screen reader would announce, no icon a glance
 * would catch, no way forward but to retype the prompt. The read contract
 * (T-0105) says a failed read is an error with Retry where the content would
 * have been; a failed WRITE gets the same treatment here.
 *
 * The bubble is a component and the page owns the send, so the bubble takes
 * an `onRetry` and renders Retry only when it is given one; the page passes
 * it for every bubble and the hook decides what a retry is (see
 * u14-retry-resends-the-prompt).
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { ChatMessage } from "@/types/chat";

jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());
jest.mock("@/lib/chat/chat-utils", () => ({ renderMarkdown: (s: string) => s }));

import MessageBubble from "@/components/chat/MessageBubble";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

function message(over: Partial<ChatMessage>): ChatMessage {
  return {
    id: "a1",
    conversationId: "c1",
    role: "assistant",
    content: "",
    reasoning: null,
    toolCalls: null,
    runId: "r1",
    status: "complete",
    error: null,
    createdAt: "2026-06-01T09:30:00Z",
    updatedAt: "2026-06-01T09:30:05Z",
    ...over,
  };
}

const REASON = "The gateway refused the run: model not configured.";

describe("U14 · a failed run is an error", () => {
  it("is an alert, with an icon, the reason, and a Retry that retries", () => {
    const onRetry = jest.fn();
    render(<MessageBubble msg={message({ status: "failed", error: REASON })} onRetry={onRetry} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(REASON);
    expect(alert.querySelector("svg")).not.toBeNull();

    fireEvent.click(within(alert).getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("with no reason given, it still says the run failed", () => {
    render(<MessageBubble msg={message({ status: "failed", error: null })} onRetry={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/failed/i);
  });

  it("without a way to retry, it is still an alert and offers no button", () => {
    render(<MessageBubble msg={message({ status: "failed", error: REASON })} />);
    const alert = screen.getByRole("alert");
    expect(within(alert).queryByRole("button")).toBeNull();
  });

  it("a completed reply is not an alert", () => {
    render(<MessageBubble msg={message({ content: "Done." })} onRetry={() => {}} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  });

  it("the page hands every bubble the retry, and the page hook exposes it", () => {
    expect(read("src/app/work/chat/page.tsx")).toMatch(/<MessageBubble[^>]*\bonRetry=/);
    expect(read("src/hooks/useChatPage.ts")).toMatch(/handleRetry:\s*send\.handleRetry/);
  });
});
