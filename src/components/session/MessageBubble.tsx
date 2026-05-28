// ═══════════════════════════════════════════════════════════════
// Session message types and MessageBubble component
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Copy, Check, ChevronDown, ChevronRight } from "lucide-react";
import { messageSummary } from "@/lib/utils";
import { ROLE_META } from "@/components/session/constants";

// ── Types ────────────────────────────────────────────────────

export interface SessionMessage {
  index: number;
  role?: string;
  content?: string;
  name?: string;
  tool_calls?: unknown[];
  tool_call_id?: string;
  tool_name?: string | null;
  finish_reason?: string | null;
  reasoning?: string | null;
  timestamp?: number;
  raw?: string;
}

export interface SessionData {
  id: string;
  filename: string;
  format: string;
  title: string;
  model: string;
  source: string;
  messages: SessionMessage[];
  messageCount: number;
  size: number;
  created: string;
}

// ── MessageBubble ────────────────────────────────────────────

export function MessageBubble({
  msg,
  index,
  messageRefs,
}: {
  msg: SessionMessage;
  index: number;
  messageRefs: React.MutableRefObject<Map<number, HTMLDivElement>>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const role = (msg.role || "unknown").toLowerCase();
  const content =
    typeof msg.content === "string"
      ? msg.content
      : JSON.stringify(msg.content, null, 2);
  const summary = useMemo(() => messageSummary(content), [content]);

  // Cleanup the copied-state timeout on unmount
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const handleCopy = () => {
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    navigator.clipboard.writeText(content || "");
    setCopied(true);
    copiedTimerRef.current = setTimeout(() => {
      copiedTimerRef.current = null;
      setCopied(false);
    }, 1500);
  };

  const config = ROLE_META[role] || ROLE_META.system;
  const isLong = content && content.length > 200;

  return (
    <div
      ref={(el) => {
        if (el) messageRefs.current.set(index, el);
        else messageRefs.current.delete(index);
      }}
      className={`rounded-xl border ${config.bg} overflow-hidden`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 border-b border-white/5 hover:bg-white/[0.02] transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={config.color}>{config.icon}</span>
          <span className={`text-xs font-mono font-bold ${config.color}`}>
            {config.label}
          </span>
          {msg.tool_call_id && (
            <span className="text-[10px] font-mono text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
              {msg.tool_call_id.slice(0, 12)}
            </span>
          )}
          {msg.name && (
            <span className="text-xs font-mono text-neon-green">
              {String(msg.name)}
            </span>
          )}
          {!expanded && (
            <span className="text-xs text-white/30 font-mono truncate ml-1">
              {summary}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {isLong && (
            <span className="text-[10px] font-mono text-white/20 mr-1">
              {(content.length / 1024).toFixed(1)}KB
            </span>
          )}
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-white/30" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-white/30" />
          )}
        </div>
      </button>
      {expanded && (
        <div className="px-4 py-3">
          <div className="flex justify-end mb-2">
            <button
              onClick={handleCopy}
              className="p-1 rounded text-white/30 hover:text-white/60 transition-colors"
              title="Copy"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-neon-green" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
          <pre className="text-sm text-white/80 font-mono whitespace-pre-wrap break-words">
            {content || "(no content)"}
          </pre>
          {Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
              <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
                Tool Calls ({msg.tool_calls.length})
              </div>
              {msg.tool_calls.map((tc: unknown, i: number) => {
                const toolCall = tc as Record<string, unknown>;
                const fn = toolCall.function as
                  | Record<string, unknown>
                  | undefined;
                const fnName = String(fn?.name || "unknown");
                const tcKey = `toolcall-${i}-${fnName.replace(/[^a-zA-Z0-9]/g, "-")}`;
                return (
                  <div
                    key={tcKey}
                    className="bg-dark-900/50 rounded-lg p-3 text-xs font-mono"
                  >
                    <span className="text-neon-green">
                      {String(fn?.name || "unknown")}
                    </span>
                    <pre className="mt-1 text-white/40 whitespace-pre-wrap">
                      {typeof fn?.arguments === "string"
                        ? fn.arguments
                        : JSON.stringify(fn?.arguments, null, 2)}
                    </pre>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
