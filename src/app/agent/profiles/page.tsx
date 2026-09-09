// ═══════════════════════════════════════════════════════════════
// Agents — SOUL.md and config.yaml per profile
//
// Thin page shell: the profile fetch, the Hermes push/pull actions, the
// create/delete calls and the file-editor buffer live here. The table, the
// detail card, the overview strip, the editor card and the three dialogs are
// presentational components under src/components/agents/.
//
// ONE PICKER, IN THE HEADER (T-0125). The profile was chosen here with a
// column of cards down the left, on Skills with a dropdown in the header and
// on Tools with a card in the body: three controls for one selection, which
// T-0113 had already made shared. The header carries the one control now, on
// all three screens; the table below marks the row it chose and the detail
// card gets the full width the card column used to take.
//
// OVER THE 350-LINE TARGET, and why (T-0011 / WO-0025). Every piece of
// presentation is out; what is left is this page's own data flow: the
// profiles fetch, five Hermes sync actions over one doSync, create, delete,
// and the editor buffer with its save-status timer.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Users } from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import PageLoading from "@/components/ui/PageLoading";
import ProfilePicker from "@/components/ui/ProfilePicker";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { LastResult, useToast } from "@/components/ui/Toast";
import type { AgentProfile, ProfileFile } from "@/types/console";
import { API_FETCH_BULK_TIMEOUT_MS, apiFetch, toastError } from "@/lib/api-fetch";
import { profileSyncBody } from "@/lib/profile-sync-body";
import { runWrite } from "@/lib/api-write";
import { agentFileUrl } from "@/components/agents/agent-file-url";
import { DEFAULT_PROFILE_SLUG, slugifyDisplayName } from "@/lib/profile-slug";
import { pluralise } from "@/lib/utils";
import { useSelectedProfile } from "@/hooks/useSelectedProfile";
import AgentSetupNotice from "@/components/agents/AgentSetupNotice";
import AgentProfilesOverview from "@/components/agents/AgentProfilesOverview";
import AgentProfilesTable from "@/components/agents/AgentProfilesTable";
import AgentProfileDetail from "@/components/agents/AgentProfileDetail";
import type { EditorState } from "@/components/agents/AgentFileEditor";
import type { ProfileTab } from "@/components/agents/AgentProfileDetail";
import CreateProfileModal from "@/components/agents/CreateProfileModal";
import EditProfileModal from "@/components/agents/EditProfileModal";
import DeleteProfileModal from "@/components/agents/DeleteProfileModal";

/** An action the operator asked for while the editor held unsaved work. */
type PendingDiscard =
  | { kind: "select"; profile: AgentProfile }
  | { kind: "open"; profileId: string; file: ProfileFile }
  | { kind: "close" };

