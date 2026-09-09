/**
 * @jest-environment node
 *
 * The server explains itself, and the client must not throw the explanation
 * away.
 *
 * THE REPORTED SYMPTOM. Storing a memory with no provider configured showed a
 * toast reading "HTTP 500", and nothing else. The route did say why: the catch
 * branch of /api/memory/hindsight answers with
 * `{ data: { available: false, error: "<why>" } }`, which is the envelope every
 * Hindsight reader expects. `apiFetch` read only the TOP-LEVEL `error` field,
 * found none, and synthesised "HTTP <status>".
 *
 * That is a CLASS, not one bad toast. `apiFetch` is the single fetch helper
 * behind `safeApiCall`, `safeApiCallData` and `runWrite`,
 * so every caller of every route that nests its message lost it the same way.
 * The fix belongs in the helper, and these are its oracles.
 *
 * The other half of the fix is the wire shape itself (the route now sets the
 * top-level `error` too): see memory-without-a-provider-says-what-to-do.test.ts.
 */

import { apiFetch, safeApiCall } from "@/lib/api-fetch";
import { runWrite } from "@/lib/api-write";

const originalFetch = globalThis.fetch;

/** A non-2xx JSON response with the given body. */
function failWith(body: unknown, status = 500): void {
  globalThis.fetch = jest.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  ) as unknown as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("apiFetch keeps the message a failing route deliberately sent", () => {
  it("reads the error the envelope nests under `data` when there is no top-level one", async () => {
    failWith({
      data: {
        available: false,
        error: "No memory provider is configured. Choose one on the Memory page.",
      },
    });

    await expect(apiFetch("/api/memory/hindsight", { method: "POST" })).rejects.toThrow(
      "No memory provider is configured. Choose one on the Memory page.",
    );
  });

  it("prefers the top-level error, so a route that sets both is not quoted twice", async () => {
    failWith({
      error: "Top level says this",
      data: { available: false, error: "Nested says that" },
    });

    const { error } = await safeApiCall("/api/anything", { method: "POST" });
    expect(error).toBe("Top level says this");
  });

  it("shows only the error field, never the rest of the body", async () => {
    // A failure body can carry a stack, a filesystem path or a token. Only the
    // field the route deliberately published as `error` is fit for a toast.
    failWith({
      data: {
        available: false,
        error: "Could not reach the memory store.",
        stack: "Error: boom\n    at C:/Users/someone/secrets/keys.ts:12:3",
        token: "ps_live_do_not_show_me",
      },
    });

    const { error } = await safeApiCall("/api/memory/hindsight", { method: "POST" });
    expect(error).toBe("Could not reach the memory store.");
    expect(error).not.toContain("keys.ts");
    expect(error).not.toContain("ps_live");
  });

  it("still falls back to the status when the nested error is not a string", async () => {
    failWith({ data: { available: false, error: { code: 17 } } });

    const { error } = await safeApiCall("/api/anything");
    expect(error).toBe("HTTP 500");
  });

  it("still falls back to the status when there is no message anywhere", async () => {
    failWith({});

    const { error } = await safeApiCall("/api/anything");
    expect(error).toBe("HTTP 500");
  });

  it("survives a nested envelope that is null or an array", async () => {
    failWith({ data: null });
    expect((await safeApiCall("/api/anything")).error).toBe("HTTP 500");

    failWith({ data: ["nope"] });
    expect((await safeApiCall("/api/anything")).error).toBe("HTTP 500");
  });
});

describe("the store-a-memory toast", () => {
  it("says what the route said, not the status code", async () => {
    // The exact path the reported defect took: the Add memory modal calls
    // runWrite, which toasts the thrown ApiError's message.
    failWith({
      data: {
        available: false,
        error:
          "No memory provider is configured, so there is nothing to store or search. " +
          "Set one up in the memory provider card at the top of the Memory page.",
      },
    });

    const showToast = jest.fn();
    // Amended 2026-09-10 (C3, T-0138): the modal writes through runWrite.
    const stored = await runWrite({
      showToast,
      url: "/api/memory/hindsight",
      body: { content: "the operator prefers short answers" },
      successMessage: "Memory stored",
      errorMessage: "Failed to store memory",
    });

    expect(stored).toBeUndefined();
    expect(showToast).toHaveBeenCalledWith(
      "No memory provider is configured, so there is nothing to store or search. " +
        "Set one up in the memory provider card at the top of the Memory page.",
      "error",
    );
    expect(showToast).not.toHaveBeenCalledWith("HTTP 500", "error");
  });
});
