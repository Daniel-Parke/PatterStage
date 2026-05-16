"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, FileText, Save, RotateCcw, Download, Eye, EyeOff,
  Check, AlertCircle, Plus, Trash2,
} from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useToast } from "@/components/ui/Toast";
import type { AgentProfile, ProfileFile } from "@/types/hermes";
import {
  PERSONALITIES,
  PERSONALITY_COLORS,
  titleCasePersonality,
} from "@/lib/personalities";

interface EditorState {
  profileId: string;
  fileKey: string;
  fileName: string;
  content: string;
  original: string;
}

export default function BehaviourPage() {
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [previewMode, setPreviewMode] = useState(false);
  const [savingPersonality, setSavingPersonality] = useState<string | null>(null);

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createCloneFrom, setCreateCloneFrom] = useState("default");
  const [creating, setCreating] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { showToast, toastElement } = useToast();

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/agent/profiles");
      const data = await res.json();
      setProfiles(data.data?.profiles || []);
    } catch {
      showToast("Failed to load profiles", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  const handleCreate = async () => {
    if (creating || !createName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/agent/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          description: createDescription.trim(),
          cloneFrom: createCloneFrom,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to create profile", "error");
        return;
      }
      showToast(`Profile "${createName.trim()}" created`, "success");
      setShowCreate(false);
      setCreateName("");
      setCreateDescription("");
      setCreateCloneFrom("default");
      loadProfiles();
    } catch {
      showToast("Failed to create profile", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (deleting || !deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/agent/profiles/${deleteTarget}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || "Failed to delete profile", "error");
        return;
      }
      showToast("Profile deleted", "success");
      setDeleteTarget(null);
      setExpandedProfile(null);
      loadProfiles();
    } catch {
      showToast("Failed to delete profile", "error");
    } finally {
      setDeleting(false);
    }
  };

  const openFile = async (profileId: string, file: ProfileFile) => {
    if (!file.exists) {
      showToast(`${file.name} does not exist yet`, "info");
      return;
    }
    try {
      const url = profileId === "default"
        ? `/api/agent/files/${file.key}`
        : `/api/agent/files/${file.key}?profile=${profileId}`;
      const res = await fetch(url);
      const data = await res.json();
      const content = data.data?.content || "";
      setEditor({
        profileId,
        fileKey: file.key,
        fileName: file.name,
        content,
        original: content,
      });
      setPreviewMode(false);
      setSaveStatus("idle");
    } catch {
      showToast("Failed to load file", "error");
    }
  };

  const handleSave = async () => {
    if (!editor) return;
    setSaving(true);
    setSaveStatus("saving");
    try {
      const url = editor.profileId === "default"
        ? `/api/agent/files/${editor.fileKey}`
        : `/api/agent/files/${editor.fileKey}?profile=${editor.profileId}`;
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editor.content, backup: true }),
      });
      if (!res.ok) throw new Error("Save failed");
      setEditor({ ...editor, original: editor.content });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
      loadProfiles();
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

  const handlePersonalityChange = async (profileId: string, personality: string) => {
    setSavingPersonality(profileId);
    try {
      const res = await fetch("/api/agent/personality", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: profileId === "default" ? "default" : profileId,
          personality,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      showToast(`Personality set to "${personality}"`, "success");
      loadProfiles();
    } catch {
      showToast("Failed to update personality", "error");
    } finally {
      setSavingPersonality(null);
    }
  };

  const hasChanges = editor ? editor.content !== editor.original : false;

  if (loading) {
    return (
      <AppPageShell>
        {toastElement}
        <PageHeader icon={Users} title="Agents" subtitle="Loading profiles..." color="purple" />
        <div className="px-6 py-12"><LoadingSpinner text="Loading profiles..." /></div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell>
      {toastElement}
      <PageHeader
        icon={Users}
        title="Agent Profiles"
        subtitle={`${profiles.length} profiles configured`}
        color="purple"
        actions={
          <Button
            variant="primary"
            color="purple"
            icon={Plus}
            onClick={() => setShowCreate(true)}
          >
            New Profile
          </Button>
        }
      />

      <div className="px-6 py-6">
        {/* Profile Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {profiles.map((profile) => {
            const isExpanded = expandedProfile === profile.id;
            return (
              <div
                key={profile.id}
                className={`rounded-xl border transition-all cursor-pointer ${
                  isExpanded
                    ? profile.isDefault
                      ? "border-cyan-500/50 bg-cyan-500/5 col-span-full"
                      : "border-purple-500/50 bg-purple-500/5 col-span-full"
                    : "border-white/10 bg-dark-900/50 hover:border-white/20"
                }`}
                onClick={() => !isExpanded && setExpandedProfile(profile.id)}
              >
                {/* Card Header */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Users className={`w-5 h-5 ${profile.isDefault ? "text-cyan-400" : "text-purple-400"}`} />
                      <span className="font-semibold text-white">{profile.name}</span>
                      {profile.isDefault && (
                        <Badge color="cyan" size="sm">Default</Badge>
                      )}
                    </div>
                    <Badge
                      color={(PERSONALITY_COLORS[profile.personality] || "gray") as "cyan" | "green" | "pink" | "orange" | "purple" | "gray" | "red"}
                      size="sm"
                    >
                      {titleCasePersonality(profile.personality)}
                    </Badge>
                  </div>
                  <p className="text-sm text-white/50 mb-3">{profile.description}</p>
                  {!isExpanded && (
                    <div className="flex items-center gap-4 text-xs text-white/30">
                      <span>{profile.skillsCount} skills</span>
                      <span>{profile.files.filter(f => f.exists).length} files</span>
                    </div>
                  )}
                </div>

                {/* Expanded View */}
                {isExpanded && (
                  <div className="border-t border-white/10 p-4" onClick={(e) => e.stopPropagation()}>
                    {/* Personality Selector */}
                    <div className="mb-4 flex items-center gap-3">
                      <span className="text-sm text-white/50">Personality:</span>
                      <select
                        value={profile.personality}
                        onChange={(e) => handlePersonalityChange(profile.id, e.target.value)}
                        disabled={savingPersonality === profile.id}
                        className="bg-dark-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-purple-500/50 focus:outline-none"
                      >
                        {PERSONALITIES.map((p) => (
                          <option key={p} value={p}>{titleCasePersonality(p)}</option>
                        ))}
                      </select>
                      {savingPersonality === profile.id && (
                        <span className="text-xs text-white/30">Saving...</span>
                      )}
                    </div>

                    {/* File Groups */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {["identity", "user"].map((group) => {
                        const groupFiles = profile.files.filter((f) => {
                          if (group === "identity") return ["soul", "agents"].includes(f.key);
                          if (group === "user") return ["user", "memory"].includes(f.key);
                          return false;
                        });
                        if (groupFiles.length === 0) return null;
                        return (
                          <div key={group}>
                            <h4 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-2">
                              {group === "identity" ? "Identity" : "User"}
                            </h4>
                            {groupFiles.map((file) => (
                              <div
                                key={file.key}
                                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors group"
                              >
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-white/30" />
                                  <span className="text-sm text-white/70 font-mono">{file.name}</span>
                                  {file.exists && (
                                    <span className="text-xs text-white/20">
                                      {(file.size / 1024).toFixed(1)}KB
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {file.exists ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      color="cyan"
                                      onClick={() => openFile(profile.id, file)}
                                    >
                                      Edit
                                    </Button>
                                  ) : (
                                    <span className="text-xs text-white/20">Not found</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>

                    {/* Close button */}
                    <div className="mt-4 pt-4 border-t border-white/10 flex justify-between">
                      {!profile.isDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          color="orange"
                          icon={Trash2}
                          onClick={() => setDeleteTarget(profile.id)}
                        >
                          Delete
                        </Button>
                      )}
                      <div className="flex-1" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedProfile(null)}
                      >
                        Collapse
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Editor Panel */}
        {editor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-4xl max-h-[85vh] bg-dark-900 border border-white/10 rounded-xl flex flex-col">
              {/* Editor Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold text-white">{editor.fileName}</span>
                  <Badge color="gray" size="sm">
                    {editor.profileId === "default" ? "Main Agent" : editor.profileId}
                  </Badge>
                  {hasChanges && <Badge color="orange" size="sm">Unsaved</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={previewMode ? EyeOff : Eye}
                    onClick={() => setPreviewMode(!previewMode)}
                  >
                    {previewMode ? "Edit" : "Preview"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={RotateCcw}
                    onClick={() => setEditor({ ...editor, content: editor.original })}
                    disabled={!hasChanges}
                  >
                    Reset
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Download}
                    onClick={() => {
                      const blob = new Blob([editor.content], { type: "text/plain" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url; a.download = editor.fileName; a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Download
                  </Button>
                  <Button
                    variant="primary"
                    color="purple"
                    size="sm"
                    icon={saveStatus === "saved" ? Check : saveStatus === "error" ? AlertCircle : Save}
                    onClick={handleSave}
                    disabled={!hasChanges || saving}
                  >
                    {saving ? "Saving..." : saveStatus === "saved" ? "Saved!" : "Save"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditor(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
              {/* Editor Body */}
              <div className="flex-1 overflow-auto p-4">
                {previewMode ? (
                  <div className="prose prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap text-sm text-white/80 font-mono bg-dark-800 rounded-lg p-4">
                      {editor.content}
                    </pre>
                  </div>
                ) : (
                  <textarea
                    value={editor.content}
                    onChange={(e) => setEditor({ ...editor, content: e.target.value })}
                    className="w-full h-full min-h-[400px] bg-dark-800 border border-white/10 rounded-lg p-4 text-sm text-white/80 font-mono resize-none focus:border-purple-500/50 focus:outline-none"
                    spellCheck={false}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Create Profile Modal */}
        <Modal
          open={showCreate}
          onClose={() => { setShowCreate(false); setCreateName(""); setCreateDescription(""); setCreateCloneFrom("default"); }}
          title="New Agent Profile"
          icon={Plus}
          iconColor="text-neon-purple"
          size="md"
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button
                variant="primary"
                color="purple"
                size="sm"
                icon={Plus}
                onClick={handleCreate}
                disabled={!createName.trim() || creating}
              >
                {creating ? "Creating..." : "Create"}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/50 mb-1">Name</label>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Research Assistant"
                className="w-full bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-white/50 mb-1">Description</label>
              <input
                type="text"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder="e.g. Academic research and analysis"
                className="w-full bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-white/50 mb-1">Clone From</label>
              <select
                value={createCloneFrom}
                onChange={(e) => setCreateCloneFrom(e.target.value)}
                className="w-full bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500/50 focus:outline-none"
              >
                <option value="default">Default (Bob)</option>
                {profiles.filter(p => !p.isDefault).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          open={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          title="Delete Profile"
          icon={Trash2}
          iconColor="text-red-400"
          size="sm"
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button
                variant="primary"
                color="orange"
                size="sm"
                icon={Trash2}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </>
          }
        >
          <p className="text-sm text-white/70">
            This will permanently delete the profile and all its files. This action cannot be undone.
          </p>
        </Modal>
      </div>
    </AppPageShell>
  );
}
