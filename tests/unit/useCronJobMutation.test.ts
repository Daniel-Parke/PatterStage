/** @jest-environment jsdom */

// Tests for the shared useCronJobMutation hook
// (src/hooks/useCronJobMutation.ts)
//
// Covers all three handlers (toggle / delete / pauseAll) and the showToast
// contract that both call sites rely on for byte-equivalent behaviour.

import { act, renderHook } from "@testing-library/react";

import { useCronJobMutation, type CronJobLike } from "@/hooks/useCronJobMutation";

const showToast = jest.fn();
jest.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ showToast, toastElement: null }),
}));

const fetchMock = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock as typeof fetch;
});

interface TestJob extends CronJobLike {
  name: string;
}

const jobs: TestJob[] = [
  { id: "j1", name: "Job 1", enabled: true },
  { id: "j2", name: "Job 2", enabled: false },
];

function renderMutation(
  overrides: Partial<Parameters<typeof useCronJobMutation<TestJob>>[0]> = {},
) {
  const refetch = jest.fn();
  const config: Parameters<typeof useCronJobMutation<TestJob>>[0] = {
    endpoint: "/api/cron",
    findJob: (id: string) => jobs.find((j) => j.id === id),
    buildToggleBody: (_job: TestJob, nextEnabled: boolean) => ({
      action: nextEnabled ? "resume" : "pause",
    }),
    toggleSuccess: (nextEnabled: boolean) =>
      `Job ${nextEnabled ? "Resumed" : "Paused"}`,
    toggleErrorFallback: (nextEnabled: boolean) =>
      `Failed to ${nextEnabled ? "resume" : "pause"} job`,
    deleteSuccess: "Job deleted",
    deleteErrorFallback: "Failed to delete job",
    pauseAll: {
      success: "All jobs paused",
      errorFallback: "Failed to pause jobs",
    },
    refetch,
    ...overrides,
  };
  const utils = renderHook(() => useCronJobMutation<TestJob>(config));
  return { ...utils, refetch, config };
}

function okResponse(data: unknown = {}) {
  return Promise.resolve({
    ok: true,
    json: async () => ({ data }),
  });
}
function errResponse(error: string) {
  return Promise.resolve({
    ok: false,
    status: 500,
    json: async () => ({ error }),
  });
}

