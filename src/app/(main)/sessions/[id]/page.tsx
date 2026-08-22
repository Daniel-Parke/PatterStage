// ═══════════════════════════════════════════════════════════════
// Session Transcript Viewer
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  MessageSquare,
} from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useSessionDetail } from "@/hooks/useSessionDetail";
import { ROLE_META, getMessageRole } from "@/components/session/constants";
import { MessageBubble, type SessionMessage } from "@/components/session/MessageBubble";
import { isSessionStillRunning } from "@/lib/sessions/session-title";

// ── Page ────────────────────────────────────────────────────

export default function SessionDetailPage() {
  const params = useParams();
  const sessionId = params.id as string;
  // useSessionDetail is the TanStack Query data layer for one transcript.
  // `refetch()` powers the "⟳ Refresh" button for still-running sessions
  // as a background re-fetch (cached data stays on screen — no full-page
  // LoadingSpinner flash, no scroll reset).
  const { data, isLoading: loading, error, refetch } = useSessionDetail(sessionId);
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Count messages by role
  const roleCounts = useMemo(() => {
    if (!data?.messages) return {};
    return data.messages.reduce(
      (acc, msg) => {
        const role = getMessageRole(msg);
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
      if (getMessageRole(data.messages[i]) === roleFilter) {
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
      .filter(({ msg }) => getMessageRole(msg) === role);
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

  // Clear the role filter. Single-setter close callback following the
  // same useCallback pattern as the open-callback promotions in
  // session 116 P-7 / session 118 P-7. The inline `() => setRoleFilter(
  // null)` arrow appeared at 2 sites — the "clear" pill (line 211) and
  // the implicit clear path on a re-click of the active role button
  // (line 195, where `setRoleFilter(isActive ? null : role)` flips
  // back to `null` when the user re-clicks the active filter). The
  // callback is reused at both sites for consistency.
  const clearRoleFilter = useCallback(
    () => setRoleFilter(null),
    [setRoleFilter],
  );

  // Re-click handler for the role badge: if the badge is already
  // active, clear the filter; otherwise set the filter to this role.
  // Replaces the inline `() => setRoleFilter(isActive ? null : role)`
  // arrow on the role button's onClick. Reads the current
  // `roleFilter` value via the closure, so it's a 1-parameter
  // useCallback — the `role` is supplied by the .map() in the JSX.
  const handleRoleBadgeClick = useCallback(
    (role: string) => setRoleFilter((prev) => (prev === role ? null : role)),
    [setRoleFilter],
  );

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
                onClick={() => void refetch()}
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
                  onClick={() => handleRoleBadgeClick(role)}
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
                onClick={clearRoleFilter}
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
