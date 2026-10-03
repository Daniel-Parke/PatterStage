/** @jest-environment jsdom */
import { act, fireEvent, render, screen, cleanup } from "@testing-library/react";
import ChatPage from "@/app/work/chat/page";
import { renderWithQuery } from "../helpers/render-with-query";
import { jsonResponse } from "../helpers/fetch-map";
import MessageBubble from "@/components/chat/MessageBubble";
import { SimpleMarkdown } from "@/components/skills/SimpleMarkdown";
import type { ChatMessage } from "@/types/chat";

const message = (content: string, role: ChatMessage["role"] = "assistant"): ChatMessage => ({
  id: "oracle-message", conversationId: "oracle-conversation", role, content,
  reasoning: null, toolCalls: null, runId: null, status: "complete", error: null,
  createdAt: "2026-10-03T00:00:00Z", updatedAt: "2026-10-03T00:00:00Z",
});

describe("T0191 Chat markdown public contract", () => {
  it.each(["https://example.test/path", "http://example.test", "mailto:reader@example.test", "/results/sessions"])("preserves allowed link %s in the actual assistant bubble", (href) => {
    render(<MessageBubble msg={message(`[destination](${href})`)} />);
    expect(screen.getByRole("link", { name: "destination" })).toHaveAttribute("href", href);
  });
  it.each(["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,unsafe", "vbscript:msgbox(1)", "java&#x73;cript:alert(1)", "java\tscript:alert(1)"])("rejects unsafe or obfuscated scheme %s through both public renderers", (href) => {
    const { container } = render(<><MessageBubble msg={message(`[unsafe](${href})`)} /><SimpleMarkdown content={`[unsafe](${href})`} /></>);
    for (const link of container.querySelectorAll("a[href]")) {
      const target = (link.getAttribute("href") ?? "").replace(/[\u0000-\u0020]/g, "");
      expect(target).not.toMatch(/^(?:javascript|vbscript|data):/i);
      expect(target).not.toMatch(/&#/);
    }
    expect(container.textContent).toContain("unsafe");
  });
  it("equivalent streaming chunkings converge on the same safe rendered content", () => {
    const content = "<script>alert(1)</script>\n\n```text\n  exact  spaces\n```\n[guide](https://example.test)";
    const { container, rerender } = render(<MessageBubble msg={message("")} />);
    for (const size of [1, 7, 19]) {
      for (let end = size; end < content.length; end += size) {
        rerender(<MessageBubble msg={message(content.slice(0, end))} />);
        expect(container.querySelector("script")).toBeNull();
      }
      rerender(<MessageBubble msg={message(content)} />);
      expect(screen.getByRole("link", { name: "guide" })).toHaveAttribute("href", "https://example.test");
      expect(container.querySelector("pre")?.textContent).toContain("  exact  spaces");
      expect(container.textContent).toContain("<script>alert(1)</script>");
    }
  });
  it.each(["user", "assistant"] as const)("keeps %s text safe with a long incomplete fence", (role) => {
    const text = "```text\n" + "a <b> & ".repeat(2000);
    const { container } = render(<MessageBubble msg={message(text, role)} />);
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toContain("a <b> &");
  });
  it.each([false, true])("Copy preserves whitespace and reports refusal=%s truthfully", async (refused) => {
    const text = "  leading\n\ntrailing  \n";
    const writeText = jest.fn().mockImplementation(() => refused ? Promise.reject(new Error("Clipboard refused")) : Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const saved = globalThis.fetch;
    const conversation = { id: "oracle-conversation", title: "Copy contract", model: "fixture", sessionId: null, profileName: null, previousResponseId: null, createdAt: "2026-10-03", updatedAt: "2026-10-03" };
    globalThis.fetch = jest.fn(async input => {
      const url = String(input);
      if (url === "/api/chat") return jsonResponse({ data: { conversations: [conversation] } });
      if (url === "/api/chat/oracle-conversation") return jsonResponse({ data: { conversation, messages: [message("```text\n" + text + "```")] } });
      if (url === "/api/gateway/health") return jsonResponse({ data: { online: false, authConfigured: true } });
      if (url === "/api/models/defaults") return jsonResponse({ data: { defaults: {}, modelReadiness: { ready: true } } });
      if (url === "/api/models" || url === "/api/gateway/models") return jsonResponse({ data: { models: [] } });
      throw new Error(`Unexpected Chat HTTP: ${url}`);
    });
    try {
    renderWithQuery(<ChatPage />);
    await screen.findByRole("button", { name: /^Copy$/i });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /^Copy$/i })); });
    expect(writeText).toHaveBeenCalledWith(text);
    if (refused) {
      expect(screen.queryByText(/^copied!?$/i)).not.toBeInTheDocument();
      expect(screen.getByText(/clipboard|could not copy|couldn't copy|copy failed/i)).toBeVisible();
    } else expect(document.body.textContent).toMatch(/copied/i);
    } finally { cleanup(); globalThis.fetch = saved; }
  });
});