describe("useCronJobMutation — handleToggle", () => {
  it("sends a PUT with the toggle body and a resume action when job is disabled", async () => {
    fetchMock.mockReturnValueOnce(okResponse());
    const { result } = renderMutation();

    await act(async () => {
      await result.current.handleToggle("j2");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/cron",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ id: "j2", action: "resume" }),
      }),
    );
  });

  it("sends a PUT with a pause action when job is enabled", async () => {
    fetchMock.mockReturnValueOnce(okResponse());
    const { result } = renderMutation();

    await act(async () => {
      await result.current.handleToggle("j1");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/cron",
      expect.objectContaining({
        body: JSON.stringify({ id: "j1", action: "pause" }),
      }),
    );
  });

  it("shows the appropriate success toast for pause vs resume", async () => {
    fetchMock.mockReturnValueOnce(okResponse());
    const { result, rerender } = renderMutation();
    await act(async () => {
      await result.current.handleToggle("j1"); // pause
    });
    expect(showToast).toHaveBeenLastCalledWith("Job Paused");

    fetchMock.mockReturnValueOnce(okResponse());
    rerender();
    await act(async () => {
      await result.current.handleToggle("j2"); // resume
    });
    expect(showToast).toHaveBeenLastCalledWith("Job Resumed");
  });

  it("shows the server error and falls back when no error string is returned", async () => {
    fetchMock.mockReturnValueOnce(errResponse("server boom"));
    const { result } = renderMutation();
    await act(async () => {
      await result.current.handleToggle("j1");
    });
    expect(showToast).toHaveBeenLastCalledWith("server boom", "error");

    // When the error body has no `error` field, apiFetch synthesises
    // "HTTP <status>" — which becomes the toast text. Documenting this
    // pre-existing behaviour.
    fetchMock.mockReturnValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    await act(async () => {
      await result.current.handleToggle("j1");
    });
    expect(showToast).toHaveBeenLastCalledWith("HTTP 500", "error");
  });

  it("refetches after every toggle call (success OR failure — byte-equivalence fix)", async () => {
    // Regression: pre-refactor useSystemCronJobs.handleToggle only refetched on ok.
    fetchMock.mockReturnValueOnce(errResponse("nope"));
    const { result, refetch } = renderMutation();
    await act(async () => {
      await result.current.handleToggle("j1");
    });
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("returns early without calling fetch when the job is not found", async () => {
    const { result } = renderMutation();
    await act(async () => {
      await result.current.handleToggle("missing");
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("uses the custom buildToggleBody when provided (system cron enabled shape)", async () => {
    fetchMock.mockReturnValueOnce(okResponse());
    const { result } = renderMutation({
      buildToggleBody: (_job: TestJob, nextEnabled: boolean) => ({
        enabled: nextEnabled,
      }),
    });
    await act(async () => {
      await result.current.handleToggle("j1");
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/cron",
      expect.objectContaining({
        body: JSON.stringify({ id: "j1", enabled: false }),
      }),
    );
  });
});

describe("useCronJobMutation — handleDelete", () => {
  it("sends a DELETE with the id as a query string", async () => {
    fetchMock.mockReturnValueOnce(okResponse());
    const { result } = renderMutation();

    await act(async () => {
      await result.current.handleDelete("j1");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/cron?id=j1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("shows the success toast on 2xx and refetches", async () => {
    fetchMock.mockReturnValueOnce(okResponse());
    const { result, refetch } = renderMutation();
    await act(async () => {
      await result.current.handleDelete("j1");
    });
    expect(showToast).toHaveBeenLastCalledWith("Job deleted");
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows the error toast on failure and still refetches", async () => {
    fetchMock.mockReturnValueOnce(errResponse("forbidden"));
    const { result, refetch } = renderMutation();
    await act(async () => {
      await result.current.handleDelete("j1");
    });
    expect(showToast).toHaveBeenLastCalledWith("forbidden", "error");
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe("useCronJobMutation — handlePauseAll", () => {
  it("sends a POST with action=pauseAll and shows the success toast", async () => {
    fetchMock.mockReturnValueOnce(okResponse({ data: { pausedCount: 3 } }));
    const { result, refetch } = renderMutation();

    await act(async () => {
      await result.current.handlePauseAll();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/cron",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ action: "pauseAll" }),
      }),
    );
    expect(showToast).toHaveBeenLastCalledWith("All jobs paused");
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("rejects concurrent pauseAll calls (idempotency guard)", async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
    );
    const { result } = renderMutation();

    let first: Promise<void> | undefined;
    act(() => {
      first = result.current.handlePauseAll();
    });
    // Second call should short-circuit
    await act(async () => {
      await result.current.handlePauseAll();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFirst({
      ok: true,
      json: async () => ({ data: {} }),
    });
    await act(async () => {
      if (first) await first;
    });
  });

  it("toggles pauseAllBusy during the request and resets in finally", async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
    );
    const { result } = renderMutation();

    expect(result.current.pauseAllBusy).toBe(false);
    let first: Promise<void> | undefined;
    act(() => {
      first = result.current.handlePauseAll();
    });
    expect(result.current.pauseAllBusy).toBe(true);

    resolveFirst({ ok: true, json: async () => ({ data: {} }) });
    await act(async () => {
      if (first) await first;
    });
    expect(result.current.pauseAllBusy).toBe(false);
  });

  it("interpolates {count} from the API's pausedCount when showCount is true", async () => {
    // The on-the-wire envelope is `{ data: { pausedCount: 5 } }`. The
    // `safeApiCall<T>` helper does NOT unwrap (see api-fetch.ts:85-98) —
    // it returns `{ ok, data: <body> }` where `data` is the whole
    // envelope. The post-fix production code types the call as
    // `safeApiCall<{ data?: { pausedCount?: number } }>` and reads the
    // count via `result.data?.data?.pausedCount` (two indirections).
    //
    // The mock therefore returns the envelope (not the inner payload
    // directly): the on-the-wire JSON is `{ data: { pausedCount: 5 } }`.
    // This pins the production code path. The `okResponse` test helper
    // wraps the arg in `{ data: ... }`, so passing `{ pausedCount: 5 }`
    // yields the correct wire shape.
    //
    // Sister test: `safe-api-call-data-source-pattern-list2.test.ts`
    // pins the same envelope-typed shape across all 6 List 2 files.
    fetchMock.mockReturnValueOnce(okResponse({ pausedCount: 5 }));
    const { result } = renderMutation({
      pauseAll: {
        success: "Paused {count} system cron job(s)",
        errorFallback: "Failed to pause system cron jobs",
        showCount: true,
      },
    });
    await act(async () => {
      await result.current.handlePauseAll();
    });
    expect(showToast).toHaveBeenLastCalledWith("Paused 5 system cron job(s)");
  });

  it("falls back to 0 when pausedCount is missing and showCount is true", async () => {
    fetchMock.mockReturnValueOnce(okResponse());
    const { result } = renderMutation({
      pauseAll: {
        success: "Paused {count} system cron job(s)",
        errorFallback: "Failed to pause system cron jobs",
        showCount: true,
      },
    });
    await act(async () => {
      await result.current.handlePauseAll();
    });
    expect(showToast).toHaveBeenLastCalledWith("Paused 0 system cron job(s)");
  });

  it("shows the error toast on failure", async () => {
    fetchMock.mockReturnValueOnce(errResponse("server error"));
    const { result } = renderMutation();
    await act(async () => {
      await result.current.handlePauseAll();
    });
    expect(showToast).toHaveBeenLastCalledWith("server error", "error");
  });
});
