// ═══════════════════════════════════════════════════════════════
// Session History — Unified view of all agent sessions
//
// Control Hub is the source of truth. Sessions born from missions
// and cron jobs are written directly to the DB. Hermes CLI
// sessions are synced from ~/.hermes/<profile>/sessions/ on
// every page load via the /api/sessions endpoint.
//
// Sources: cli (Hermes interactive), cron (scheduled jobs),
//         mission (Control Hub dispatch), api (direct API calls)
// ═══════════════════════════════════════════════════════════════

"use client";

import { useCallback, useState, useEffect, useMemo } from "react";
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
import Pagination from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { timeAgo } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";
import AppPageShell from "@/components/layout/AppPageShell";
import type { SessionRecord } from "@/lib/session-repository";
import type { SessionSource } from "@/lib/session-repository";
import { SOURCE_META, formatSessionTitle } from "@/components/session/constants";

// ── Types ────────────────────────────────────────────────────

interface SessionsResponse {
  sessions: SessionRecord[];
  total: number;
}

// ── Constants ────────────────────────────────────────────────

const PAGE_SIZE = 50;

// ── Components ───────────────────────────────────────────────

function SessionCard({ session }: { session: SessionRecord }) {
  const title = formatSessionTitle(session);
  const meta = SOURCE_META[session.source] ?? SOURCE_META.cli;
  const statusColor =
    session.status === "active"
      ? "text-green-400"
      : session.status === "failed"
        ? "text-red-400"
        : "text-white/30";

  return (
    <Link href={`/sessions/${session.id}`}>
      <div className="rounded-xl border border-white/10 bg-dark-900/50 p-4 hover:border-neon-orange/30 transition-colors group cursor-pointer">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="w-4 h-4 text-neon-orange flex-shrink-0" />
              <h3 className="font-semibold text-white truncate">{title}</h3>
            </div>
            <div className="flex items-center gap-3 text-xs text-white/30 font-mono flex-wrap">
              <span className={`flex items-center gap-1 ${statusColor}`}>
                <Clock className="w-3 h-3" />
                {timeAgo(session.startedAt)}
              </span>
              <span className="flex items-center gap-1">
                <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono ${meta.colorClass}`}>
                  {meta.icon}
                  {meta.label}
                </span>
              </span>
              {session.profileName && (
                <span className="text-white/40">{session.profileName}</span>
              )}
              {session.modelId && (
                <Badge color="purple">{session.modelId}</Badge>
              )}
              {session.size > 0 && (
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  {(session.size / 1024).toFixed(1)} KB
                </span>
              )}
              {session.missionId && (
                <Badge color="green">mission</Badge>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-neon-orange group-hover:translate-x-0.5 transition-all flex-shrink-0 ml-4" />
        </div>
      </div>
    </Link>
  );
}

// ── Page ────────────────────────────────────────────────────

export default function SessionsPage() {
  const [data, setData] = useState<SessionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SessionSource | null>(null);
  const [page, setPage] = useState(0);
  const { showToast, toastElement } = useToast();

  const loadSessions = useCallback(
    async (offset: number) => {
      setLoading(true);
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (sourceFilter) params.set("source", sourceFilter);

      try {
        const json = await apiFetch(`/api/sessions?${params}`);
        setData(json.data ?? { sessions: [], total: 0 });
      } catch {
        showToast("Failed to load sessions", "error");
      } finally {
        setLoading(false);
      }
    },
    [sourceFilter, showToast],
  );

  // Initial load + reload on filter change
  useEffect(() => {
    setPage(0);
    void loadSessions(0);
  }, [loadSessions]);

  // Stable reference for downstream useMemo hooks — prevents unnecessary recomputation
  // on renders where data hasn't changed. Using data?.sessions as dependency is safe:
  // it only produces a new reference when the API response changes.
  const sessions = useMemo(() => data?.sessions ?? [], [data?.sessions]);

  // All known session source types — always show filter buttons regardless of current page contents
  const sources = Object.keys(SOURCE_META) as SessionSource[];

  const filteredSessions = useMemo(() => {
    if (!search) return sessions;
    const q = search.toLowerCase();
    return sessions.filter(
      (s) =>
        (s.title?.toLowerCase() ?? "").includes(q) ||
        s.id.toLowerCase().includes(q) ||
        (s.profileName?.toLowerCase() ?? "").includes(q),
    );
  }, [sessions, search]);

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  return (
    <AppPageShell>
      <PageHeader
        icon={Clock}
        title="Session History"
        subtitle={`${data?.total ?? 0} recorded sessions across all agents`}
        color="orange"
      />

      <div className="px-6 py-6">
        {/* Search + Source Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search sessions by title, ID, or profile..."
              accentColor="orange"
            />
          </div>
          {sources.length > 0 && (
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
                  className={`text-xs font-mono px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                    sourceFilter === src
                      ? "bg-neon-orange/20 text-neon-orange"
                      : "text-white/40 hover:text-white/60"
                  }`}
                >
                  {SOURCE_META[src]?.icon}
                  {SOURCE_META[src]?.label ?? src}
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
            description={
              search || sourceFilter ? "Try a different filter" : "No recorded sessions yet"
            }
          />
        ) : (
          <>
            <div className="text-xs text-white/30 font-mono mb-3">
              Showing {filteredSessions.length} of {data?.total ?? 0} sessions
            </div>
            <div className="grid gap-3">
              {filteredSessions.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
            {totalPages > 1 && (
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={(newPage) => {
                  setPage(newPage);
                  void loadSessions(newPage * PAGE_SIZE);
                }}
              />
            )}
          </>
        )}
      </div>
      {toastElement}
    </AppPageShell>
  );
}
