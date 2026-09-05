/** @jest-environment jsdom */

// ═══════════════════════════════════════════════════════════════
// B13 oracle, group chat (T-0107; D43 blocker, D49 the load half, D52).
//
// Written before the product code moved. Contract sections 7.1-7.3.
//
//   D43  handleDownloadConversation closes over `messages` — the transcript of
//        whatever conversation is CURRENTLY OPEN — and serialises it under the
//        CLICKED row's title and id. The download buttons sit on every sidebar
//        row and need no selection first, so "export this conversation" hands
//        the operator a different conversation's words in a file named after
//        this one. A silent, plausible, wrong export.
//   D49  the LIST half was fixed in T-0096 (listError + LoadErrorBanner). The
//        LOAD half was not: useChatSend's effect returns early when the read
//        fails, so a 500 on GET /api/chat/[id] leaves the previous
//        conversation's turns on screen under the new title, with nothing said.
//   D52  the "as CSV" button lives in a div gated on group-hover/download only.
//        A keyboard user can Tab to the JSON button; the CSV option never
//        becomes reachable, and a touch user cannot reach it at all.
//
// The doubles: fetchConversation and downloadFile are jest.fn; everything else
// in chat-utils is the real module, so conversationToJson really serialises and
// the assertion reads the bytes the operator would have got.
// ═══════════════════════════════════════════════════════════════

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import type { ChatConversation, ChatMessage } from "@/types/chat";

jest.mock("lucide-react", () => {
  // Icons leave the accessibility tree, so an icon-only button named by its
  // `title` still resolves by its accessible name.
  const icon = (name: string) =>
    function Icon(props: Record<string, unknown>) {
      return <svg data-icon={name} aria-hidden="true" {...props} />;
    };
  return new Proxy({}, { get: (_t, prop: string) => icon(prop) });
});

jest.mock("@/hooks/useGatewayHealth", () => ({
  useGatewayHealth: () => ({
    online: true,
    authConfigured: true,
    baseUrl: "http://127.0.0.1:8642",
    agentDefaultModelSet: true,
    registryModelIds: [],
    modelLabels: {},
    modelsError: null,
    modelsLoading: false,
  }),
}));

const safeApiCall = jest.fn();
jest.mock("@/lib/api-fetch", () => ({
  ...(jest.requireActual("@/lib/api-fetch") as Record<string, unknown>),
  safeApiCall: (...a: unknown[]) => safeApiCall(...a),
}));

const fetchConversation = jest.fn();
const downloadFile = jest.fn();
jest.mock("@/lib/chat-utils", () => ({
  ...(jest.requireActual("@/lib/chat-utils") as Record<string, unknown>),
  fetchConversation: (...a: unknown[]) => fetchConversation(...a),
  downloadFile: (...a: unknown[]) => downloadFile(...a),
  openRunEventStream: jest.fn(() => ({ close: jest.fn() })),
}));

import ChatPage from "@/app/work/chat/page";

// jsdom has no scrollIntoView; the transcript's auto-scroll effect calls it.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {
    /* no-op for jsdom */
  };
}

// ── fixtures ───────────────────────────────────────────────────

function conversation(id: string, title: string): ChatConversation {
  return {
    id,
    title,
    model: "openai/gpt-4",
    profileName: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  } as ChatConversation;
}

function message(id: string, content: string): ChatMessage {
  return {
    id,
    role: "user",
    content,
    status: "complete",
    createdAt: "2026-09-01T00:00:00.000Z",
  } as ChatMessage;
}

const ALPHA = conversation("c-a", "Alpha");
const BETA = conversation("c-b", "Beta");

const ALPHA_TEXT = "ALPHA-ONLY-TURN";
const BETA_TEXT = "BETA-ONLY-TURN";

const TRANSCRIPTS: Record<string, ChatMessage[]> = {
  "c-a": [message("m-a", ALPHA_TEXT)],
  "c-b": [message("m-b", BETA_TEXT)],
};

/**
 * The read helper, answering in a shape BOTH the current code and the contract
 * can read: `ok`/`error` for the contract, `conversation`/`messages` for the
 * code as it stands. Deliberate — a mock that only fits the new shape would
 * red these tests with a TypeError from the old one, and a crash is not an
 * oracle.
 */
function loadOk(id: string) {
  return {
    ok: true,
    conversation: id === "c-a" ? ALPHA : BETA,
    messages: TRANSCRIPTS[id] ?? [],
  };
}

function loadFailed(id: string) {
  return {
    ok: false,
    error: "Conversation unavailable (500)",
    conversation: id === "c-a" ? ALPHA : BETA,
    messages: [],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  fetchConversation.mockImplementation(async (id: string) => loadOk(id));
  safeApiCall.mockImplementation(async (path: string) => {
    if (path === "/api/chat") {
      return { ok: true, data: { data: { conversations: [ALPHA, BETA] } } };
    }
    return { ok: true, data: { data: {} } };
  });
});

async function renderChat() {
  render(<ChatPage />);
  // The list read settles and the first conversation becomes active.
  await screen.findByText("Beta");
  await screen.findByText(ALPHA_TEXT);
}

// ── FUSE ────────────────────────────────────────────────────────

