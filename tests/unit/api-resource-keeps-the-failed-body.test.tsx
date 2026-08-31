/** @jest-environment jsdom */

// T-0071 · F8, the middle of the seam.
//
// `useApiResource` folds the read-only fetch shape every domain hook shares. It
// threw on `!res.ok` and dropped `res.body` — so a 4xx that carried a payload
// arrived, was parsed, and was discarded one line before anything could look at
// it. /logs is the case that made it matter: a missing log file is answered with
// the list of files that DO exist, and that list is the only thing that lets the
// page pick a different one.
//
// FOUND BY MUTATION. Setting `errorBody: null` here left every other T-0071
// assertion green, because the route test proves the server SENDS it and the
// page test (added at the same time) proves the page READS it — with nothing in
// between checking that it survives the hook. Both ends covered, the strip
// between them not, for the third time in this programme (T-0068, T-0070).

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockSafeApiCall = jest.fn();
jest.mock("@/lib/api-fetch", () => ({
  safeApiCall: (...a: unknown[]) => mockSafeApiCall(...a),
}));

import { useApiResource } from "@/hooks/useApiResource";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const run = () =>
  renderHook(
    () =>
      useApiResource<{ availableLogs: { name: string }[] }>(["k"], "/api/logs", {
        select: (p) => p as { availableLogs: { name: string }[] } | undefined,
      }),
    { wrapper },
  );

beforeEach(() => jest.clearAllMocks());

describe("a failed read still hands over what the server sent with it", () => {
  it("exposes the failure's data payload", async () => {
    mockSafeApiCall.mockResolvedValue({
      ok: false,
      error: "Log file 'agent.log' not found",
      status: 404,
      body: { error: "Log file 'agent.log' not found", data: { availableLogs: [{ name: "hermes" }] } },
    });

    const { result } = run();

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.errorBody).toEqual({ availableLogs: [{ name: "hermes" }] });
  });

  it("still reports the failure as a failure", async () => {
    // Recovery DATA, not a success. `data` stays null and `error` stays set, so
    // a caller cannot mistake a 404 for a 200 with fewer fields.
    mockSafeApiCall.mockResolvedValue({
      ok: false,
      error: "not found",
      status: 404,
      body: { data: { availableLogs: [] } },
    });

    const { result } = run();

    await waitFor(() => expect(result.current.error).toBe("not found"));
    expect(result.current.data).toBeNull();
  });

  it("is null when the failure carried no body at all", async () => {
    // A network error has no response. `null`, not `{}` — an empty object would
    // read as "the server answered with nothing", which is a different fact.
    mockSafeApiCall.mockResolvedValue({ ok: false, error: "Network error" });

    const { result } = run();

    await waitFor(() => expect(result.current.error).toBe("Network error"));
    expect(result.current.errorBody).toBeNull();
  });

  it("is null when the body has no data field", async () => {
    mockSafeApiCall.mockResolvedValue({
      ok: false,
      error: "bad request",
      status: 400,
      body: { error: "bad request" },
    });

    const { result } = run();

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.errorBody).toBeNull();
  });

  it("GREEN CONTROL: a successful read is untouched", async () => {
    mockSafeApiCall.mockResolvedValue({
      ok: true,
      data: { data: { availableLogs: [{ name: "agent" }] } },
    });

    const { result } = run();

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.data).toEqual({ availableLogs: [{ name: "agent" }] });
    expect(result.current.error).toBeNull();
    expect(result.current.errorBody).toBeNull();
  });
});
