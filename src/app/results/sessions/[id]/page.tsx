// ═══════════════════════════════════════════════════════════════
// Session Transcript Viewer
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
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
import { sessionLoadErrorHeading } from "@/lib/sessions/session-load-error";
import { SESSIONS_LIVE_POLL_MS } from "@/hooks/useSessions";
import { SESSION_STATUS_LABELS } from "@/lib/status-labels";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { SearchInput } from "@/components/ui/Input";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { MISSIONS_PATH } from "@/lib/missions/mission-deep-link";

// ── Page ────────────────────────────────────────────────────

export default function SessionDetailPage() {
  const params = useParams();
  const sessionId = params.id as string;
  // useSessionDetail is the TanStack Query data layer for one transcript.
  // `refetch()` powers the "⟳ Refresh" button for still-running sessions
  // as a background re-fetch (cached data stays on screen — no full-page
  // LoadingSpinner flash, no scroll reset).
  // Poll while the session is running, and not otherwise (T-0105, D36). The
  // first render has no data, so the first poll decision is made on the first
  // answer, which is when there is something to poll about.
  const [live, setLive] = useState(false);
  const { data, isLoading: loading, error, errorStatus, refetch } = useSessionDetail(sessionId, {
    refetchIntervalMs: live ? SESSIONS_LIVE_POLL_MS : false,
  });
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandAll, setExpandAll] = useState<boolean | null>(null);
  const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [copied, copy] = useCopyToClipboard({ resetMs: 2000 });
  useEffect(() => {
    setLive(data?.status === "active");
  }, [data?.status]);

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
    const term = search.trim().toLowerCase();
    const result: Array<{ msg: SessionMessage; originalIndex: number }> = [];
    for (let i = 0; i < data.messages.length; i++) {
      const msg = data.messages[i] as SessionMessage;
      if (roleFilter && getMessageRole(msg) !== roleFilter) continue;
      if (term) {
        // Whatever the bubble would show: the body, or the tool it names.
        const haystack = [msg.content, msg.tool_name, (msg as { name?: string }).name]
          .filter((v): v is string => typeof v === "string")
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) continue;
      }
      result.push({ msg, originalIndex: i });
    }
    return result;
  }, [data?.messages, roleFilter, search]);

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

  const clearRoleFilter = useCallback(
    () => setRoleFilter(null),
    [setRoleFilter],
  );

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
          <div className="text-center max-w-md">
            {/* Every failure used to read "Session Not Found": a malformed id,
                a transcript over the ceiling and a rate limit all told the
                operator the same untrue thing (T-0105, D33). */}
            <h2 className="text-title font-bold text-ps-text-primary mb-2">
              {sessionLoadErrorHeading(errorStatus)}
            </h2>
            <LoadErrorBanner error={error ?? "Unknown error"} onRetry={() => void refetch()} />
            <Link
              href="/results/sessions"
              className="text-neon-orange text-body font-mono hover:underline"
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
  // A running session with a transcript had no Refresh at all: the note
  // heuristic requires ZERO messages (T-0105, D36).
  const isRunning =
    data.status === "active" ||
    isSessionStillRunning(
      data.messages.length,
      typeof data.note === "string" ? data.note : null,
    );
  const shownCount = filteredMessages.length;
  const isNarrowed = Boolean(roleFilter) || search.trim().length > 0;
  const transcriptText = filteredMessages
    .map(({ msg }) => `${getMessageRole(msg).toUpperCase()}: ${msg.content ?? ""}`)
    .join(String.fromCharCode(10, 10));

  return (
    <AppPageShell
      header={
        <PageHeader
          icon={MessageSquare}
          title={data.title || data.id}
          subtitle={subtitleParts.join(" · ")}
          color="orange"
          backHref="/results/sessions"
          backLabel="SESSIONS"
          actions={
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {data.missionId && (
                <a
                  href={`${MISSIONS_PATH}?mission=${data.missionId}`}
                  className="text-micro font-mono px-2 py-1 rounded-ps-sm bg-neon-green/10 text-neon-green hover:bg-neon-green/20 transition-colors"
                  title="Open the parent mission"
                >
                  ↗ Mission
                </a>
              )}
              <button
                type="button"
                onClick={() => setExpandAll((v) => (v === true ? false : true))}
                className="text-micro font-mono px-2 py-1 rounded-ps-sm bg-ps-surface-raised text-ps-text-muted hover:text-ps-text-primary transition-colors"
              >
                {expandAll === true ? "Collapse all" : "Expand all"}
              </button>
              <button
                type="button"
                onClick={() => void copy(transcriptText)}
                className="text-micro font-mono px-2 py-1 rounded-ps-sm bg-ps-surface-raised text-ps-text-muted hover:text-ps-text-primary transition-colors"
                title="Copy the messages currently shown"
              >
                {copied ? "Copied" : "Copy transcript"}
              </button>
              {isRunning && (
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="text-micro font-mono px-2 py-1 rounded-ps-sm bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 transition-colors"
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
                    className={`text-micro font-mono px-2 py-1 rounded-ps-sm transition-colors cursor-pointer ${
                      isActive
                        ? `${m.bgSolid} ${m.text} ring-1 ring-ps-edge-emphasis`
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
                  className="text-micro font-mono text-ps-text-muted hover:text-ps-text-secondary px-1.5 py-1 rounded-ps-sm bg-ps-surface-raised"
                >
                  clear
                </button>
              )}
            </div>
          }
        />
      }
    >
      {/* Messages */}
      <div>
        {data.status === "failed" && (
          <div
            role="alert"
            className="mb-4 rounded-ps-md border border-semantic-danger/40 bg-semantic-danger/10 p-3"
          >
            <p className="text-body font-semibold text-semantic-danger">
              {SESSION_STATUS_LABELS.failed}
              {typeof data.exitCode === "number" ? ` · exit ${data.exitCode}` : ""}
            </p>
            {data.error && (
              <p className="mt-1 text-micro font-mono text-semantic-danger/90 whitespace-pre-wrap break-words">
                {data.error}
              </p>
            )}
          </div>
        )}
        {data.truncated && (
          <p className="mb-3 text-micro font-mono text-ps-text-muted">
            Showing the most recent {data.messages.length} messages. Older messages were not loaded.
          </p>
        )}
        <div className="mb-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search this transcript"
            ariaLabel="Search transcript"
            accentColor="orange"
          />
        </div>
        {isNarrowed && (
          <div className="text-micro text-ps-text-muted font-mono mb-3">
            Showing {shownCount} of {data.messages.length} messages
          </div>
        )}
        <div className="space-y-3">
          {filteredMessages.map(({ msg, originalIndex }) => (
            <MessageBubble
              key={originalIndex}
              msg={msg}
              index={originalIndex}
              messageRefs={messageRefs}
              expandAll={expandAll}
            />
          ))}
        </div>

        {data.messages.length === 0 && (
          <div className="text-center py-12 max-w-md mx-auto">
            <MessageSquare className="w-8 h-8 text-ps-viz-glyph-idle mx-auto mb-3" />
            {data.note ? (
              <>
                <p className="text-ps-text-secondary font-mono mb-3">{data.note}</p>
                {data.missionId && (
                  <a
                    href={`${MISSIONS_PATH}?mission=${data.missionId}`}
                    className="text-neon-orange text-body font-mono hover:underline"
                  >
                    Open the parent mission →
                  </a>
                )}
              </>
            ) : (
              <p className="text-ps-text-muted font-mono">No messages in this session</p>
            )}
          </div>
        )}
      </div>
    </AppPageShell>
  );
}
