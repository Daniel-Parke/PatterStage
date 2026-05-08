// ═══════════════════════════════════════════════════════════════
// Teams Page — Team management for multi-agent coordination
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Bot,
  Loader2,
  Trash2,
  Crown,
  Users,
  Layout,
  ChevronRight,
  X,
} from "lucide-react";
import TeamAgentCard from "@/components/kanban/TeamAgentCard";
import ProfileSelector from "@/components/ui/ProfileSelector";
import { useToast } from "@/components/ui/Toast";
import type { Team, TeamMember, AgentProfile } from "@/types/hermes";

// ── API helpers ────────────────────────────────────────────────

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Create Team Modal ──────────────────────────────────────────

function CreateTeamModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (team: Team) => void;
}) {
  const { showToast, toastElement } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [leaderProfileId, setLeaderProfileId] = useState("");
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [members, setMembers] = useState<Array<{ profileId: string; role: TeamMember["role"] }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      apiFetch("/api/agent/profiles")
        .then((d) => setProfiles(d.data?.profiles ?? []))
        .catch(() => {});
    }
  }, [open]);

  const handleAddMember = () => {
    setMembers([...members, { profileId: "", role: "specialist" }]);
  };

  const handleRemoveMember = (i: number) => {
    setMembers(members.filter((_, idx) => idx !== i));
  };

  const handleMemberProfileChange = (i: number, profileId: string) => {
    const updated = [...members];
    updated[i] = { ...updated[i], profileId };
    setMembers(updated);
  };

  const handleMemberRoleChange = (i: number, role: TeamMember["role"]) => {
    const updated = [...members];
    updated[i] = { ...updated[i], role };
    setMembers(updated);
  };

  const handleCreate = async () => {
    if (!name.trim() || !leaderProfileId) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/teams", {
        method: "POST",
        body: JSON.stringify({
          action: "create",
          name: name.trim(),
          description: description.trim(),
          leaderProfileId,
          members: members.filter((m) => m.profileId),
        }),
      });

      if (res.error) throw new Error(res.error);
      const team = res.data?.team as Team;
      if (team?.id) {
        onCreated(team);
        onClose();
        setName("");
        setDescription("");
        setLeaderProfileId("");
        setMembers([]);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to create team", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 rounded-xl border border-white/10 bg-dark-950 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-neon-purple" />
            Create Team
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg text-white/40 hover:bg-white/5">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1.5 uppercase tracking-wider">
              Team Name *
            </label>
            <input
              className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white
                placeholder-white/30 focus:outline-none focus:border-neon-cyan/50 transition-colors"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Platform Engineering Team"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1.5 uppercase tracking-wider">
              Description
            </label>
            <textarea
              className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white
                placeholder-white/30 focus:outline-none focus:border-neon-cyan/50 transition-colors resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this team do?"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1.5 uppercase tracking-wider">
              <Crown className="w-3 h-3 inline mr-1 text-neon-yellow" />
              Team Lead *
            </label>
            <ProfileSelector
              value={leaderProfileId}
              onChange={setLeaderProfileId}
              placeholder="Select team lead…"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                Members
              </label>
              <button
                className="text-xs text-neon-purple hover:text-neon-purple/80 flex items-center gap-1 transition-colors"
                onClick={handleAddMember}
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
            {members.map((m, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <ProfileSelector
                  value={m.profileId}
                  onChange={(v) => handleMemberProfileChange(i, v)}
                  placeholder="Select member…"
                />
                <select
                  className="bg-dark-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/70
                    focus:outline-none focus:border-neon-purple/50 transition-colors appearance-none"
                  value={m.role}
                  onChange={(e) => handleMemberRoleChange(i, e.target.value as TeamMember["role"])}
                >
                  <option value="specialist">Specialist</option>
                  <option value="reviewer">Reviewer</option>
                  <option value="observer">Observer</option>
                </select>
                <button
                  className="text-white/30 hover:text-red-400 transition-colors flex-shrink-0"
                  onClick={() => handleRemoveMember(i)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {members.length === 0 && (
              <p className="text-xs text-white/30 py-2">No additional members yet.</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/10 flex-shrink-0">
          <button
            className="text-sm px-4 py-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="text-sm px-4 py-1.5 rounded-lg bg-neon-purple/10 text-neon-purple
              hover:bg-neon-purple/20 border border-neon-purple/20 transition-colors disabled:opacity-50"
            onClick={handleCreate}
            disabled={saving || !name.trim() || !leaderProfileId}
          >
            {saving ? "Creating…" : "Create Team"}
          </button>
        </div>
        {toastElement}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function TeamsPage() {
  const router = useRouter();
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
    } catch (e) {
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

  const getProfileName = (profileId: string) => {
    const p = profiles.find((x) => x.id === profileId);
    return p?.name ?? profileId;
  };

  const getLeaderProfile = (team: Team) => {
    return profiles.find((p) => p.id === team.leaderProfileId);
  };

  return (
    <div className="pl-64 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-neon-purple" />
            Teams
          </h1>
          <p className="text-xs text-white/40 mt-0.5">
            Agent teams — assign a leader and specialists to a board
          </p>
        </div>
        <button
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-neon-purple/30
            text-neon-purple hover:bg-neon-purple/10 transition-colors"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="w-4 h-4" />
          New Team
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-neon-purple animate-spin" />
        </div>
      ) : teams.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Users className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/50 mb-4">No teams yet</p>
            <button
              className="text-sm px-4 py-2 rounded-lg bg-neon-purple/10 text-neon-purple
                hover:bg-neon-purple/20 border border-neon-purple/20 transition-colors"
              onClick={() => setShowCreate(true)}
            >
              Create your first team
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {teams.map((team) => {
              const isExpanded = expandedTeamId === team.id;
              const leaderProfile = getLeaderProfile(team);

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
                      {getProfileName(team.leaderProfileId)}
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
                        href={"/kanban?team=" + team.id}
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
                          profileName={getProfileName(member.profileId)}
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

      {/* Create modal */}
      <CreateTeamModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(team) => {
          setTeams((prev) => [team, ...prev]);
          showToast(`Team "${team.name}" created`, "success");
        }}
      />

      {toastElement}
    </div>
  );
}
