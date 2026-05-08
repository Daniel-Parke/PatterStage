// ═══════════════════════════════════════════════════════════════
// Session History — Browse past conversation transcripts
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Clock,
  MessageSquare,
  HardDrive,
  ChevronRight,
  Filter,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/ui/Input";
import { LoadingSpinner, EmptyState } from "@/components/ui/LoadingSpinner";
import Badge from "@/components/ui/Badge";
import type { SessionsData, Session } from "@/types/hermes";

const PAGE_SIZE = 50;

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatSessionTitle(rawTitle: string, modified: string): string {
  const date = new Date(modified);
  if (rawTitle.startsWith("Session — ")) return rawTitle;
  if (rawTitle.startsWith("session ") || /^\d{8}\s\d{6}/.test(rawTitle)) {
    return `Session — ${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  }
  return rawTitle;
}

function SessionCard({ session }: { session: Session }) {
  const displayTitle = formatSessionTitle(session.title, session.modified);
  return (
    <Link href={`/sessions/${session.id}`}>
      <div className="rounded-xl border border-white/10 bg-dark-900/50 p-4 hover:border-neon-orange/30 transition-colors group cursor-pointer">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="w-4 h-4 text-neon-orange flex-shrink-0" />
              <h3 className="font-semibold text-white truncate">
                {displayTitle}
              </h3>
            </div>
            <div className="flex items-center gap-3 text-xs text-white/30 font-mono flex-wrap">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(session.modified)}
              </span>
              {session.messageCount > 0 && (
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  {session.messageCount} msgs
                </span>
              )}
              <span className="flex items-center gap-1">
                <HardDrive className="w-3 h-3" />
                {(session.size / 1024).toFixed(1)} KB
              </span>
              {session.model && (
                <Badge color="purple">{session.model}</Badge>
              )}
              {session.source && (
                <Badge color="cyan">{session.source}</Badge>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-neon-orange group-hover:translate-x-0.5 transition-all flex-shrink-0 ml-4" />
        </div>
      </div>
    </Link>
  );
}

export default function SessionsPage() {
  const [data, setData] = useState<SessionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetch("/api/sessions")
      .then((res) => res.json())
      .then((d) => setData(d.data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setPage(0);
  }, [search, sourceFilter]);

  const sessions = data?.sessions;
  const sources = useMemo(() => {
    if (!sessions) return [];
    const srcs = new Set<string>();
    for (const s of sessions) {
      if (s.source) srcs.add(s.source);
    }
    return Array.from(srcs).sort();
  }, [sessions]);

  const filteredSessions =
    data?.sessions.filter((session) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !session.title.toLowerCase().includes(q) &&
          !session.id.toLowerCase().includes(q)
        ) return false;
      }
      if (sourceFilter && session.source !== sourceFilter) return false;
      return true;
    }) || [];

  const totalPages = Math.ceil(filteredSessions.length / PAGE_SIZE);
  const paginatedSessions = filteredSessions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="pl-64 flex flex-col h-full">
      <PageHeader
        icon={Clock}
        title="Session History"
        subtitle={`${data?.total || 0} recorded sessions`}
        color="orange"
      />

      <div className="px-6 py-6">
        {/* Search + Source Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search sessions..."
              accentColor="orange"
            />
          </div>
          {sources.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-white/30 flex-shrink-0" />
              <button
                onClick={() => setSourceFilter(null)}
                className={`text-xs font-mono px-2 py-1 rounded transition-colors ${
                  !sourceFilter
                    ? "bg-neon-orange/20 text-neon-orange"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                All
              </button>
              {sources.map((src) => (
                <button
                  key={src}
                  onClick={() => setSourceFilter(src)}
                  className={`text-xs font-mono px-2 py-1 rounded transition-colors ${
                    sourceFilter === src
                      ? "bg-neon-orange/20 text-neon-orange"
                      : "text-white/40 hover:text-white/60"
                  }`}
                >
                  {src}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <LoadingSpinner text="Loading sessions..." />
        ) : filteredSessions.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No sessions found"
            description={search || sourceFilter ? "Try a different filter" : "No recorded sessions yet"}
          />
        ) : (
          <>
            <div className="text-xs text-white/30 font-mono mb-3">
              Showing {filteredSessions.length} of {data?.total || 0} sessions
            </div>
            <div className="grid gap-3">
              {paginatedSessions.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-white/10">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="text-xs font-mono px-3 py-1.5 rounded bg-white/5 text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="text-xs text-white/30 font-mono">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="text-xs font-mono px-3 py-1.5 rounded bg-white/5 text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
