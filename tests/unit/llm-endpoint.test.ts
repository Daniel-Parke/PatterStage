/** @jest-environment node */

/**
 * Phase 1.5-A — direct-provider endpoint/protocol helpers. Guards the bug where
 * an Anthropic-style base (`…/anthropic`) got `/chat/completions` appended → 404.
 */

import {
  inferApiStyle,
  normalizeApiStyle,
  buildDirectUrl,
  buildDirectRequest,
} from "@/lib/llm-endpoint";

describe("inferApiStyle", () => {
  it("treats an /anthropic base path as anthropic (MiniMax's Anthropic endpoint)", () => {
    expect(inferApiStyle("minimax", "https://api.minimax.io/anthropic")).toBe("anthropic");
    expect(inferApiStyle("minimax", "https://api.minimax.io/anthropic/")).toBe("anthropic");
    expect(inferApiStyle("custom", "https://host/anthropic/v1/messages")).toBe("anthropic");
  });
  it("treats the anthropic provider as anthropic", () => {
    expect(inferApiStyle("anthropic", "https://api.anthropic.com")).toBe("anthropic");
    expect(inferApiStyle("anthropic", null)).toBe("anthropic");
  });
  it("defaults everything else to openai", () => {
    expect(inferApiStyle("openai", "https://api.openai.com/v1")).toBe("openai");
    expect(inferApiStyle("groq", "https://api.groq.com/openai/v1")).toBe("openai");
    expect(inferApiStyle(null, null)).toBe("openai");
  });
});

describe("normalizeApiStyle", () => {
  it("passes known styles and nulls everything else", () => {
    expect(normalizeApiStyle("openai")).toBe("openai");
    expect(normalizeApiStyle("anthropic")).toBe("anthropic");
    expect(normalizeApiStyle(null)).toBeNull();
    expect(normalizeApiStyle("garbage")).toBeNull();
  });
});

describe("buildDirectUrl", () => {
  it("openai: appends /chat/completions, never double-appends", () => {
    expect(buildDirectUrl("https://api.openai.com/v1", "openai")).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
    expect(buildDirectUrl("https://api.openai.com/v1/", "openai")).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
    expect(buildDirectUrl("https://api.openai.com/v1/chat/completions", "openai")).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
  });
  it("anthropic: appends /v1/messages to a bare /anthropic base, idempotently", () => {
    expect(buildDirectUrl("https://api.minimax.io/anthropic", "anthropic")).toBe(
      "https://api.minimax.io/anthropic/v1/messages",
    );
    expect(buildDirectUrl("https://api.anthropic.com", "anthropic")).toBe(
      "https://api.anthropic.com/v1/messages",
    );
    expect(buildDirectUrl("https://api.anthropic.com/v1", "anthropic")).toBe(
      "https://api.anthropic.com/v1/messages",
    );
    expect(buildDirectUrl("https://api.anthropic.com/v1/messages", "anthropic")).toBe(
      "https://api.anthropic.com/v1/messages",
    );
  });
});

describe("buildDirectRequest", () => {
  const messages = [
    { role: "system" as const, content: "be terse" },
    { role: "user" as const, content: "hello" },
  ];

  it("openai: Bearer auth + intact messages", () => {
    const req = buildDirectRequest({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-x",
      model: "gpt-x",
      messages,
      temperature: 0.3,
      maxTokens: 100,
      style: "openai",
    });
    expect(req.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(req.headers.Authorization).toBe("Bearer sk-x");
    const body = JSON.parse(req.body);
    expect(body.messages).toHaveLength(2);
    expect(body.max_tokens).toBe(100);
  });

  it("anthropic: x-api-key + version header, hoists system out of messages", () => {
    const req = buildDirectRequest({
      baseUrl: "https://api.minimax.io/anthropic",
      apiKey: "mm-x",
      model: "MiniMax-M3",
      messages,
      temperature: 0.3,
      maxTokens: 100,
      style: "anthropic",
    });
    expect(req.url).toBe("https://api.minimax.io/anthropic/v1/messages");
    expect(req.headers["x-api-key"]).toBe("mm-x");
    expect(req.headers["anthropic-version"]).toBe("2023-06-01");
    expect(req.headers.Authorization).toBeUndefined();
    const body = JSON.parse(req.body);
    expect(body.system).toBe("be terse");
    expect(body.messages).toEqual([{ role: "user", content: "hello" }]);
    expect(body.max_tokens).toBe(100);
  });
});
