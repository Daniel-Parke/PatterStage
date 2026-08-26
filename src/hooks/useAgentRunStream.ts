// ═══════════════════════════════════════════════════════════════
// useAgentRunStream — run events into one assistant message
// ═══════════════════════════════════════════════════════════════
//
// Split out of useChatPage (Phase 4 god-file decomposition). In "agent"
// mode the reply arrives as a server-sent event stream on
// /api/runs/[runId]/events: content deltas, reasoning, tool cards and
// HITL approval requests, ending in one of four terminal events.
//
// Two invariants this file exists to hold:
//
//   * An assistant turn is never left as a stuck "Thinking…"
//     placeholder. Every terminal event resolves through `finalize`,
//     which is latched so the first one wins.
//   * A superseded stream is inert. Every callback re-checks the
//     generation counter, so a stream the user has already navigated
//     away from cannot write into the message that replaced it.
//
// The `onerror` path is not a failure: the proxy closes the socket
// after "done", so an error with no terminal event means the run may
// still be completing. It reconciles from the server, which self-heals
// the message from the run row, rather than guessing a failure.
//
// That path was unreachable until T-0040. The client also subscribed to
// an SSE event named "error", which is the same name EventSource fires
// on transport failure, so the run-level handler ran first on a plain
// data-less Event, resolved the turn to the hardcoded string "run
// failed", and latched `finalized` before `onerror` could do anything.
// The proxy now sends the run's own failure as "run.error"; nothing here
// may subscribe to "error" again.

"use client";

import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type { ChatMessage, ToolCall } from "@/types/chat";
import {
  finalizeMessageApi,
  openRunEventStream,
  classifyRunEvent,
  extractDelta,
  extractReasoning,
  extractCompletedOutput,
  extractRunError,
  parseToolEvent,
  mergeToolCall,
  reframeToolsForFailedRun,
} from "@/lib/chat-utils";
import type { PendingApproval } from "@/hooks/chat-local-message";

export interface UseAgentRunStreamArgs {
  esRef: MutableRefObject<EventSource | null>;
  streamGenRef: MutableRefObject<number>;
  updateLocalMessage: (id: string, patch: Partial<ChatMessage>) => void;
  setIsStreaming: Dispatch<SetStateAction<boolean>>;
  setPendingApproval: Dispatch<SetStateAction<PendingApproval | null>>;
  loadConversations: () => Promise<unknown>;
  refreshActiveConversation: () => Promise<void>;
}

export function useAgentRunStream({
  esRef,
  streamGenRef,
  updateLocalMessage,
  setIsStreaming,
  setPendingApproval,
  loadConversations,
  refreshActiveConversation,
}: UseAgentRunStreamArgs) {
  const streamAgentRun = useCallback(
    (conversationId: string, runId: string, assistantId: string, gen: number) => {
      const acc = { content: "", reasoning: "", tools: [] as ToolCall[] };
      let finalized = false;

      const finalize = (
        status: ChatMessage["status"],
        content: string,
        error?: string,
      ) => {
        if (finalized || gen !== streamGenRef.current) return;
        finalized = true;
        esRef.current?.close();
        esRef.current = null;
        // A run that died takes its unfinished tool calls with it. Persisting
        // the accumulator as-is left rows spinning "running" forever beside a
        // turn that had already failed.
        const tools = status === "failed" ? reframeToolsForFailedRun(acc.tools) : acc.tools;
        updateLocalMessage(assistantId, {
          content,
          status,
          error: error ?? null,
          reasoning: acc.reasoning || null,
          toolCalls: tools.length > 0 ? tools : null,
        });
        setIsStreaming(false);
        setPendingApproval(null);
        void finalizeMessageApi(conversationId, assistantId, {
          content,
          reasoning: acc.reasoning || undefined,
          toolCalls: tools.length > 0 ? tools : undefined,
          status,
          error: error ?? undefined,
        });
        void loadConversations();
      };

      const es = openRunEventStream(runId, (type, data) => {
        if (gen !== streamGenRef.current) return;
        switch (classifyRunEvent(type)) {
          case "delta": {
            const d = extractDelta(data);
            if (d) {
              acc.content += d;
              updateLocalMessage(assistantId, { content: acc.content, status: "streaming" });
            }
            break;
          }
          case "reasoning": {
            const r = extractReasoning(data);
            if (r) {
              acc.reasoning += r;
              updateLocalMessage(assistantId, { reasoning: acc.reasoning });
            }
            break;
          }
          case "tool": {
            const tc = parseToolEvent(type, data);
            acc.tools = mergeToolCall(acc.tools, tc);
            updateLocalMessage(assistantId, { toolCalls: [...acc.tools] });
            if (tc.status === "approval_required") {
              setPendingApproval({ runId, toolName: tc.name });
            }
            break;
          }
          case "completed":
            finalize("complete", acc.content || extractCompletedOutput(data));
            break;
          case "failed":
            finalize("failed", acc.content, extractRunError(data));
            break;
          case "cancelled":
            finalize("cancelled", acc.content || "");
            break;
          case "done":
            finalize("complete", acc.content);
            break;
          default:
            break;
        }
      });
      esRef.current = es;
      es.onerror = () => {
        if (finalized || gen !== streamGenRef.current) return;
        // The proxy closes the socket after "done"; if we haven't finalized, the
        // run may still be completing — reconcile from the server (it self-heals
        // the message from the run row) rather than guessing a failure.
        es.close();
        esRef.current = null;
        setIsStreaming(false);
        finalized = true;
        window.setTimeout(() => {
          if (gen === streamGenRef.current) void refreshActiveConversation();
        }, 1500);
      };
    },
    [updateLocalMessage, loadConversations, refreshActiveConversation, esRef, streamGenRef, setIsStreaming, setPendingApproval],
  );

  return { streamAgentRun };
}
