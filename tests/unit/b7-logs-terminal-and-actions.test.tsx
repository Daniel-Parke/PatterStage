/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-require-imports -- the source read is a structural assertion, loaded where it is used rather than at the top of a jsdom file */
// ═══════════════════════════════════════════════════════════════
// B7 oracle, group logs (T-0101, D59 and the three the plan names).
//
// Written before the product code moved. Contract section 5:
//
//   D59  LogTerminal hands its ref and its onScroll to Panel, whose outer div
//        carries overflow-hidden. The element that scrolls is the inner
//        overflow-auto div. So scrollTop is permanently 0: the auto-scroll
//        effect writes 0 to a div that was never going to move, handleScroll
//        never fires, autoScroll never turns off, and the "Latest lines" pill
//        that appears when it does can therefore never appear at all.
//   +    Delete All is drawn live on a page with no log file to clear.
//   +    The file on screen can be copied and downloaded.
//
// The scroll contract is asserted structurally, because "the ref points at the
// element that scrolls" is exactly the thing a class-name change breaks and a
// render assertion would not notice.
// ═══════════════════════════════════════════════════════════════

import { createRef } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("lucide-react", () => {
  const icon = (name: string) =>
    function Icon(props: Record<string, unknown>) {
      return <svg data-icon={name} aria-hidden="true" {...props} />;
    };
  return new Proxy({}, { get: (_t, prop: string) => icon(prop) });
});

const mockUseLogs = jest.fn();
jest.mock("@/hooks/useLogs", () => ({ useLogs: (...a: unknown[]) => mockUseLogs(...a) }));

const mockSafeApiCallData = jest.fn();
jest.mock("@/lib/api-fetch", () => ({
  safeApiCallData: (...a: unknown[]) => mockSafeApiCallData(...a),
  setErrorFromCaught: jest.fn(),
}));

const mockDownloadFile = jest.fn();
jest.mock("@/lib/chat-utils", () => ({
  ...(jest.requireActual("@/lib/chat-utils") as Record<string, unknown>),
  downloadFile: (...a: unknown[]) => mockDownloadFile(...a),
}));

import LogTerminal from "@/components/logs/LogTerminal";
import LogsPage from "@/app/results/logs/page";

// ── pre-B7 type shim: the ref moves to its own prop ─────────────

type TerminalProps = Omit<React.ComponentProps<typeof LogTerminal>, "containerRef"> & {
  scrollRef?: React.RefObject<HTMLDivElement | null>;
};
const Terminal = LogTerminal as unknown as React.ComponentType<TerminalProps>;

const LINES = ["2026-09-05 10:00:00 INFO first", "2026-09-05 10:00:01 WARN second"];
const AVAILABLE = [{ name: "agent", size: 120, modified: "2026-09-05T10:00:00Z" }];

function loaded(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      name: "agent",
      lines: LINES,
      showingLines: LINES.length,
      totalLines: LINES.length,
      size: 120,
      modified: "2026-09-05T10:00:00Z",
      availableLogs: AVAILABLE,
    },
    isLoading: false,
    isFetching: false,
    error: null,
    errorBody: null,
    refetch: jest.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLogs.mockReturnValue(loaded());
  Object.assign(navigator, { clipboard: { writeText: jest.fn(async () => {}) } });
});

// ═══════════════════════════════════════════════════════════════
// D59: the ref lands on the element that scrolls
// ═══════════════════════════════════════════════════════════════

