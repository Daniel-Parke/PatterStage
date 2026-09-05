/**
 * S5c — pure run-event helpers that drive the agent-chat stream. These classify
 * SSE event names and extract text/tool state from the (loosely-typed) Hermes
 * event payloads. The EventSource wiring is integration-tested via the
 * real-Hermes harness; this locks the parsing logic.
 */
import {
  classifyRunEvent,
  extractDelta,
  extractReasoning,
  extractCompletedOutput,
  extractRunError,
  parseToolEvent,
  mergeToolCall,
  toApiMessages,
} from "@/lib/chat-utils";
import type { ChatMessage, ToolCall } from "@/types/chat";

describe("classifyRunEvent", () => {
  it("buckets the Hermes 0.16 event names", () => {
    expect(classifyRunEvent("message.delta")).toBe("delta");
    expect(classifyRunEvent("response.output_text.delta")).toBe("delta");
    expect(classifyRunEvent("reasoning.available")).toBe("reasoning");
    expect(classifyRunEvent("tool.invoked")).toBe("tool");
    expect(classifyRunEvent("tool.approval_required")).toBe("tool");
    expect(classifyRunEvent("run.completed")).toBe("completed");
    expect(classifyRunEvent("response.completed")).toBe("completed");
    expect(classifyRunEvent("run.failed")).toBe("failed");
    expect(classifyRunEvent("run.error")).toBe("failed");
    // NOT "failed". This line used to read `classifyRunEvent("error")` and pin
    // the defect T-0040 fixed: "error" is the name EventSource fires on
    // transport failure, so classifying it as a run failure turned every
    // dropped socket into a fabricated one and pre-empted the reconcile path.
    // See tests/unit/chat-failure-truth.test.ts for the full statement.
    expect(classifyRunEvent("error")).toBe("ignore");
    expect(classifyRunEvent("run.cancelled")).toBe("cancelled");
    expect(classifyRunEvent("done")).toBe("done");
    expect(classifyRunEvent("open")).toBe("open");
    expect(classifyRunEvent("response.created")).toBe("ignore");
  });
});

describe("extractors", () => {
  it("pulls deltas from the documented and fallback shapes", () => {
    expect(extractDelta({ delta: "abc" })).toBe("abc");
    expect(extractDelta({ text: "xyz" })).toBe("xyz");
    expect(extractDelta("raw")).toBe("raw");
    expect(extractDelta({ nothing: 1 })).toBe("");
  });
  it("pulls reasoning text", () => {
    expect(extractReasoning({ reasoning: "because" })).toBe("because");
    expect(extractReasoning({ summary: "s" })).toBe("s");
  });
  it("pulls the completed output", () => {
    expect(extractCompletedOutput({ output: "final" })).toBe("final");
    expect(extractCompletedOutput({ content: "c" })).toBe("c");
  });
  it("pulls a run error with a fallback", () => {
    expect(extractRunError({ error: "boom" })).toBe("boom");
    expect(extractRunError({ message: "m" })).toBe("m");
    expect(extractRunError({})).toBe("run failed");
  });
});

describe("parseToolEvent", () => {
  it("maps the event suffix to a tool status", () => {
    expect(parseToolEvent("tool.invoked", { name: "search" })).toMatchObject({ name: "search", status: "invoked" });
    expect(parseToolEvent("tool.completed", { name: "search" }).status).toBe("completed");
    expect(parseToolEvent("tool.failed", { name: "x" }).status).toBe("failed");
    expect(parseToolEvent("tool.approval_required", { tool: "rm" })).toMatchObject({
      name: "rm",
      status: "approval_required",
    });
  });
  it("defaults the name when absent", () => {
    expect(parseToolEvent("tool.invoked", {}).name).toBe("tool");
  });
});

describe("mergeToolCall", () => {
  it("updates an in-flight tool entry in place rather than duplicating", () => {
    const invoked: ToolCall = { name: "search", status: "invoked" };
    const list = mergeToolCall([], invoked);
    expect(list).toHaveLength(1);
    const done = mergeToolCall(list, { name: "search", status: "completed", result: { hits: 2 } });
    expect(done).toHaveLength(1);
    expect(done[0]).toMatchObject({ name: "search", status: "completed", result: { hits: 2 } });
  });
  it("appends a distinct tool call", () => {
    const list = mergeToolCall([{ name: "a", status: "completed" }], { name: "b", status: "invoked" });
    expect(list.map((t) => t.name)).toEqual(["a", "b"]);
  });
});

describe("toApiMessages", () => {
  it("maps prior user/assistant turns + the new user text, dropping system/tool noise", () => {
    const prior = [
      { id: "1", role: "user", content: "hi", status: "complete" },
      { id: "2", role: "assistant", content: "hello", status: "complete" },
      { id: "3", role: "system", content: "sys", status: "complete" },
    ] as ChatMessage[];
    expect(toApiMessages(prior, "next")).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
      { role: "user", content: "next" },
    ]);
  });
});
