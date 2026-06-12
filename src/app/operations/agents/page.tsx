"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, FileText, Save, RotateCcw, Eye, EyeOff,
  Check, AlertCircle, Plus, Trash2,
} from "lucide-react";
import ProfilesDriftBanner from "@/components/profiles/ProfilesDriftBanner";
import ProfileSyncBar from "@/components/profiles/ProfileSyncBar";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useToast } from "@/components/ui/Toast";
import type { AgentProfile, ProfileFile } from "@/types/hermes";
import { apiFetch, toastError } from "@/lib/api-fetch";
import { profileSyncBody } from "@/lib/profile-sync-body";
import { runSyncAction } from "@/lib/operation-sync-action";

interface EditorState {
  profileId: string;
  fileKey: string;
  fileName: string;
  content: string;
  original: string;
}

/** Build the file URL for /api/agent/files/[key], with profile query param when scoped. */
function agentFileUrl(profileId: string, fileKey: string): string {
  return profileId === "default"
    ? `/api/agent/files/${fileKey}`
    : `/api/agent/files/${fileKey}?profile=${profileId}`;
}

export default function BehaviourPage() {
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // `saving` is derived from saveStatus so the two are never out of sync.
  const saving = saveStatus === "saving";
  const [previewMode, setPreviewMode] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createCloneFrom, setCreateCloneFrom] = useState("default");
  const [creating, setCreating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);

  // closeDelete — the Delete Profile modal has 3 single-setter
  // close sites that all do the same thing: `() => setDeleteTarget(null)`.
  //   1. Modal `onClose` (X-button / overlay click)
  //   2. Modal Cancel button (footer)
  //   3. handleDelete's success path (the unconditional `setDeleteTarget(null)`
  //      that dismisses the modal after a successful delete; the
  //      `if (selectedProfileId === target)` block in the same
  //      `onSuccess` body additionally clears `selectedProfileId`
  //      and `editor`, but those are conditional on the deleted
  //      profile being the one currently being edited, so they
  //      stay inline as direct setters)
  // Centralising into a `useCallback` with empty deps (useState
  // setters are stable) keeps the 3 sites in lockstep. The pre-session
  // rationale for not migrating the 3rd site ("threading a target
  // into a setter-pair callback is over-engineering") was over-
  // conservative — the `closeDelete()` body is just `setDeleteTarget(null)`
  // (no target param needed), so the 3rd site is byte-equivalent to
  // the 2 modal-close sites. Session 183 migrated the 3rd site.
  const closeDelete = useCallback(() => setDeleteTarget(null), []);

  // closeEditor — the file-editor card has 3 single-setter
  // close sites that all do the same thing: `() => setEditor(null)`.
  //   1. handleDelete's success path (line ~222) — but only when the
  //      deleted profile was the one being edited
  //   2. Profile-button onClick (line ~334) — when switching to a
  //      different profile
  //   3. Editor's "Close" button (line ~495)
  // Centralising into a `useCallback` with empty deps (useState
  // setters are stable) keeps the 3 sites in lockstep. The handleDelete
  // site is part of a 3-call success block (`closeDelete();
  // setSelectedProfileId(null); closeEditor();`), so the inline
  // `setEditor(null)` becomes `closeEditor()` — but the surrounding
  // 2 calls stay inline. This mirrors the closeDelete pattern: a
  // pure 1-setter helper extracted, leaving the multi-call success
  // path partially inline (which is the existing pattern in this page
  // for both `closeDelete` and the 4-setter `closeCreate` block).
  const closeEditor = useCallback(() => setEditor(null), []);

  const { showToast, toastElement } = useToast();

  const { driftCount, syncErrorCount } = profiles.reduce(
    (acc, p) => {
      if (p.syncStatus === "drift") acc.driftCount += 1;
      else if (p.syncStatus === "error") acc.syncErrorCount += 1;
      return acc;
    },
    { driftCount: 0, syncErrorCount: 0 },
  );

  const doSync = async (
    url: string,
    body: Record<string, unknown>,
    successMessage: string,
    errorMessage: string,
  ): Promise<void> =>
    runSyncAction({
      setBusy: setSyncBusy,
      showToast,
      url,
      body,
      successMessage,
      errorMessage,
      onSuccess: loadProfiles,
    });

  const handlePushAll = () =>
    void doSync(
      "/api/agent/profiles/sync/push",
      { all: true },
      "All profiles pushed to Hermes. Model defaults re-applied to config.yaml.",
      "Push failed",
    );

  const handlePushOne = (slug: string) =>
    void doSync(
      "/api/agent/profiles/sync/push",
      profileSyncBody(slug),
      slug === "default"
        ? `Pushed default profile to Hermes. Model defaults re-applied to config.yaml.`
        : `Pushed ${slug} to Hermes`,
      "Push failed",
    );

  const handleImportDiscovered = () =>
    void doSync(
      "/api/agent/profiles/sync/import",
      { importAllDiscovered: true },
      "Imported discovered profiles from Hermes disk",
      "Import failed",
    );

  const handlePullAll = () =>
    void doSync(
      "/api/agent/profiles/sync/pull",
      { all: true, importDiscovered: true },
      "All profiles pulled from Hermes",
      "Pull failed",
    );

  const handlePullOne = (slug: string) =>
    void doSync(
      "/api/agent/profiles/sync/pull",
      profileSyncBody(slug),
      `Pulled ${slug} from Hermes`,
      `Pull failed for ${slug}`,
    );

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/agent/profiles");
      setProfiles(data.data?.profiles || []);
    } catch (err) {
      toastError(showToast, err, "Failed to load profiles");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Close the New Agent Profile modal. The same 4-setter pair
  //   setShowCreate(false); setCreateName(""); setCreateDescription(""); setCreateCloneFrom("default");
  // appears at 2 sites — the modal's `onClose` (X-button / overlay
  // click) and the `handleCreate` success path (`onSuccess` after
  // the POST resolves). Centralising it here keeps the 2 sites in
  // lockstep if a future "clear profile-suggestion cache" or "reset
  // clone-from default" reset is added — a single edit here updates
  // both. The pattern mirrors the A3 page-local modal setter-pair
  // callbacks (session 100: `closeAgentModal` / `closeSystemModal`
  // in cron; session 98: `closeComposer` in useMissionsPage).
  // Note: the modal's Cancel button (line 492) uses a deliberate
  // SOFT close (1 setter, no clear) to preserve the user's in-flight
  // form input if they cancel by accident. That is a discriminated
  // pattern, not a duplicate — left inline.
  const closeCreate = useCallback(() => {
    setShowCreate(false);
    setCreateName("");
    setCreateDescription("");
    setCreateCloneFrom("default");
  }, []);

  // openCreate — sibling of `closeCreate` (session 116 P-7 /
  // session 118 P-7 open/close sibling pattern). The "New Profile"
  // header button (line 310) was an inline `() => setShowCreate(true)`
  // arrow, sitting next to the `closeCreate` callback that handles
  // the close path. Promoting the open to a useCallback sibling
  // names the page's intent ("open the create modal") and keeps
  // the open/close pair symmetric so a future "reset form on open"
  // or "track last-opened create-tab" extension lands in one place.
  // The deps array lists the stable setter explicitly to satisfy
  // `react-hooks/exhaustive-deps` (per session 119 P-3 codebase
  // convention).
  const openCreate = useCallback(
    () => setShowCreate(true),
    [setShowCreate],
  );

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  useEffect(() => {
    if (profiles.length === 0) return;
    setSelectedProfileId((prev) =>
      prev && profiles.some((p) => p.id === prev) ? prev : profiles[0].id,
    );
  }, [profiles]);

  const handleCreate = async () => {
    if (creating || !createName.trim()) return;
    const name = createName.trim();
    await runSyncAction({
      setBusy: setCreating,
      showToast,
      url: "/api/agent/profiles",
      method: "POST",
      body: {
        name,
        description: createDescription.trim(),
        cloneFrom: createCloneFrom,
      },
      successMessage: `Profile "${name}" created`,
      errorMessage: "Failed to create profile",
      onSuccess: async () => {
        closeCreate();
        await loadProfiles();
      },
    });
  };

  const handleDelete = async () => {
    if (deleting || !deleteTarget) return;
    const target = deleteTarget;
    await runSyncAction({
      setBusy: setDeleting,
      showToast,
      url: `/api/agent/profiles/${target}`,
      method: "DELETE",
      body: {},
      successMessage: "Profile deleted",
      errorMessage: "Failed to delete profile",
      onSuccess: async () => {
        // `closeDelete()` dismisses the modal (was inline
        // `setDeleteTarget(null)`). The 2-setter conditional block
        // below is gated on `selectedProfileId === target`, so those
        // setters stay inline (the helper triplet pattern from
        // session 100 doesn't apply — it's an unrelated 1-setter
        // closure, not a discriminated close).
        closeDelete();
        if (selectedProfileId === target) {
          setSelectedProfileId(null);
          closeEditor();
        }
        await loadProfiles();
      },
    });
  };

  const openFile = async (profileId: string, file: ProfileFile) => {
    try {
      const data = await apiFetch(agentFileUrl(profileId, file.key));
      const content = data.data?.content || "";
      setEditor({
        profileId,
        fileKey: file.key,
        fileName: file.name,
        content,
        original: content,
      });
      setPreviewMode(true);
      setSaveStatus("idle");
    } catch (e) {
      toastError(showToast, e, "Failed to load file");
    }
  };

  const handleSave = async () => {
    if (!editor) return;
    setSaveStatus("saving");
    try {
      await apiFetch(agentFileUrl(editor.profileId, editor.fileKey), {
        method: "PUT",
        body: JSON.stringify({ content: editor.content, backup: true }),
      });
      setEditor({ ...editor, original: editor.content });
      setSaveStatus("saved");
      showToast(`${editor.fileName} saved`, "success");
      setTimeout(() => setSaveStatus("idle"), 2000);
      await loadProfiles();
    } catch (err) {
      setSaveStatus("error");
      toastError(showToast, err, "Failed to save file");
    }
  };

  const hasChanges = editor ? editor.content !== editor.original : false;
  const selectedProfile = profiles.find((p) => p.id === selectedProfileId) ?? null;

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
            onClick={openCreate}
          >
            New Profile
          </Button>
        }
      />

      <div className="px-6 py-6">
        <p className="text-xs text-white/40 font-mono mb-4 max-w-3xl">
          Agent identity lives in <strong className="text-white/60">SOUL.md</strong>. Runtime policy
          (skills.disabled, platform_toolsets, model blocks) is in each profile&apos;s{" "}
          <strong className="text-white/60">config.yaml</strong>. Pull imports from Hermes disk into
          SQLite; push writes Control Hub back to disk.
        </p>

        <ProfilesDriftBanner
          driftCount={driftCount}
          errorCount={syncErrorCount}
          onPushAll={handlePushAll}
          pushing={syncBusy}
        />
        <ProfileSyncBar
          selectedSlug={selectedProfileId}
          onPushAll={handlePushAll}
          onPullAll={handlePullAll}
          onImportDiscovered={handleImportDiscovered}
          onPushOne={handlePushOne}
          onPullOne={handlePullOne}
          busy={syncBusy}
        />

        <div className="flex flex-col lg:flex-row gap-6 min-h-[520px]">
          <div className="w-full lg:w-64 shrink-0 space-y-2">
            {profiles.map((profile) => {
              const selected = selectedProfileId === profile.id;
              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => {
                    setSelectedProfileId(profile.id);
                    if (editor && editor.profileId !== profile.id) {
                      closeEditor();
                    }
                  }}
                  className={`w-full text-left rounded-xl border p-3 transition-all ${
                    selected
                      ? profile.isDefault
                        ? "border-cyan-500/50 bg-cyan-500/10"
                        : "border-purple-500/50 bg-purple-500/10"
                      : "border-white/10 bg-dark-900/50 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Users
                      className={`w-4 h-4 ${profile.isDefault ? "text-cyan-400" : "text-purple-400"}`}
                    />
                    <span className="font-semibold text-white text-sm truncate">{profile.name}</span>
                    {profile.isDefault && <Badge color="cyan" size="sm">Local default</Badge>}
                    {profile.syncStatus === "drift" && (
                      <Badge color="orange" size="sm">Drift</Badge>
                    )}
                    {profile.syncStatus === "error" && (
                      <Badge color="orange" size="sm">Sync error</Badge>
                    )}
                  </div>
                  {!profile.isDefault && (
                    <p className="text-[10px] font-mono text-white/25 mb-1">{profile.id}</p>
                  )}
                  <p className="text-xs text-white/40 line-clamp-2 mb-2">{profile.description}</p>
                  <div className="flex items-center gap-2 text-[10px] text-white/30 font-mono">
                    <span>{profile.skillsCount} skills</span>
                    <span>·</span>
                    <span>{profile.files.length} files</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex-1 min-w-0 rounded-xl border border-white/10 bg-dark-900/40 flex flex-col">
            {!selectedProfile ? (
              <div className="flex-1 flex items-center justify-center text-sm text-white/30 p-8">
                Select a profile
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-white">{selectedProfile.name}</h2>
                      {selectedProfile.isDefault && <Badge color="cyan" size="sm">Default</Badge>}
                    </div>
                    {!selectedProfile.isDefault && (
                      <p className="text-[10px] font-mono text-white/30 mt-0.5">slug: {selectedProfile.id}</p>
                    )}
                    <p className="text-sm text-white/50 mt-1">{selectedProfile.description}</p>
                  </div>
                  {!selectedProfile.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      color="orange"
                      icon={Trash2}
                      onClick={() => setDeleteTarget(selectedProfile.id)}
                    >
                      Delete profile
                    </Button>
                  )}
                </div>

                <div className="p-4 border-b border-white/10">
                  <p className="text-xs text-white/40 font-mono">
                    Edit <strong className="text-white/60">SOUL.md</strong> for voice and identity.
                    Use <strong className="text-white/60">config.yaml</strong> for skills.disabled and
                    platform_toolsets. Session display presets:{" "}
                    <a href="/operations/personalities" className="text-neon-cyan hover:underline">
                      Personalities
                    </a>
                    .
                  </p>
                </div>

                <div className="p-4 flex-1 overflow-auto">
                  <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">
                    Behaviour files
                  </h3>
                  <div className="space-y-1">
                    {selectedProfile.files.map((file) => (
                      <div
                        key={file.key}
                        className={`flex items-center justify-between py-2 px-3 rounded-lg border transition-colors ${
                          editor?.fileKey === file.key &&
                          editor.profileId === selectedProfile.id
                            ? "border-purple-500/40 bg-purple-500/5"
                            : "border-transparent hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-white/30 shrink-0" />
                          <span className="text-sm text-white/70 font-mono truncate">{file.name}</span>
                          {file.exists ? (
                            <span className="text-xs text-white/20 shrink-0">
                              {(file.size / 1024).toFixed(1)}KB
                            </span>
                          ) : (
                            <span className="text-xs text-white/25 shrink-0">missing</span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          color="cyan"
                          onClick={() => openFile(selectedProfile.id, file)}
                        >
                          {file.exists ? "Edit" : "Create"}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {editor && editor.profileId === selectedProfile.id && (
                  <div className="border-t border-white/10 p-4 flex flex-col gap-3 max-h-[50vh]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-white">{editor.fileName}</span>
                        {hasChanges && <Badge color="orange" size="sm">Unsaved</Badge>}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
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
                          variant="primary"
                          color="purple"
                          size="sm"
                          icon={
                            saveStatus === "saved"
                              ? Check
                              : saveStatus === "error"
                                ? AlertCircle
                                : Save
                          }
                          onClick={handleSave}
                          disabled={!hasChanges || saving}
                        >
                          {saving ? "Saving..." : saveStatus === "saved" ? "Saved!" : "Save"}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={closeEditor}>
                          Close
                        </Button>
                      </div>
                    </div>
                    {previewMode ? (
                      <pre className="whitespace-pre-wrap text-sm text-white/80 font-mono bg-dark-800 rounded-lg p-4 overflow-auto max-h-64">
                        {editor.content}
                      </pre>
                    ) : (
                      <textarea
                        value={editor.content}
                        onChange={(e) => setEditor({ ...editor, content: e.target.value })}
                        className="w-full min-h-[200px] max-h-64 bg-dark-800 border border-white/10 rounded-lg p-4 text-sm text-white/80 font-mono resize-y focus:border-purple-500/50 focus:outline-none"
                        spellCheck={false}
                      />
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <Modal
          open={showCreate}
          onClose={closeCreate}
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

        <Modal
          open={deleteTarget !== null}
          onClose={closeDelete}
          title="Delete Profile"
          icon={Trash2}
          iconColor="text-red-400"
          size="sm"
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={closeDelete}>Cancel</Button>
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
