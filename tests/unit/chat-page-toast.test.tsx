/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * The chat page with the gateway offline.
 *
 * History: this began as a regression test for the chat page's toast
 * rendering. The page once called `useToast()` for `showToast` and never
 * rendered the returned `toastElement`, so every toast was silent, and the
 * test pressed Send with the gateway offline to see the "Gateway is offline"
 * toast appear. FeedbackProvider owns the stack now (T-0096), and since U18
 * (T-0132) an offline gateway disables the composer with the reason rather
 * than accepting a message and toasting. What this suite holds is that
 * contract, and that the toast stack is lifted above the composer while the
 * screen is mounted.
 *
 * The page imports a lot of heavy dependencies (useGatewayHealth with
 * fetch timers, chat-utils with localStorage, sub-components), so we
 * mock aggressively.
 */
import { screen, waitFor } from "@testing-library/react";
import { renderWithQuery } from "../helpers/render-with-query";

// ── Icon mocks (lucide-react is a peer dep of every component) ──
jest.mock("lucide-react", () => {
  const passthrough = (name: string) => () => `[${name}]`;
  return new Proxy(
    {},
    {
      get: (_target, prop: string) => passthrough(prop),
    },
  );
});

// ── Sub-component mocks ────────────────────────────────────────
jest.mock("@/components/layout/AppPageShell", () => require("../helpers/mocks").appPageShellMock());

jest.mock("@/components/layout/PageHeader", () => ({
  __esModule: true,
  default: ({ actions }: { actions?: React.ReactNode }) => (
    <div data-testid="page-header">{actions}</div>
  ),
}));

jest.mock("@/components/ui/Button", () => ({
  __esModule: true,
  default: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/Select", () => ({
  __esModule: true,
  InlineSelect: ({ options }: { options: { value: string; label: string }[] }) => (
    <select data-testid="model-select">
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));

// The typing indicator is the page's own since C6 (T-0143); it renders only
// while a turn streams, which this suite never starts.

jest.mock("@/components/chat/GatewayBanner", () => ({
  __esModule: true,
  default: () => <div data-testid="gateway-banner" />,
}));

// ── Hook mocks (avoid timers, fetch, localStorage) ─────────────
jest.mock("@/hooks/useGatewayHealth", () => ({
  useGatewayHealth: () => ({
    // offline → the send path emits the "Gateway is offline" toast before any
    // network call. That's the easiest toast path to trigger in a unit test.
    online: false,
    authConfigured: true,
    modelReadiness: null,
    registryModelIds: [],
    modelLabels: {},
    gatewayModelIds: [],
    modelsError: null,
    modelsLoading: false,
  }),
}));

// ── chat-utils mock: the server-API surface the hook imports ──
jest.mock("@/lib/chat/chat-utils", () => ({
  fetchConversations: jest.fn().mockResolvedValue([]),
  // fetchConversation answers `{ ok, error?, conversation?, messages? }` since
  // B13 (D43/D49) — it used to answer `… | null`, which could not tell an empty
  // transcript from a failed read. No conversation is ever selected in this
  // suite, so the value is never read; it is corrected here so the mock keeps
  // describing the real module rather than becoming a trap for the next test
  // that does select one.
  fetchConversation: jest.fn().mockResolvedValue({ ok: false, error: "not used by this suite" }),
  createConversationApi: jest.fn().mockResolvedValue(null),
  deleteConversationApi: jest.fn().mockResolvedValue({ ok: true }),
  sendMessageApi: jest.fn().mockResolvedValue({ ok: true, result: { userMessageId: "u", assistantMessageId: "a" } }),
  finalizeMessageApi: jest.fn().mockResolvedValue(undefined),
  stopRunApi: jest.fn().mockResolvedValue({ ok: true }),
  resolveApprovalApi: jest.fn().mockResolvedValue({ ok: true }),
  openRunEventStream: jest.fn(() => ({ close: jest.fn() })),
  classifyRunEvent: () => "ignore",
  extractDelta: () => "",
  extractReasoning: () => "",
  extractCompletedOutput: () => "",
  extractRunError: () => "run failed",
  parseToolEvent: () => ({ name: "tool", status: "invoked" }),
  mergeToolCall: (l: unknown[]) => l,
  toApiMessages: (messages: { role: string; content: string }[], newText: string) => [
    ...messages.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: newText },
  ],
  streamChatResponse: jest.fn().mockResolvedValue(true),
  conversationToJson: () => "{}",
  conversationToCsv: () => "",
  sanitiseFilename: (title: string) => title.replace(/[^a-zA-Z0-9_-]/g, "_"),
  downloadFile: jest.fn(),
  renderMarkdown: (s: string) => s,
  formatModelName: (id: string) => id,
  COPY_BTN_CLASS: "copy-btn",
  COPY_BTN_DATA_ATTR: "data-code",
}));

// ── Toast mock: capture the rendered toast element by id ────────
// We want the *real* useToast hook so we can prove the chat page
// actually destructures `toastElement` and renders it. But the real
// Toast component uses `setTimeout` for auto-dismiss which would leak
// across tests. Use the real hook with a stub component that mounts
// immediately.
jest.mock("@/components/ui/Toast", () => {
  const actual = jest.requireActual("@/components/ui/Toast");
  return actual;
});

// Stub next/router just in case.
jest.mock("next/router", () => ({ useRouter: () => ({ push: jest.fn() }) }), { virtual: true });

// ── Setup ──────────────────────────────────────────────────────
beforeEach(() => {
  // localStorage is empty on each test (we mock loadSessions anyway).
  localStorage.clear();
  jest.clearAllMocks();
});

import ChatPage from "@/app/work/chat/page";

describe("ChatPage — an offline gateway, said where the operator is looking", () => {
  // This test used to type a message and press Send with the gateway offline,
  // and expect the "Gateway is offline" toast, which proved the page rendered
  // `toastElement`. Two things moved under it. FeedbackProvider owns the toast
  // stack now (T-0096), so `toastElement` is always null and the regression it
  // guarded cannot recur in that form. And since U18 (T-0132) an offline
  // gateway disables the composer with the reason as its placeholder rather
  // than accepting a message and toasting; the Send button is disabled with
  // it, so the old path cannot be walked. What the page owes now is the
  // disabled composer, its reason, and the toast stack lifted above it.
  it("disables the composer, says why, and lifts the toast stack above it", async () => {
    const { unmount } = renderWithQuery(<ChatPage />);
    const textarea = screen.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement;
    await waitFor(() => expect(textarea).toBeDisabled());
    expect(textarea.placeholder).toMatch(/hermes gateway start/);
    // The send-icon mock output is `[Send]`, so the button text contains it.
    const sendButton = screen.getByText("[Send]").closest("button") as HTMLButtonElement;
    expect(sendButton).toBeDisabled();
    // The stack rests above the composer on this screen, and only while the
    // screen is mounted.
    expect(document.documentElement.style.getPropertyValue("--ps-toast-lift")).not.toBe("");
    unmount();
    expect(document.documentElement.style.getPropertyValue("--ps-toast-lift")).toBe("");
  });
});
