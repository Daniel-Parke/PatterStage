/** @jest-environment jsdom */
/**
 * B1 (T-0095), D53, D107, D108, D111: the sidebar deploy block.
 *
 * D53.  It learns on mount whether the deploy API is on, and says so before the
 *       click rather than 403-ing after it.
 * D107. A failed version check is a fourth state, never painted green.
 * D108. The 20-line failure tail GET /api/update?deploy=1 computes is shown,
 *       not thrown away by the hook.
 * D111. A deploy that never reaches a terminal state releases the buttons
 *       after the attempt cap, which used to count only thrown polls.
 */
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";

const mockSafeApiCallData = jest.fn();
jest.mock("@/lib/api-fetch", () => ({
  ...jest.requireActual("@/lib/api-fetch"),
  safeApiCallData: (...a: unknown[]) => mockSafeApiCallData(...a),
}));

import { useVersionFooter, type VersionFooterState } from "@/hooks/useVersionFooter";
// The block moved from the rail to Settings > System in T-0097; the state
// contract and every truth it tells are unchanged.
import { DeployControls } from "@/components/system/DeployControls";

const mockFetch = jest.fn();
const originalFetch = globalThis.fetch;

function jsonRes(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body } as unknown as Response;
}

beforeEach(() => {
  mockSafeApiCallData.mockReset();
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  // Default mount answer: an idle deploy on an install with the API on.
  mockSafeApiCallData.mockImplementation(async (path: string) =>
    path.startsWith("/api/update?deploy=1") ? { deploy: { state: "idle" }, deployEnabled: true } : null,
  );
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.useRealTimers();
});

describe("D53: the block knows before the click", () => {
  it("reads deployEnabled on mount and exposes it", async () => {
    mockSafeApiCallData.mockImplementation(async (path: string) =>
      path.startsWith("/api/update?deploy=1") ? { deploy: { state: "idle" }, deployEnabled: false } : null,
    );
    const { result } = renderHook(() => useVersionFooter());
    await waitFor(() => expect(result.current.deployEnabled).toBe(false));
  });

  it("the expanded view disables the three actions and says why", () => {
    render(<DeployControls state={stateWith({ deployEnabled: false })} />);
    expect(screen.getByRole("button", { name: /check for updates/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /rebuild/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /restart/i })).toBeDisabled();
    expect(screen.getByText(/deploy api is off/i)).toBeInTheDocument();
    expect(screen.getByText(/PS_ENABLE_DEPLOY_API/)).toBeInTheDocument();
  });
});

describe("D107: a failed check is a fourth state", () => {
  it("is check-failed, with a message, and never up-to-date", async () => {
    mockSafeApiCallData.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/update?deploy=1")) return { deploy: { state: "idle" }, deployEnabled: true };
      if (path.startsWith("/api/update?branch=")) {
        return { localHash: "unknown", remoteHash: "unknown", updateAvailable: false, behind: 0, checkFailed: true };
      }
      return null;
    });
    const { result } = renderHook(() => useVersionFooter());
    await act(async () => {
      await result.current.handleDropdownConfirm("main");
    });
    expect(result.current.checkState).toBe("check-failed");
    expect(result.current.message).toMatch(/could not check|check failed/i);
  });

  it("the view paints it as a warning, not green", () => {
    render(<DeployControls state={stateWith({ checkState: "check-failed" as VersionFooterState["checkState"] })} />);
    expect(screen.queryByText(/up to date/i)).toBeNull();
    expect(screen.getByRole("button", { name: /could not check|check failed|try again/i })).toBeInTheDocument();
  });
});

describe("D108: the failure tail reaches the footer", () => {
  it("keeps the log tail from a failed poll", async () => {
    jest.useFakeTimers();
    mockFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (init?.method === "POST") return jsonRes({ data: { started: true } });
      return jsonRes({
        data: {
          deploy: {
            state: "failed",
            action: "restart",
            message: "Restart failed",
            logHint: "ps-restart.log",
            logTail: ["npm ERR! code ELIFECYCLE", "npm ERR! restart script failed"],
          },
        },
      });
    });
    const { result } = renderHook(() => useVersionFooter());
    await act(async () => {
      result.current.onRestartClick();
    });
    await act(async () => {
      result.current.onRestartClick();
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2_100);
    });
    expect(result.current.deployLogTail).toEqual(["npm ERR! code ELIFECYCLE", "npm ERR! restart script failed"]);
    expect(result.current.isBusy).toBe(false);
  });

  it("the view renders the tail lines", () => {
    render(<DeployControls state={stateWith({ message: "Restart failed", deployLogTail: ["npm ERR! code ELIFECYCLE"] })} />);
    expect(screen.getByText(/npm ERR! code ELIFECYCLE/)).toBeInTheDocument();
  });
});

describe("D111: a deploy that never ends still lets go", () => {
  it("releases the buttons after the attempt cap even when every poll answers 'running'", async () => {
    jest.useFakeTimers();
    mockFetch.mockImplementation(async (_path: string, init?: RequestInit) => {
      if (init?.method === "POST") return jsonRes({ data: { started: true } });
      return jsonRes({ data: { deploy: { state: "running", action: "restart", phase: "build", message: "building" } } });
    });
    const { result } = renderHook(() => useVersionFooter());
    await act(async () => {
      result.current.onRestartClick();
    });
    await act(async () => {
      result.current.onRestartClick();
    });
    expect(result.current.isBusy).toBe(true);
    await act(async () => {
      // 450 polls at 2s: the cap the hook already names, now applied to every tick.
      await jest.advanceTimersByTimeAsync(451 * 2_000);
    });
    expect(result.current.isBusy).toBe(false);
    expect(result.current.message).toMatch(/timed out/i);
    // 451 polls, each a resolved fetch and a state update under fake timers:
    // real work, not a hang, so the budget is the cap's, not jest's default.
  }, 60_000);
});

function stateWith(over: Partial<VersionFooterState>): VersionFooterState {
  return {
    version: null,
    checkState: "idle",
    restarting: false,
    rebuilding: false,
    isBusy: false,
    message: null,
    dropdownOpen: false,
    branches: ["main", "dev"],
    selectedBranch: "main",
    deployEnabled: true,
    deployLogTail: [],
    openCheckDropdown: async () => undefined,
    closeDropdown: () => undefined,
    handleDropdownConfirm: async () => undefined,
    handleUpdate: () => undefined,
    onRebuildClick: () => undefined,
    onRestartClick: () => undefined,
    isArmedFor: () => false,
    ...over,
  };
}
