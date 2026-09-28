// ═══════════════════════════════════════════════════════════════
// Chat API — Proxy to Hermes Gateway API Server
// ═══════════════════════════════════════════════════════════════
// POST /api/orchestration/chat
// Body: { messages: Array<{role, content}>, model?: string }
// Proxies to Hermes gateway at localhost:8642/v1/chat/completions
// Returns streaming response (SSE format) or non-streaming JSON.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { logApiError, serverErrorFromCatch } from "@/lib/api/api-logger";

import { parseJsonBody } from "@/lib/api/parse-json-body";
import { badRequest, ok } from "@/lib/api/api-response";
import { getAgentGateway } from "@/lib/runtime/gateway";
import { describeGatewayFailure } from "@/lib/runtime/gateway-error";
import { getGatewayKey } from "@/lib/runtime/secrets";
import { CHAT_DEFAULT_MODEL } from "@/types/chat";
import { streamAuthorizer } from "@/lib/auth/stream-guard";

function guardedChatBody(request: NextRequest, body: ReadableStream<Uint8Array>, upstream: AbortController): ReadableStream<Uint8Array> {
  const authorised = streamAuthorizer(request);
  const reader = body.getReader();
  let closed = false;
  let guardInterval: ReturnType<typeof setInterval> | null = null;
  const abortSource = () => {
    upstream.abort();
    void reader.cancel().catch(() => {});
    if (guardInterval) clearInterval(guardInterval);
  };

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const close = () => {
        if (closed) return;
        closed = true;
        abortSource();
        try { controller.close(); } catch { /* downstream already closed */ }
      };
      guardInterval = setInterval(() => { if (!authorised()) close(); }, 1000);
      try {
        while (!closed) {
          if (!authorised()) { close(); return; }
          const chunk = await reader.read();
          if (chunk.done) break;
          if (!authorised()) { close(); return; }
          controller.enqueue(chunk.value);
        }
        close();
      } catch (error) {
        if (!closed) {
          closed = true;
          abortSource();
          controller.error(error);
        }
      }
    },
    cancel() {
      closed = true;
      abortSource();
    },
  });
}

/** Shared gateway fetch — both streaming and non-streaming paths use this. */
async function fetchGateway(
  request: NextRequest,
  apiUrl: string,
  gatewayBody: Record<string, unknown>,
  isStreaming: boolean,
): Promise<Response | NextResponse> {
  // The same bearer HermesRuntime's two callers send. This was the one raw
  // fetch to the gateway with no Authorization at all, so a gateway whose
  // API_SERVER_KEY setup had written answered 401 to every fast turn
  // (T-0095, D44).
  const key = getGatewayKey();
  const upstream = new AbortController();
  request.signal?.addEventListener("abort", () => upstream.abort(), { once: true });
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify(gatewayBody),
    signal: upstream.signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    return NextResponse.json(
      { error: `Gateway error: ${response.status} — ${errorText}` },
      { status: response.status },
    );
  }

  if (isStreaming) {
    if (!response.body) return NextResponse.json({ error: "Gateway returned no stream." }, { status: 502 });
    return new Response(guardedChatBody(request, response.body, upstream), {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Non-streaming — return JSON
  const data = await response.json();
  // A gateway can finish after this browser session was revoked. The proxy
  // checked entry; recheck the actual caller before releasing its completion.
  if (!streamAuthorizer(request)()) {
    return NextResponse.json({ error: "Browser session is no longer authorised." }, {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }
  return ok(data);
}

export async function POST(request: NextRequest) {
  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;
  const body = bodyResult as { messages?: unknown; model?: string; stream?: boolean };

  try {
    const { messages, model, stream } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return badRequest("messages array is required");
    }
    const isStreaming = stream !== false; // default to streaming
    // No `chat.message_sent` here. The messages route the page calls first
    // records the turn; this proxy recorded it a second time, so a fast turn
    // counted twice in every chat achievement and on Insights (T-0095, D45).
    const { chatCompletionsUrl: apiUrl } = getAgentGateway();

    const gatewayBody = {
      model: model || CHAT_DEFAULT_MODEL,
      messages,
      stream: isStreaming,
      max_tokens: 4096,
    };

    // `return await`, not `return`. A bare return of a promise inside try
    // settles it AFTER the block has exited, so the catch below never saw a
    // connection failure and the handler answered a bodiless 500 — the
    // operator's chat failing with nothing on screen at all (T-0080).
    return await fetchGateway(request, apiUrl, gatewayBody, isStreaming);
  } catch (error) {
    // The third raw fetch to the gateway in the product, and the only one on
    // the fast-mode chat path. Same treatment as HermesRuntime's two: name the
    // address, say what to do, and answer 503 rather than 500 — PatterStage is
    // working correctly and reporting that something it depends on is not.
    // Re-resolved here rather than hoisted above the try: it is a pure read
    // of configuration, and hoisting it would run it on the 400 path too.
    const gatewayFailure = describeGatewayFailure(error, {
      baseUrl: getAgentGateway().baseUrl,
    });
    if (gatewayFailure) {
      logApiError("POST /api/orchestration/chat", "calling gateway", error);
      return NextResponse.json(
        { error: gatewayFailure.message },
        { status: gatewayFailure.status },
      );
    }
    return serverErrorFromCatch(
      "POST /api/orchestration/chat",
      "calling gateway",
      error,
      "Failed to call gateway",
    );
  }
}
