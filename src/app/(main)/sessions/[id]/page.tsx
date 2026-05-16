// ═══════════════════════════════════════════════════════════════
// Session Transcript Viewer
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  User,
  Bot,
  Wrench,
  Cpu,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  MessageSquare,
} from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { messageSummary } from "@/lib/utils";

interface SessionMessage {
  index: number;
  role?: string;
  content?: string;
  name?: string;
  tool_calls?: unknown[];
  tool_call_id?: string;
  raw?: string;
  [key: string]: unknown;
}

interface SessionData {
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

// ── Role-to-meta mapping (module-level, shared by MessageBubble and page) ──
const ROLE_META: Record<string, {
  icon: React.ReactNode; color: string; bg: string; bgSolid: string; text: string; label: string;
}> = {
  user: {
    icon: <User className="w-3.5 h-3.5" />,
    color: "text-neon-cyan",
    bg: "border-neon-cyan/20 bg-neon-cyan/5",
    bgSolid: "bg-neon-cyan/10",
    text: "text-neon-cyan",
    label: "USER",
  },
  assistant: {
    icon: <Bot className="w-3.5 h-3.5" />,
    color: "text-neon-purple",
    bg: "border-neon-purple/20 bg-neon-purple/5",
    bgSolid: "bg-neon-purple/10",
    text: "text-neon-purple",
    label: "ASSISTANT",
  },
  tool: {
    icon: <Wrench className="w-3.5 h-3.5" />,
    color: "text-neon-green",
    bg: "border-neon-green/20 bg-neon-green/5",
    bgSolid: "bg-neon-green/10",
    text: "text-neon-green",
    label: "TOOL",
  },
  system: {
    icon: <Cpu className="w-3.5 h-3.5" />,
    color: "text-white/50",
    bg: "border-white/10 bg-white/5",
    bgSolid: "bg-white/5",
    text: "text-white/40",
    label: "SYSTEM",
  },
};

function MessageBubble({ msg, index, messageRefs }: { msg: SessionMessage; index: number; messageRefs: React.MutableRefObject<Map<number, HTMLDivElement>> }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const role = (msg.role || "unknown").toLowerCase();
  const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content, null, 2);
  const summary = useMemo(() => messageSummary(content), [content]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const config = ROLE_META[role] || ROLE_META.system;
  const isLong = content && content.length > 200;
  const displayContent = expanded ? content : "";

  return (
    <div ref={(el) => { if (el) messageRefs.current.set(index, el); else messageRefs.current.delete(index); }} className={`rounded-xl border ${config.bg} overflow-hidden`}>
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
            {displayContent || "(no content)"}
          </pre>
        {Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
            <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
              Tool Calls ({msg.tool_calls.length})
            </div>
            {msg.tool_calls.map((tc: unknown, i: number) => {
              const toolCall = tc as Record<string, unknown>;
              const fn = toolCall.function as Record<string, unknown> | undefined;
              return (
                <div key={i} className="bg-dark-900/50 rounded-lg p-3 text-xs font-mono">
                  <span className="text-neon-green">{String(fn?.name || "unknown")}</span>
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

export default function SessionDetailPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    void (async () => {
      const url = "/api/sessions/" + encodeURIComponent(sessionId);
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errBody?.error || "Failed to load session");
        }
        const json = await res.json() as { data?: SessionData };
        if (json.data) {
          setData(json.data);
        } else {
          throw new Error("Invalid session data format");
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [sessionId]);

  // Count messages by role
  const roleCounts = useMemo(() => {
    if (!data?.messages) return {};
    return data.messages.reduce(
      (acc, msg) => {
        const role = msg.role || "unknown";
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }, [data?.messages]);

  // Filtered messages
  const filteredMessages = useMemo(() => {
    if (!data?.messages) return [];
    if (!roleFilter) return data.messages.map((msg, i) => ({ msg, originalIndex: i }));
    return data.messages
      .map((msg, i) => ({ msg, originalIndex: i }))
      .filter(({ msg }) => (msg.role || "unknown").toLowerCase() === roleFilter);
  }, [data?.messages, roleFilter]);

  // Scroll to next message of a given role from current scroll position
  const scrollToNextRole = useCallback((role: string) => {
    if (!data?.messages) return;
    const roleMessages = data.messages
      .map((msg, i) => ({ msg, index: i }))
      .filter(({ msg }) => (msg.role || "unknown").toLowerCase() === role);
    if (roleMessages.length === 0) return;

    // Find first message below current viewport
    const viewportTop = window.scrollY + 120; // offset for sticky header
    for (const { index } of roleMessages) {
      const el = messageRefs.current.get(index);
      if (el && el.offsetTop > viewportTop) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    // Wrap around — scroll to first message of this role
    const firstEl = messageRefs.current.get(roleMessages[0].index);
    if (firstEl) firstEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [data?.messages]);

  // Reuse roleMeta for filter-button styling

  if (loading) {
    return (
      <AppPageShell>
        <div className="min-h-[60vh] flex items-center justify-center">
          <LoadingSpinner text="Loading transcript..." />
        </div>
      </AppPageShell>
    );
  }

  if (error || !data) {
    return (
      <AppPageShell>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-bold text-white mb-2">Session Not Found</h2>
            <p className="text-white/40 font-mono mb-4">{error || "Unknown error"}</p>
            <Link
              href="/sessions"
              className="text-neon-orange text-sm font-mono hover:underline"
            >
              ← Back to Sessions
            </Link>
          </div>
        </div>
      </AppPageShell>
    );
  }

  const subtitleParts: string[] = [];
  if (data.model) subtitleParts.push(data.model);
  subtitleParts.push(`${data.messageCount} messages`);
  subtitleParts.push(`${(data.size / 1024).toFixed(1)} KB`);

  return (
    <AppPageShell>
      <PageHeader
        icon={MessageSquare}
        title={data.title || data.id}
        subtitle={subtitleParts.join(" · ")}
        color="orange"
        backHref="/sessions"
        backLabel="SESSIONS"
        actions={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {Object.entries(roleCounts).map(([role, count]) => {
              const m = ROLE_META[role] || ROLE_META.system;
              const isActive = roleFilter === role;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setRoleFilter(isActive ? null : role)}
                  onDoubleClick={() => scrollToNextRole(role)}
                  title={`Click to filter · Double-click to jump to next ${role}`}
                  className={`text-xs font-mono px-2 py-1 rounded transition-colors cursor-pointer ${
                    isActive
                      ? `${m.bgSolid} ${m.text} ring-1 ring-white/20`
                      : `${m.bgSolid} ${m.text} opacity-60 hover:opacity-100`
                  }`}
                >
                  {count} {role}
                </button>
              );
            })}
            {roleFilter && (
              <button
                type="button"
                onClick={() => setRoleFilter(null)}
                className="text-[10px] font-mono text-white/30 hover:text-white/60 px-1.5 py-1 rounded bg-white/5"
              >
                clear
              </button>
            )}
          </div>
        }
      />

      {/* Messages */}
      <div className="max-w-4xl mx-auto px-6 py-6 flex-1 w-full">
        {roleFilter && (
          <div className="text-xs text-white/30 font-mono mb-3">
            Showing {filteredMessages.length} {roleFilter} messages of {data.messages.length} total
          </div>
        )}
        <div className="space-y-3">
          {filteredMessages.map(({ msg, originalIndex }) => (
            <MessageBubble key={originalIndex} msg={msg} index={originalIndex} messageRefs={messageRefs} />
          ))}
        </div>

        {data.messages.length === 0 && (
          <div className="text-center py-12">
            <MessageSquare className="w-8 h-8 text-white/20 mx-auto mb-3" />
            <p className="text-white/40 font-mono">No messages in this session</p>
          </div>
        )}
      </div>
    </AppPageShell>
  );
}
