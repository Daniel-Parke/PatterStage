/** @jest-environment node */
/**
 * T-0046 acceptance oracle, producer half.
 *
 * Node environment deliberately: `sseStream` builds a real ReadableStream, and
 * jsdom has none. Running this under jsdom makes it red with
 * "ReadableStream is not defined" — red for a harness reason rather than for
 * the defect, which would prove nothing about either.
 *
 * The defect: `event: error` is the one name EventSource reserves for its own
 * transport failure, so the frame the server sends when `snapshot()` THROWS
 * arrives at the client indistinguishable from a dropped socket, and its
 * diagnosis is discarded. Same collision T-0040 fixed for chat.
 */

import { sseStream } from "@/lib/sse/event-stream";

/** Read the SSE body until the helper closes it. */
async function drain(res: Response): Promise<string> {
  const reader = (res.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

describe("sseStream names a server failure distinctly", () => {
  it("emits stream.error, NOT the name EventSource reserves for transport death", async () => {
    const body = await drain(
      sseStream<{ x: number }>({
        snapshot: () => {
          throw new Error("db locked");
        },
      }),
    );
    expect(body).toContain("event: stream.error");
    expect(body).not.toMatch(/^event: error$/m);
  });

  it("carries a diagnosis in the failure frame", async () => {
    const body = await drain(
      sseStream<{ x: number }>({
        snapshot: () => {
          throw new Error("db locked");
        },
      }),
    );
    expect(body).toContain('"error"');
  });

  // ── no-regression guards: the other two frame names are untouched ──

  it("still ends normally when the resource is simply gone", async () => {
    const body = await drain(sseStream<{ x: number }>({ snapshot: () => null }));
    expect(body).toContain("event: end");
    expect(body).toContain('"reason":"gone"');
  });

  it("still pushes state and closes on a terminal snapshot", async () => {
    const body = await drain(
      sseStream<{ done: boolean }>({
        snapshot: () => ({ done: true }),
        isTerminal: (s) => s.done,
      }),
    );
    expect(body).toContain("event: state");
    expect(body).toContain('"reason":"terminal"');
  });
});