describe("FUSE: the transcript reads go through the double", () => {
  it("never reaches a real endpoint, and the two rows differ", async () => {
    await renderChat();
    expect(fetchConversation).toHaveBeenCalledWith("c-a");
    expect(TRANSCRIPTS["c-a"][0].content).not.toBe(TRANSCRIPTS["c-b"][0].content);
  });
});

// ═══════════════════════════════════════════════════════════════
// D43 (blocker): the download exports the row that was clicked
// ═══════════════════════════════════════════════════════════════

function downloadButtons(format: "json" | "csv"): HTMLElement[] {
  return format === "json"
    ? screen.getAllByRole("button", { name: "Download as JSON" })
    : screen.getAllByRole("button", { name: /as csv/i });
}

/** The content string handed to downloadFile, and the filename beside it. */
function downloaded(): { content: string; filename: string } {
  const call = downloadFile.mock.calls[0] as [string, string, string] | undefined;
  if (!call) throw new Error("downloadFile was never called");
  return { content: call[0], filename: call[1] };
}

describe("downloading a conversation exports THAT conversation", () => {
  it("GREEN CONTROL: the open conversation still exports its own turns", async () => {
    await renderChat();
    fireEvent.click(downloadButtons("json")[0]);
    await waitFor(() => expect(downloadFile).toHaveBeenCalled());
    expect(downloaded().content).toContain(ALPHA_TEXT);
    expect(downloaded().filename).toMatch(/^Alpha_\d+\.json$/);
  });

  it("reads the clicked row's own transcript before serialising (D43)", async () => {
    await renderChat();
    fetchConversation.mockClear();
    fireEvent.click(downloadButtons("json")[1]);
    await waitFor(() => expect(downloadFile).toHaveBeenCalled());
    expect(fetchConversation).toHaveBeenCalledWith("c-b");
  });

  it("exports Beta's turns under Beta's name, not Alpha's (D43)", async () => {
    await renderChat();
    fireEvent.click(downloadButtons("json")[1]);
    await waitFor(() => expect(downloadFile).toHaveBeenCalled());
    const { content, filename } = downloaded();
    expect(filename).toMatch(/^Beta_\d+\.json$/);
    expect(content).toContain(BETA_TEXT);
    expect(content).not.toContain(ALPHA_TEXT);
  });

  it("the CSV export takes the same route (D43)", async () => {
    await renderChat();
    fireEvent.click(downloadButtons("csv")[1]);
    await waitFor(() => expect(downloadFile).toHaveBeenCalled());
    const { content, filename } = downloaded();
    expect(filename).toMatch(/^Beta_\d+\.csv$/);
    expect(content).toContain(BETA_TEXT);
    expect(content).not.toContain(ALPHA_TEXT);
  });

  it("says so, and writes nothing, when the row's transcript cannot be read", async () => {
    await renderChat();
    fetchConversation.mockImplementation(async (id: string) => loadFailed(id));
    fireEvent.click(downloadButtons("json")[1]);
    expect(await screen.findByText("Failed to export conversation")).toBeInTheDocument();
    expect(downloadFile).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// D52: the CSV export is reachable by keyboard
// ═══════════════════════════════════════════════════════════════

describe("the second export format is not hover-only", () => {
  it("reveals itself when the download control takes focus (D52)", async () => {
    await renderChat();
    const wrapper = downloadButtons("csv")[0].parentElement;
    expect(wrapper).not.toBeNull();
    expect(wrapper!.className).toContain("group-focus-within/download:block");
  });

  it("GREEN CONTROL: the hover affordance is kept, not swapped", async () => {
    await renderChat();
    const wrapper = downloadButtons("csv")[0].parentElement;
    expect(wrapper!.className).toContain("group-hover/download:block");
  });
});

// ═══════════════════════════════════════════════════════════════
// D49: a failed conversation LOAD is surfaced
// ═══════════════════════════════════════════════════════════════

describe("a conversation whose transcript will not load", () => {
  async function selectBetaAndFail() {
    await renderChat();
    fetchConversation.mockImplementation(async (id: string) => loadFailed(id));
    fireEvent.click(screen.getByRole("button", { name: /^Beta/ }));
  }

  it("shows the failure, with a Retry, in place of the transcript (D49)", async () => {
    await selectBetaAndFail();
    expect(await screen.findByText("Conversation unavailable (500)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("never shows the empty state under the failure (the read contract)", async () => {
    await selectBetaAndFail();
    await screen.findByText("Conversation unavailable (500)");
    expect(screen.queryByText(/Fast mode: a quick raw-model reply/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Agent mode: the assistant can use tools/),
    ).not.toBeInTheDocument();
  });

  it("GREEN CONTROL: the previous conversation's turns are cleared either way", async () => {
    await selectBetaAndFail();
    await waitFor(() => expect(screen.queryByText(ALPHA_TEXT)).not.toBeInTheDocument());
  });

  it("Retry re-reads the same conversation", async () => {
    await selectBetaAndFail();
    await screen.findByText("Conversation unavailable (500)");
    fetchConversation.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(fetchConversation).toHaveBeenCalledWith("c-b"));
  });

  it("GREEN CONTROL: a conversation that loads shows no banner", async () => {
    await renderChat();
    const sidebar = screen.getByText("Beta").closest("div");
    expect(sidebar).not.toBeNull();
    expect(screen.queryByText("Conversation unavailable (500)")).not.toBeInTheDocument();
    expect(within(document.body).queryByRole("button", { name: /retry/i })).toBeNull();
  });
});