import { MessageBubble as SessionMessageBubble } from "@/components/session/MessageBubble";
import { pendingLookup } from "../helpers/mission-async-deferred";
import { FeedbackProvider } from "@/components/providers/FeedbackProvider";

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
afterEach(() => { if (clipboardDescriptor) Object.defineProperty(navigator, "clipboard", clipboardDescriptor); else Reflect.deleteProperty(navigator, "clipboard"); });
describe("T0191 actual Session Copy confirmation", () => {
  function mountHeldCopy() {
    const held = pendingLookup<void>();
    // Observe rejection on the same promise before handing it to the consumer;
    // an ignored promise must produce a behavioural red, not an unhandled one.
    void held.promise.catch(() => undefined);
    const write = jest.fn(() => held.promise);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: write } });
    const content = "  Synthetic transcript\nexact trailing  \n";
    const view = renderWithQuery(<FeedbackProvider><SessionMessageBubble msg={{ index: 0, role: "assistant", content }} index={0} messageRefs={{ current: new Map() }} expandAll /></FeedbackProvider>);
    fireEvent.click(screen.getByRole("button", { name: /copy/i }));
    expect(write).toHaveBeenCalledWith(content);
    return { held, view };
  }
  const confirmation = () => screen.queryByText(/copied/i) ?? screen.queryByTitle(/copied/i) ?? screen.queryByRole("button", { name: /^Copy$/i })?.querySelector("svg.lucide-check") ?? null;
  it("does not announce Copied while the clipboard promise is pending", async () => {
    const { held } = mountHeldCopy();
    try { expect(confirmation()).not.toBeInTheDocument(); }
    finally { await act(async () => { held.complete(); }); }
  });
  it("clipboard refusal cannot announce Copied and remains visible", async () => {
    const { held } = mountHeldCopy();
    await act(async () => { held.fail(new Error("Owned clipboard refusal")); });
    expect(confirmation()).not.toBeInTheDocument();
    expect(document.body.textContent).toMatch(/clipboard|could not copy|couldn't copy|copy failed/i);
  });
  it("confirmed clipboard success announces Copied", async () => {
    const { held } = mountHeldCopy();
    await act(async () => { held.complete(); });
    expect(confirmation()).toBeInTheDocument();
  });
  it.each(["success", "refusal"])("unmounted Session Copy ignores late %s feedback", async outcome => {
    const { held, view } = mountHeldCopy(); view.unmount();
    renderWithQuery(<FeedbackProvider><p>New screen</p></FeedbackProvider>);
    await act(async () => { if (outcome === "success") held.complete(); else held.fail(new Error("Obsolete clipboard refusal")); });
    expect(document.body.textContent).toBe("New screen");
  });
});

it("T0191 standalone shared markdown reports clipboard refusal visibly", async () => {
  const rejected = Promise.reject(new Error("Owned standalone clipboard refusal"));
  void rejected.catch(() => undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: jest.fn(() => rejected) } });
  render(<SimpleMarkdown content={"```text\nstandalone payload\n```"} />);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: /^Copy$/i })); });
  expect(screen.queryByText(/^copied!?$/i)).not.toBeInTheDocument();
  expect(document.body.textContent).toMatch(/clipboard|could not copy|couldn't copy|copy failed/i);
});
