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
import { requireAuth } from "@/lib/api-auth";
import { getAgentLlmEndpoints } from "@/lib/hermes-agent-runtime";

const DEFAULT_MODEL = "hermes-agent";

function handleError(error: unknown, context: string) {
  logApiError("chat", context, error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Request failed" },
    { status: 500 },
  );
}

/** Shared gateway fetch — both streaming and non-streaming paths use this. */
async function fetchGateway(
  apiUrl: string,
  gatewayBody: Record<string, unknown>,
  isStreaming: boolean,
): Promise<Response | NextResponse> {
  const response = await fetch(apiUrl, {
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

  if (isStreaming) {
    // Return the streaming response directly
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Non-streaming — return JSON
  const data = await response.json();
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    let body: { messages?: unknown; model?: string; stream?: boolean };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { messages, model, stream } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages array is required" }, { status: 400 });
    }

    const isStreaming = stream !== false; // default to streaming
    const { apiUrl } = getAgentLlmEndpoints();

    const gatewayBody = {
      model: model || DEFAULT_MODEL,
      messages,
      stream: isStreaming,
      max_tokens: 4096,
    };

    return await fetchGateway(apiUrl, gatewayBody, isStreaming);
  } catch (error) {
    return handleError(error, "POST /api/orchestration/chat");
  }
}