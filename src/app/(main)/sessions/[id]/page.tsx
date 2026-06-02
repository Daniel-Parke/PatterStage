// ═══════════════════════════════════════════════════════════════
// Session Transcript Viewer
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  MessageSquare,
} from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { safeApiCall } from "@/lib/api-fetch";
import { ROLE_META } from "@/components/session/constants";
import { MessageBubble, type SessionMessage, type SessionData } from "@/components/session/MessageBubble";
import { isSessionStillRunning } from "@/lib/session-title";

// ── Page ────────────────────────────────────────────────────

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
        const { data, error: fetchError } = await safeApiCall<{ data: SessionData }>(url, { method: "GET" });
        if (controller.signal.aborted) return;
        if (fetchError) {
          throw new Error(fetchError || "Failed to load session");
        }
        const { data: sessionData } = data ?? {};
        if (sessionData) {
          setData(sessionData as SessionData);
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

  // Filtered messages — use original index directly when no filter (avoids creating wrapper objects)
  const filteredMessages: Array<{ msg: SessionMessage; originalIndex: number }> = useMemo(() => {
    if (!data?.messages) return [];
    if (!roleFilter) return data.messages.map((msg, i) => ({ msg, originalIndex: i }));
    const result: Array<{ msg: SessionMessage; originalIndex: number }> = [];
    for (let i = 0; i < data.messages.length; i++) {
      if ((data.messages[i].role || "unknown").toLowerCase() === roleFilter) {
        result.push({ msg: data.messages[i], originalIndex: i });
      }
    }
    return result;
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

  // Active session: detect by either status field (when present) or
  // by the data.note text containing the "still running" hint. We use
  // a simple heuristic that works without changing the API contract:
  // if messages are empty AND note mentions running, show a refresh CTA.
  const isRunning = isSessionStillRunning(
    data.messages.length,
    typeof data.note === "string" ? data.note : null,
  );

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
            {data.missionId && (
              <a
                href={`/orchestration/missions/${data.missionId}`}
                className="text-[10px] font-mono px-2 py-1 rounded bg-neon-green/10 text-neon-green hover:bg-neon-green/20 transition-colors"
                title="Open the parent mission"
              >
                ↗ Mission
              </a>
            )}
            {isRunning && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="text-[10px] font-mono px-2 py-1 rounded bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 transition-colors"
                title="Reload to check for new messages"
              >
                ⟳ Refresh
              </button>
            )}
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
          <div className="text-center py-12 max-w-md mx-auto">
            <MessageSquare className="w-8 h-8 text-white/20 mx-auto mb-3" />
            {data.note ? (
              <>
                <p className="text-white/60 font-mono mb-3">{data.note}</p>
                {data.missionId && (
                  <a
                    href={`/orchestration/missions/${data.missionId}`}
                    className="text-neon-orange text-sm font-mono hover:underline"
                  >
                    Open the parent mission →
                  </a>
                )}
              </>
            ) : (
              <p className="text-white/40 font-mono">No messages in this session</p>
            )}
          </div>
        )}
      </div>
    </AppPageShell>
  );
}