export default function BehaviourPage() {
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  // The profiles read's failure, kept apart from the list: a failed load
  // looked like an empty install with no way to retry (T-0096, D22).
  const [loadError, setLoadError] = useState<string | null>(null);
  // Shared with Skills and Tools (T-0113), and chosen with the same control
  // on all three (T-0125).
  const [selectedProfileId, setSelectedProfileId] = useSelectedProfile();
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

  const [editTarget, setEditTarget] = useState<AgentProfile | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // What the operator asked for while an edit was unsaved. Held here rather
  // than acted on: selecting another profile closed the editor and opening
  // another file overwrote the buffer, both in silence, next to a dirty flag
  // that was already driving an "Unsaved" badge two lines away (T-0102, D23).
  const [pendingDiscard, setPendingDiscard] = useState<PendingDiscard | null>(null);

  // The first read is worth a loading state; every one after it is a refetch
  // behind work the operator just did. Making them watch the page blank out
  // after every save was the single loudest thing on this screen (T-0102, D21).
  const loadedOnceRef = useRef(false);

  // Which half of the card is showing. The tab is in the URL because
  // /agent/personalities and /operations/personalities redirect to
  // ?tab=identity, and because a bookmark to one half should come back to it.
  // Read from window rather than useSearchParams: this is a client page with
  // no Suspense boundary, and useSearchParams needs one.
  const [tab, setTab] = useState<ProfileTab>("files");
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab");
    if (wanted === "identity") setTab("identity");
  }, []);

  // The "saved" flash clears itself after 2s; the ref lets an unmount, or a
  // second save inside the window, clear the timer rather than let it fire on
  // a component that is gone or a status that has moved on.
  const saveResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (saveResetTimerRef.current) {
        clearTimeout(saveResetTimerRef.current);
        saveResetTimerRef.current = null;
      }
    };
  }, []);

  const closeDelete = useCallback(() => setDeleteTarget(null), []);
  const closeEditor = useCallback(() => setEditor(null), []);

  const { showToast, toastElement, lastResult } = useToast();

  const doSync = async (
    url: string,
    body: Record<string, unknown>,
    successMessage: string,
    errorMessage: string,
  ): Promise<void> =>
    runWrite({
      setBusy: setSyncBusy,
      showToast,
      url,
      body,
      successMessage,
      errorMessage,
      onSuccess: loadProfiles,
      // Bulk: work scales with the install, not the request (T-0047).
      timeoutMs: API_FETCH_BULK_TIMEOUT_MS,
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
    if (!loadedOnceRef.current) setLoading(true);
    try {
      const data = await apiFetch("/api/agent/profiles");
      setProfiles(data.data?.profiles || []);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error && err.message ? err.message : "Failed to load profiles");
    } finally {
      loadedOnceRef.current = true;
      setLoading(false);
    }
  }, []);

  // Close the New Agent Profile dialog. The modal's `onClose` (X / overlay)
  // and `handleCreate`'s success path both clear the form; the modal's Cancel
  // is a deliberate SOFT close that keeps in-flight input if the operator
  // cancels by accident.
  const closeCreate = useCallback(() => {
    setShowCreate(false);
    setCreateName("");
    setCreateDescription("");
    setCreateCloneFrom("default");
  }, []);

  const openCreate = useCallback(() => setShowCreate(true), []);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  // A selection carried in from another screen may name a profile this install
  // no longer has (it was deleted, or the list is from a different machine).
  // This page holds the list, so this page is where it is reconciled.
  useEffect(() => {
    if (profiles.length === 0) return;
    if (!profiles.some((p) => p.id === selectedProfileId)) setSelectedProfileId(profiles[0].id);
  }, [profiles, selectedProfileId, setSelectedProfileId]);

  const handleCreate = async () => {
    if (creating || !createName.trim()) return;
    const name = createName.trim();
    await runWrite({
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
    await runWrite({
      setBusy: setDeleting,
      showToast,
      url: `/api/agent/profiles/${target}`,
      method: "DELETE",
      body: {},
      successMessage: "Profile deleted",
      errorMessage: "Failed to delete profile",
      onSuccess: async () => {
        closeDelete();
        if (selectedProfileId === target) {
          // The root agent is the one profile that cannot be deleted, so it is
          // always there to fall back to.
          setSelectedProfileId(DEFAULT_PROFILE_SLUG);
          closeEditor();
        }
        await loadProfiles();
      },
    });
  };

  const doOpenFile = async (profileId: string, file: ProfileFile) => {
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
    await runWrite({
      setBusy: (busy) => {
        if (busy) setSaveStatus("saving");
      },
      showToast,
      url: agentFileUrl(editor.profileId, editor.fileKey),
      method: "PUT",
      body: { content: editor.content, backup: true },
      successMessage: `${editor.fileName} saved`,
      errorMessage: "Failed to save file",
      onSuccess: async () => {
        setEditor({ ...editor, original: editor.content });
        setSaveStatus("saved");
        if (saveResetTimerRef.current) {
          clearTimeout(saveResetTimerRef.current);
        }
        saveResetTimerRef.current = setTimeout(() => {
          saveResetTimerRef.current = null;
          setSaveStatus("idle");
        }, 2000);
        await loadProfiles();
      },
      onError: () => setSaveStatus("error"),
    });
  };

  const doSelectProfile = (profile: AgentProfile) => {
    setSelectedProfileId(profile.id);
    if (editor && editor.profileId !== profile.id) {
      closeEditor();
    }
  };

  const hasChanges = editor ? editor.content !== editor.original : false;

  /** Would this action throw away work the operator has not saved? */
  const wouldDiscard = (next: PendingDiscard): boolean => {
    if (!editor || !hasChanges) return false;
    if (next.kind === "close") return true;
    if (next.kind === "select") return editor.profileId !== next.profile.id;
    return editor.profileId !== next.profileId || editor.fileKey !== next.file.key;
  };

  const handleSelectProfile = (profile: AgentProfile) => {
    const next: PendingDiscard = { kind: "select", profile };
    if (wouldDiscard(next)) {
      setPendingDiscard(next);
      return;
    }
    doSelectProfile(profile);
  };

  // The header picker and the table's name cell are the same choice. The
  // picker answers a slug; the table answers a row; both go through the one
  // discard guard.
  const handleSelectProfileId = (id: string) => {
    const profile = profiles.find((p) => p.id === id);
    if (profile) handleSelectProfile(profile);
    else setSelectedProfileId(id);
  };

  const openFile = (profileId: string, file: ProfileFile) => {
    const next: PendingDiscard = { kind: "open", profileId, file };
    if (wouldDiscard(next)) {
      setPendingDiscard(next);
      return;
    }
    void doOpenFile(profileId, file);
  };

  const handleCloseEditor = () => {
    if (wouldDiscard({ kind: "close" })) {
      setPendingDiscard({ kind: "close" });
      return;
    }
    closeEditor();
  };

  const keepEditing = () => setPendingDiscard(null);

  const confirmDiscard = async () => {
    const next = pendingDiscard;
    setPendingDiscard(null);
    if (!next) return;
    if (next.kind === "select") doSelectProfile(next.profile);
    else if (next.kind === "open") await doOpenFile(next.profileId, next.file);
    else closeEditor();
  };

  const handleTabChange = (next: ProfileTab) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "identity") url.searchParams.set("tab", "identity");
    else url.searchParams.delete("tab");
    window.history.replaceState({}, "", url.pathname + url.search);
  };

  const handleSaveProfile = async ({ name, description }: { name: string; description: string }) => {
    const target = editTarget;
    if (!target || savingProfile) return;
    // The root agent is not a row in agent_profiles, so the profile route
    // refuses its slug outright; it has its own route and its own field name.
    await runWrite({
      setBusy: setSavingProfile,
      showToast,
      url: target.isDefault ? "/api/agent/root" : `/api/agent/profiles/${target.id}`,
      method: "PUT",
      body: target.isDefault ? { displayName: name, description } : { name, description },
      successMessage: target.isDefault ? `Renamed to "${name}"` : `Profile "${name}" updated`,
      errorMessage: "Failed to update profile",
      onSuccess: async () => {
        setEditTarget(null);
        // A rename moves the slug, so the id on screen is about to stop
        // existing. Follow it rather than letting the selection fall back to
        // the first profile in the list.
        if (!target.isDefault) setSelectedProfileId(slugifyDisplayName(name) || target.id);
        await loadProfiles();
      },
    });
  };
  const selectedProfile = profiles.find((p) => p.id === selectedProfileId) ?? null;
  // The file open in the editor FOR THE SELECTED PROFILE, or null.
  const openFileKey =
    editor && selectedProfile && editor.profileId === selectedProfile.id ? editor.fileKey : null;

  // Identity IS the SOUL.md editor. The page it replaced opened the file for
  // you; arriving on this tab and being asked to go and find it in a list
  // would have been a worse product, not a smaller one (decision 11, T-0103).
  // The ref keeps the effect's deps to the two facts that should retrigger it,
  // rather than to a handler that changes identity on every keystroke.
  const openFileRef = useRef(openFile);
  openFileRef.current = openFile;
  const autoOpenedRef = useRef<string | null>(null);
  useEffect(() => {
    if (tab !== "identity" || !selectedProfile) {
      if (tab !== "identity") autoOpenedRef.current = null;
      return;
    }
    const key = `${selectedProfile.id}:soul`;
    if (autoOpenedRef.current === key) return;
    const soul = selectedProfile.files.find((f) => f.key === "soul");
    if (!soul) return;
    autoOpenedRef.current = key;
    openFileRef.current(selectedProfile.id, soul);
  }, [tab, selectedProfile]);

  const header = (
    <PageHeader
      icon={Users}
      subtitle={loading ? "Loading profiles…" : `${profiles.length} profile${pluralise(profiles.length)}`}
      color="purple"
      actions={
        <>
          <ProfilePicker value={selectedProfileId} onChange={handleSelectProfileId} />
          <Button variant="primary" color="purple" icon={Plus} onClick={openCreate}>
            New Profile
          </Button>
        </>
      }
    />
  );

  if (loading) {
    return (
      <AppPageShell header={header}>
        <LastResult result={lastResult} />
        {toastElement}
        <PageLoading label="Loading profiles" rows={4} />
      </AppPageShell>
    );
  }

  return (
    <AppPageShell header={header}>
      {toastElement}
      <LastResult result={lastResult} />

      {/* Without an agent installed, this page is a wall of "drift" and
          "missing" against a disk that was never there. Name the cause before
          the alarms. */}
      <AgentSetupNotice what="Pushing and pulling profiles" />

      <div>
        {/* The read contract (T-0096, D22): a failed profiles read is this,
            with a Retry, and the list under it is not an empty install. */}
        {loadError && <LoadErrorBanner error={loadError} onRetry={() => void loadProfiles()} />}
        <AgentProfilesOverview
          profiles={profiles}
          syncBusy={syncBusy}
          onPushAll={handlePushAll}
          onPullAll={handlePullAll}
          onImportDiscovered={handleImportDiscovered}
        />
      </div>

      <AgentProfilesTable
        profiles={profiles}
        selectedProfileId={selectedProfileId}
        onSelect={handleSelectProfile}
        onPushOne={handlePushOne}
        onPullOne={handlePullOne}
        busy={syncBusy}
      />

      <div className="flex min-h-[520px] flex-col">
        <AgentProfileDetail
          profile={selectedProfile}
          onEdit={setEditTarget}
          onDelete={setDeleteTarget}
          tab={tab}
          onTabChange={handleTabChange}
          pendingDiscard={
            pendingDiscard && editor
              ? { fileName: editor.fileName, onDiscard: () => void confirmDiscard(), onKeep: keepEditing }
              : null
          }
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
          onCloseEditor={handleCloseEditor}
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

      <EditProfileModal
        open={editTarget !== null}
        profile={editTarget}
        saving={savingProfile}
        onClose={() => setEditTarget(null)}
        onSave={(values) => void handleSaveProfile(values)}
      />

      <DeleteProfileModal
        open={deleteTarget !== null}
        deleting={deleting}
        onClose={closeDelete}
        onDelete={handleDelete}
      />
    </AppPageShell>
  );
}
