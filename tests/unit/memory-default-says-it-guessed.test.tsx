/** @jest-environment jsdom */

// T-0077 · the label the operator ruled for, asserted by rendering it.
//
// FOUND BY MUTATION. The first version of this check grepped the component's
// source for "built-in default". Replacing the JSX condition with `{false && (`
// left that string sitting in the file — in the very comment explaining why the
// banner exists — so the assertion passed while the banner was unreachable.
// Grepping a file for a phrase proves the phrase is in the file, and nothing
// else.
//
// WHY THE BANNER EXISTS. The shipped default is hindsight@127.0.0.1:9177, and
// 9177 is exactly where a real Hindsight listens. A second install on one
// machine therefore connects to the first operator's memory and renders their
// facts as its own — which is not hypothetical, it is what a throwaway QA
// instance did. The operator ruled the zero-config connect stays, so the
// product says out loud that it GUESSED until somebody presses Save.

import { render, screen, waitFor } from "@testing-library/react";

const mockSafeApiCall = jest.fn();
jest.mock("@/lib/api-fetch", () => ({
  safeApiCall: (...a: unknown[]) => mockSafeApiCall(...a),
}));

import MemoryProviderSettings from "@/components/memory/MemoryProviderSettings";

/** What GET /api/memory/config answers, with the active row's confirmed flag. */
function configPayload(confirmed: boolean, host = "127.0.0.1", port = 9177) {
  return {
    ok: true,
    data: {
      data: {
        active: { type: "hindsight", config: { host, port, bank: "hermes" } },
        providers: [{ type: "hindsight", isActive: true, confirmed }],
      },
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSafeApiCall.mockResolvedValue({ ok: true, data: {} });
});

describe("an unconfirmed default admits it is a guess", () => {
  it("names the host and port it guessed", async () => {
    mockSafeApiCall.mockResolvedValueOnce(configPayload(false));

    render(<MemoryProviderSettings />);

    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    const banner = screen.getByRole("status").textContent ?? "";
    expect(banner).toMatch(/built-in default/i);
    expect(banner).toMatch(/not yet confirmed/i);
    // The specific endpoint, because "we guessed something" is not actionable
    // and "we guessed 127.0.0.1:9177" is.
    expect(banner).toContain("127.0.0.1:9177");
  });

  it("says what goes wrong if the guess is someone else's service", async () => {
    // The whole point. Without this sentence the banner reads as pedantry
    // rather than as the warning it is.
    mockSafeApiCall.mockResolvedValueOnce(configPayload(false));

    render(<MemoryProviderSettings />);

    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    expect(screen.getByRole("status").textContent).toMatch(/memories rather than yours/i);
  });

  it("reflects a guessed endpoint that is not the shipped one", async () => {
    mockSafeApiCall.mockResolvedValueOnce(configPayload(false, "10.0.0.9", 9500));

    render(<MemoryProviderSettings />);

    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    expect(screen.getByRole("status").textContent).toContain("10.0.0.9:9500");
  });
});

describe("a confirmed endpoint is left alone", () => {
  it("shows no banner once the operator has saved it", async () => {
    // GREEN CONTROL, and load-bearing: a warning on every load is a warning
    // nobody reads, which would put the real case back out of sight.
    mockSafeApiCall.mockResolvedValueOnce(configPayload(true));

    render(<MemoryProviderSettings />);

    await waitFor(() => expect(screen.getByText(/Memory provider/i)).toBeTruthy());
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows no banner when the config read fails outright", async () => {
    // Nothing is known about the row, so claiming it is unconfirmed would be
    // inventing a fact. Silence is the honest state here.
    mockSafeApiCall.mockResolvedValueOnce({ ok: false, error: "Network error" });

    render(<MemoryProviderSettings />);

    await waitFor(() => expect(screen.getByText(/Memory provider/i)).toBeTruthy());
    expect(screen.queryByRole("status")).toBeNull();
  });
});
