// ═══════════════════════════════════════════════════════════════
// Teams Page — Profile team management
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  Trash2,
  Crown,
  Users,
  Layout,
  ChevronRight,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import TeamAgentCard from "@/components/kanban/TeamAgentCard";
import { useToast } from "@/components/ui/Toast";
import { LoadingSpinner, EmptyState } from "@/components/ui/LoadingSpinner";
import type { Team, AgentProfile } from "@/types/hermes";
import { apiFetch } from "@/lib/api-fetch";
import CreateTeamModal from "@/components/teams/CreateTeamModal";

// ── Main Page ─────────────────────────────────────────────────

export default function TeamsPage() {
  const { showToast, toastElement } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  const loadTeams = useCallback(async () => {
    try {
      const [teamsData, profilesData] = await Promise.all([
        apiFetch("/api/teams"),
        apiFetch("/api/agent/profiles"),
      ]);
      setTeams(teamsData.data?.teams ?? []);
      setProfiles(profilesData.data?.profiles ?? []);
    } catch {
      showToast("Failed to load teams", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm("Delete this team? This cannot be undone.")) return;
    try {
      await apiFetch("/api/teams", {
        method: "POST",
        body: JSON.stringify({ action: "delete", teamId }),
      });
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
      showToast("Team deleted", "success");
    } catch {
      showToast("Failed to delete team", "error");
    }
  };

  const profileNameCache = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of profiles) {
      map[p.id] = p.name ?? p.id;
    }
    return map;
  }, [profiles]);

  return (
    <div className="min-h-screen bg-dark-950 grid-bg flex flex-col">
      {toastElement}
      <PageHeader
        icon={Users}
        title="Teams"
        subtitle="Agent teams — assign a leader and specialists to a board"
        color="purple"
        backHref="/orchestration/kanban"
        backIconOnly
        backLabel="Back to Kanban"
        actions={
          <Button variant="primary" color="purple" size="sm" icon={Plus} onClick={() => setShowCreate(true)}>
            New Team
          </Button>
        }
      />

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0 px-6 py-4">
      {loading ? (
        <LoadingSpinner text="Loading teams..." />
      ) : teams.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={Users}
            title="No teams yet"
            description="Create your first team to organize agents"
            action={
              <Button variant="primary" color="purple" size="sm" onClick={() => setShowCreate(true)}>
                Create your first team
              </Button>
            }
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {teams.map((team) => {
              const isExpanded = expandedTeamId === team.id;

              return (
                <div
                  key={team.id}
                  className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/[0.07] transition-colors"
                >
                  {/* Team header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-white truncate">{team.name}</h3>
                      {team.description && (
                        <p className="text-xs text-white/40 mt-0.5 leading-relaxed">
                          {team.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                      <span className="text-[11px] text-white/30 font-mono">{team.boardIds.length} board{team.boardIds.length !== 1 ? "s" : ""}</span>
                      <button
                        className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        onClick={() => handleDeleteTeam(team.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Team lead */}
                  <div className="flex items-center gap-2 mb-3">
                    <Crown className="w-3.5 h-3.5 text-neon-yellow flex-shrink-0" />
                    <span className="text-xs text-white/50">Lead:</span>
                    <span className="text-sm text-white/80">
                      {profileNameCache[team.leaderProfileId] ?? team.leaderProfileId}
                    </span>
                  </div>

                  {/* Member count */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-white/30" />
                      <span className="text-xs text-white/40">
                        {team.members.length} member{team.members.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={"/orchestration/kanban?team=" + team.id}
                        className="flex items-center gap-1 text-xs text-neon-cyan/70 hover:text-neon-cyan transition-colors"
                      >
                        <Layout className="w-3.5 h-3.5" />
                        Board
                      </Link>
                      <button
                        className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors"
                        onClick={() => setExpandedTeamId(isExpanded ? null : team.id)}
                      >
                        {isExpanded ? "Hide" : "View"} members
                        <ChevronRight
                          className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Expanded members */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                      {team.members.map((member) => (
                        <TeamAgentCard
                          key={member.profileId}
                          member={member}
                          profileName={profileNameCache[member.profileId] ?? member.profileId}
                          isLeader={member.profileId === team.leaderProfileId}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      </div>

      {/* Create modal */}
      <CreateTeamModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(team) => {
          setTeams((prev) => [team, ...prev]);
          showToast(`Team "${team.name}" created`, "success");
        }}
        onError={(msg) => showToast(msg, "error")}
      />
    </div>
  );
}