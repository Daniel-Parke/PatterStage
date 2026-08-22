// ═══════════════════════════════════════════════════════════════
// Agent Profiles — SOUL.md and config.yaml per profile
//
// Thin page shell: the profile fetch, the Hermes push/pull actions, the
// create/delete calls and the file-editor buffer live here. The list,
// the detail column, the overview strip, the editor card and the two
// modals are presentational components under src/components/agents/.
//
// OVER THE 350-LINE TARGET, and why (T-0011 / WO-0025). Every piece of
// presentation is out; what is left is this page's own data flow -- the
// profiles fetch, five Hermes sync actions over one doSync, create,
// delete, and the editor buffer with its save-status timer. Folding
// those into a hook is the obvious next cut, and it is deliberately NOT
// made here: T-0011 scopes the page components to presentation
// extraction so the split stays provably render-neutral. The file is
// inside the 400 ceiling and that cut is the way past 350.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Users } from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useToast } from "@/components/ui/Toast";
import type { AgentProfile, ProfileFile } from "@/types/console";
import { apiFetch, toastError } from "@/lib/api-fetch";
import { profileSyncBody } from "@/lib/profile-sync-body";
import { runSyncAction } from "@/lib/operation-sync-action";
import { agentFileUrl } from "@/components/agents/agent-file-url";
import AgentsPageHeader from "@/components/agents/AgentsPageHeader";
import AgentProfilesOverview from "@/components/agents/AgentProfilesOverview";
import AgentProfileList from "@/components/agents/AgentProfileList";
import AgentProfileDetail from "@/components/agents/AgentProfileDetail";
import type { EditorState } from "@/components/agents/AgentFileEditor";
import CreateProfileModal from "@/components/agents/CreateProfileModal";
import DeleteProfileModal from "@/components/agents/DeleteProfileModal";

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

  // saveResetTimerRef — handleSave's "auto-clear the saved status
  // after 2s" setTimeout could fire on an unmounted component if
  // the user navigates away during the 2-second window. The pre-
  // fix form was:
  //   setTimeout(() => setSaveStatus("idle"), 2000);
  // with no cleanup. Fix: keep a ref to the timer handle + clear
  // it on unmount + clear any in-flight timer at the start of a
  // new save (so back-to-back saves don't double-fire and leave
  // the user with a stale "saved" state).
  const saveResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (saveResetTimerRef.current) {
        clearTimeout(saveResetTimerRef.current);
        saveResetTimerRef.current = null;
      }
    };
  }, []);

  // closeDelete — the Delete Profile modal has 3 single-setter close
  // sites that all do `() => setDeleteTarget(null)`: the modal's
  // onClose and its Cancel button (both now inside DeleteProfileModal)
  // and handleDelete's success path. Centralising into a `useCallback`
  // with empty deps (useState setters are stable) keeps the 3 in
  // lockstep. In handleDelete the two setters beside it
  // (`setSelectedProfileId` / `closeEditor`) are conditional on the
  // deleted profile being the one being edited, so they stay inline.
  const closeDelete = useCallback(() => setDeleteTarget(null), []);

  // closeEditor — the file-editor card has 3 single-setter close sites
  // that all do `() => setEditor(null)`: handleDelete's success path
  // (only when the deleted profile was the one being edited), the
  // profile-button onClick when switching profiles, and the editor's
  // own "Close" button (now inside AgentFileEditor). Centralising into
  // a `useCallback` with empty deps keeps the 3 in lockstep.
  const closeEditor = useCallback(() => setEditor(null), []);

  const { showToast, toastElement } = useToast();

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

  // Close the New Agent Profile modal. The same 4-setter block appears
  // at 2 sites — the modal's `onClose` (X-button / overlay click) and
  // `handleCreate`'s success path — so it lives here and both call it.
  // Note: the modal's Cancel button uses a deliberate SOFT close (1
  // setter, no clear) to preserve the user's in-flight form input if
  // they cancel by accident. That is a discriminated pattern, not a
  // duplicate, and it stays a separate prop on the modal.
  const closeCreate = useCallback(() => {
    setShowCreate(false);
    setCreateName("");
    setCreateDescription("");
    setCreateCloneFrom("default");
  }, []);

  // openCreate — sibling of `closeCreate` (session 116 P-7 / session
  // 118 P-7 open/close sibling pattern). Naming the open path keeps the
  // pair symmetric so a future "reset form on open" extension lands in
  // one place. The deps array lists the stable setter explicitly to
  // satisfy `react-hooks/exhaustive-deps`.
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
        // `closeDelete()` dismisses the modal. The 2-setter conditional
        // block below is gated on `selectedProfileId === target`, so
        // those setters stay inline.
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
      // Clear any in-flight save-reset timer from a prior save so
      // the new save's 2s window is the source of truth (a stale
      // timer from a previous save could race with this one's
      // setSaveStatus("saved") and prematurely flip the UI back
      // to "idle" before the user reads the "Saved!" indicator).
      if (saveResetTimerRef.current) {
        clearTimeout(saveResetTimerRef.current);
      }
      saveResetTimerRef.current = setTimeout(() => {
        saveResetTimerRef.current = null;
        setSaveStatus("idle");
      }, 2000);
      await loadProfiles();
    } catch (err) {
      setSaveStatus("error");
      toastError(showToast, err, "Failed to save file");
    }
  };

  const handleSelectProfile = (profile: AgentProfile) => {
    setSelectedProfileId(profile.id);
    if (editor && editor.profileId !== profile.id) {
      closeEditor();
    }
  };

  const hasChanges = editor ? editor.content !== editor.original : false;
  const selectedProfile = profiles.find((p) => p.id === selectedProfileId) ?? null;
  // The file open in the editor FOR THE SELECTED PROFILE, or null. Same
  // condition the file list used inline before the split.
  const openFileKey =
    editor && selectedProfile && editor.profileId === selectedProfile.id ? editor.fileKey : null;

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
      <AgentsPageHeader profileCount={profiles.length} onNewProfile={openCreate} />

      <div className="px-6 py-6">
        <AgentProfilesOverview
          profiles={profiles}
          selectedProfileId={selectedProfileId}
          syncBusy={syncBusy}
          onPushAll={handlePushAll}
          onPullAll={handlePullAll}
          onImportDiscovered={handleImportDiscovered}
          onPushOne={handlePushOne}
          onPullOne={handlePullOne}
        />

        <div className="flex flex-col lg:flex-row gap-6 min-h-[520px]">
          <AgentProfileList
            profiles={profiles}
            selectedProfileId={selectedProfileId}
            onSelect={handleSelectProfile}
          />

          <AgentProfileDetail
            profile={selectedProfile}
            onDelete={setDeleteTarget}
            openFileKey={openFileKey}
            onOpenFile={openFile}
            editor={editor}
            hasChanges={hasChanges}
            previewMode={previewMode}
            saveStatus={saveStatus}
            saving={saving}
            onTogglePreview={() => setPreviewMode(!previewMode)}
            onResetEditor={() => editor && setEditor({ ...editor, content: editor.original })}
            onEditorContentChange={(content) => editor && setEditor({ ...editor, content })}
            onSaveEditor={handleSave}
            onCloseEditor={closeEditor}
          />
        </div>

        <CreateProfileModal
          open={showCreate}
          profiles={profiles}
          name={createName}
          onNameChange={setCreateName}
          description={createDescription}
          onDescriptionChange={setCreateDescription}
          cloneFrom={createCloneFrom}
          onCloneFromChange={setCreateCloneFrom}
          creating={creating}
          onClose={closeCreate}
          onCancel={() => setShowCreate(false)}
          onCreate={handleCreate}
        />

        <DeleteProfileModal
          open={deleteTarget !== null}
          deleting={deleting}
          onClose={closeDelete}
          onDelete={handleDelete}
        />
      </div>
    </AppPageShell>
  );
}
