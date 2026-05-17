// ═══════════════════════════════════════════════════════════════
// Chat API — Proxy to Hermes Gateway API Server
// ═══════════════════════════════════════════════════════════════
// POST /api/orchestration/chat
// Body: { messages: Array<{role, content}>, model?: string }
// Proxies to Hermes gateway at localhost:8642/v1/chat/completions
// Returns streaming response (SSE format) or non-streaming JSON.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { logApiError } from "@/lib/api-logger";

const HERMES_GATEWAY_URL = "http://127.0.0.1:8642/v1/chat/completions";
const DEFAULT_MODEL = "hermes-agent";

function handleError(error: unknown, context: string) {
  logApiError("chat", context, error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Request failed" },
    { status: 500 },
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, model, stream } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages array is required" }, { status: 400 });
    }

    const isStreaming = stream !== false; // default to streaming

    const gatewayBody = {
      model: model || DEFAULT_MODEL,
      messages,
      stream: isStreaming,
      max_tokens: 4096,
    };

    if (isStreaming) {
      // Streaming response — forward SSE to the client
      const response = await fetch(HERMES_GATEWAY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gatewayBody),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        return NextResponse.json(
          { error: `Gateway error: ${response.status} — ${errorText}` },
          { status: response.status },
        );
      }

      // Return the streaming response directly
      return new Response(response.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } else {
      // Non-streaming — return JSON
      const response = await fetch(HERMES_GATEWAY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gatewayBody),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        return NextResponse.json(
          { error: `Gateway error: ${response.status} — ${errorText}` },
          { status: response.status },
        );
      }

      const data = await response.json();
      return NextResponse.json({ data });
    }
  } catch (error) {
    return handleError(error, "POST /api/orchestration/chat");
  }
}
