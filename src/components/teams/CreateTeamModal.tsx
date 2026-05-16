// ═══════════════════════════════════════════════════════════════
// CreateTeamModal — extracted from teams/page.tsx
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import { Plus, Users, X, Crown } from "lucide-react";
import ProfileSelector from "@/components/ui/ProfileSelector";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api-fetch";
import type { Team, TeamMember } from "@/types/hermes";

export default function CreateTeamModal({
  open,
  onClose,
  onCreated,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (team: Team) => void;
  onError?: (msg: string) => void;
}) {
  const { showToast: toastShow, toastElement } = useToast();
  // When onError is provided by the parent, use it for errors instead of our own toast
  // This avoids duplicate toast renderers when the parent already has one.
  const showError = onError ?? ((msg: string) => toastShow(msg, "error"));
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [leaderProfileId, setLeaderProfileId] = useState("");
  const [members, setMembers] = useState<Array<{ profileId: string; role: TeamMember["role"] }>>([]);
  const [saving, setSaving] = useState(false);

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
      showError(e instanceof Error ? e.message : "Failed to create team");
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