describe("the log terminal's scroll container is the one that scrolls", () => {
  function renderTerminal(scrollRef: React.RefObject<HTMLDivElement | null>, onScroll = jest.fn()) {
    render(
      <Terminal
        scrollRef={scrollRef}
        onScroll={onScroll}
        logName="agent"
        activeLog="agent"
        showingLines={2}
        totalLines={2}
        lines={LINES}
        searchTerm=""
      />,
    );
  }

  it("the ref points at an element that can overflow, not at the panel that hides it", () => {
    const ref = createRef<HTMLDivElement>();
    renderTerminal(ref);

    expect(ref.current).not.toBeNull();
    const className = ref.current!.className;
    expect({ scrolls: /overflow-auto/.test(className), hides: /overflow-hidden/.test(className) }).toEqual({
      scrolls: true,
      hides: false,
    });
  });

  it("the log rows are inside it, so scrolling them is what moves it", () => {
    const ref = createRef<HTMLDivElement>();
    renderTerminal(ref);

    expect(ref.current!.textContent).toContain("first");
    expect(ref.current!.textContent).toContain("second");
  });

  it("scrolling that element calls onScroll", () => {
    const ref = createRef<HTMLDivElement>();
    const onScroll = jest.fn();
    renderTerminal(ref, onScroll);

    fireEvent.scroll(ref.current!);

    expect(onScroll).toHaveBeenCalled();
  });

  it("the Panel around it carries no scroll handler of its own", () => {
    const { readFileSync } = require("fs") as typeof import("fs");
    const { join } = require("path") as typeof import("path");
    const source = readFileSync(
      join(__dirname, "..", "..", "src", "components", "logs", "LogTerminal.tsx"),
      "utf-8",
    );
    const panelBlock = source.slice(source.indexOf("<Panel"), source.indexOf(">", source.indexOf("<Panel")));

    expect({ ref: /ref=/.test(panelBlock), onScroll: /onScroll/.test(panelBlock) }).toEqual({
      ref: false,
      onScroll: false,
    });
  });
});

describe("the page's Latest lines pill can be reached", () => {
  it("scrolling away from the top reveals it, and clicking it scrolls back", async () => {
    render(<LogsPage />);
    const scroller = await waitFor(() => {
      const el = document.querySelector("[class*='overflow-auto']") as HTMLDivElement | null;
      if (!el) throw new Error("no scroll container");
      return el;
    });

    Object.defineProperty(scroller, "scrollTop", { value: 400, writable: true, configurable: true });
    fireEvent.scroll(scroller);

    const pill = await screen.findByRole("button", { name: /Latest lines/i });
    fireEvent.click(pill);

    await waitFor(() => expect(scroller.scrollTop).toBe(0));
  });
});

// ═══════════════════════════════════════════════════════════════
// Delete All, Copy and Download
// ═══════════════════════════════════════════════════════════════

describe("Delete All is live only when there is something to clear", () => {
  it("is disabled with a reason when no log file exists", async () => {
    mockUseLogs.mockReturnValue({
      data: null,
      isLoading: false,
      isFetching: false,
      error: "No logs yet",
      errorBody: { noLogsYet: true },
      refetch: jest.fn(),
    });

    render(<LogsPage />);

    const button = await screen.findByRole("button", { name: /Delete All/i });
    expect(button).toBeDisabled();
    expect(button.getAttribute("title") ?? "").toMatch(/nothing to delete/i);
  });

  it("GREEN CONTROL: it is live when a log file is on screen", async () => {
    render(<LogsPage />);

    expect(await screen.findByRole("button", { name: /Delete All/i })).not.toBeDisabled();
  });
});

describe("the file on screen can be taken away", () => {
  it("Copy puts the visible lines on the clipboard", async () => {
    render(<LogsPage />);

    fireEvent.click(await screen.findByRole("button", { name: /^Copy/i }));

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    const copied = (navigator.clipboard.writeText as jest.Mock).mock.calls[0][0] as string;
    expect(copied).toContain("first");
    expect(copied).toContain("second");
  });

  it("Copy respects the line filter, so what is copied is what is shown", async () => {
    render(<LogsPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Filter lines/i }));
    fireEvent.change(screen.getByLabelText("Log line filter"), { target: { value: "WARN" } });

    fireEvent.click(screen.getByRole("button", { name: /^Copy/i }));

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    const copied = (navigator.clipboard.writeText as jest.Mock).mock.calls[0][0] as string;
    expect(copied).toContain("second");
    expect(copied).not.toContain("first");
  });

  it("Download saves the file under its own name", async () => {
    render(<LogsPage />);

    fireEvent.click(await screen.findByRole("button", { name: /^Download/i }));

    expect(mockDownloadFile).toHaveBeenCalledTimes(1);
    const [content, filename, mime] = mockDownloadFile.mock.calls[0] as [string, string, string];
    expect(filename).toBe("agent.log");
    expect(mime).toMatch(/text\/plain/);
    expect(content).toContain("first");
  });

  it("both are disabled when there is nothing on screen", async () => {
    mockUseLogs.mockReturnValue({
      data: null,
      isLoading: false,
      isFetching: false,
      error: "No logs yet",
      errorBody: { noLogsYet: true },
      refetch: jest.fn(),
    });

    render(<LogsPage />);

    expect(await screen.findByRole("button", { name: /^Copy/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Download/i })).toBeDisabled();
  });
});
