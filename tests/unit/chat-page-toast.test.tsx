/** @jest-environment jsdom */

/**
 * Regression tests for the chat page's toast rendering.
 *
 * History: the chat page previously called `useToast()` to get
 * `showToast` but never rendered the returned `toastElement`. The result
 * was that *every* toast (delete success, gateway offline, chat error,
 * download success) was silent — no UI feedback. This test asserts the
 * bug stays fixed: triggering any toast-bearing code path must produce
 * a Toast element in the rendered output.
 *
 * The page imports a lot of heavy dependencies (useGatewayHealth with
 * fetch timers, chat-utils with localStorage, sub-components), so we
 * mock aggressively to isolate the toast-rendering contract.
 */
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

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
jest.mock("@/components/layout/AppPageShell", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

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

jest.mock("@/components/chat/TypingIndicator", () => ({
  __esModule: true,
  default: () => <div data-testid="typing-indicator" />,
}));

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
    agentDefaultModelSet: false,
    registryModelIds: [],
    modelLabels: {},
    gatewayModelIds: [],
    modelsError: null,
    modelsLoading: false,
  }),
}));

// ── chat-utils mock: the server-API surface the hook imports ──
jest.mock("@/lib/chat-utils", () => ({
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

// jsdom does not implement Element.scrollIntoView — the chat page's
// auto-scroll effect calls it. Polyfill to a no-op so the effect does
// not throw on mount.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {
    /* no-op for jsdom */
  };
}

import ChatPage from "@/app/work/chat/page";

describe("ChatPage — toast rendering regression", () => {
  it("renders the toast portal node in the DOM (toastElement is in the tree)", async () => {
    render(<ChatPage />);
    // The chat page used to call useToast() and destructure only
    // `showToast`, silently dropping the `toastElement` portal. We
    // type a message, hit send — and because the mocked gateway is
    // offline, the send path emits the "Gateway is offline" toast.
    // If `toastElement` is missing from the page tree, the toast text
    // never reaches the DOM and this test fails.
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(textarea, { target: { value: "hello" } });
    });

    // Send button is the small action button next to the textarea.
    // The send-icon mock output is `[Send]`, so the button text contains it.
    const sendButton = screen.getByText("[Send]").closest("button") as HTMLButtonElement;
    expect(sendButton).toBeTruthy();
    await act(async () => {
      fireEvent.click(sendButton);
    });

    // The toast should appear with the offline message.
    await waitFor(() => {
      expect(
        screen.getByText(/Gateway is offline/i),
      ).toBeInTheDocument();
    });
  });
});
