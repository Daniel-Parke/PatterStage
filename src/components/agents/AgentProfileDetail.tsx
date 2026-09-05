// ═══════════════════════════════════════════════════════════════
// AgentProfileDetail — the right-hand column for the selected profile
//
// Extracted verbatim from app/operations/agents/page.tsx. It composes
// the identity header, the behaviour-file list and the file editor, and
// renders the "Select a profile" placeholder when nothing is selected.
// Presentation only: every callback goes back to the page.
// ═══════════════════════════════════════════════════════════════

"use client";

import Button from "@/components/ui/Button";
import AgentProfileHeader from "@/components/agents/AgentProfileHeader";
import AgentProfileFiles from "@/components/agents/AgentProfileFiles";
import AgentFileEditor, {
  type EditorState,
  type SaveStatus,
} from "@/components/agents/AgentFileEditor";
import type { AgentProfile, ProfileFile } from "@/types/console";

/** The unsaved-work prompt, when one is standing. */
interface PendingDiscardPrompt {
  fileName: string;
  onDiscard: () => void;
  onKeep: () => void;
}

export type ProfileTab = "identity" | "files";

export interface AgentProfileDetailProps {
  profile: AgentProfile | null;
  onEdit: (profile: AgentProfile) => void;
  onDelete: (profileId: string) => void;
  tab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
  pendingDiscard?: PendingDiscardPrompt | null;
  openFileKey: string | null;
  onOpenFile: (profileId: string, file: ProfileFile) => void;
  editor: EditorState | null;
  hasChanges: boolean;
  previewMode: boolean;
  saveStatus: SaveStatus;
  saving: boolean;
  onTogglePreview: () => void;
  onResetEditor: () => void;
  onEditorContentChange: (content: string) => void;
  onSaveEditor: () => void;
  onCloseEditor: () => void;
}

export default function AgentProfileDetail({
  profile,
  onEdit,
  onDelete,
  tab,
  onTabChange,
  pendingDiscard = null,
  openFileKey,
  onOpenFile,
  editor,
  hasChanges,
  previewMode,
  saveStatus,
  saving,
  onTogglePreview,
  onResetEditor,
  onEditorContentChange,
  onSaveEditor,
  onCloseEditor,
}: AgentProfileDetailProps) {
  return (
    <div className="flex-1 min-w-0 rounded-xl border border-white/10 bg-dark-900/40 flex flex-col">
      {!profile ? (
        <div className="flex-1 flex items-center justify-center text-sm text-ps-text-muted p-8">
          Select a profile
        </div>
      ) : (
        <>
          <AgentProfileHeader profile={profile} onEdit={onEdit} onDelete={onDelete} />

          {/* The work is still in the editor below; this asks before it goes. */}
          {pendingDiscard && (
            <div className="m-4 rounded-lg border border-semantic-warning/40 bg-semantic-warning/10 p-3">
              <p className="text-sm text-ps-text-primary">
                You have unsaved changes to {pendingDiscard.fileName}.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" color="orange" onClick={pendingDiscard.onDiscard}>
                  Discard changes
                </Button>
                <Button variant="primary" size="sm" color="cyan" onClick={pendingDiscard.onKeep}>
                  Keep editing
                </Button>
              </div>
            </div>
          )}

          {/* Personalities was a second page editing the same SOUL.md through a
              second route (decision 11, T-0103). It is this tab now. */}
          <div className="px-4 pt-3 flex gap-1 border-b border-white/10" role="tablist" aria-label="Profile view">
            {(["identity", "files"] as const).map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`profile-tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`profile-panel-${id}`}
                onClick={() => onTabChange(id)}
                className={`px-3 py-2 text-sm rounded-t-lg border-b-2 transition-colors ${
                  tab === id
                    ? "border-neon-purple text-white"
                    : "border-transparent text-ps-text-muted hover:text-ps-text-secondary"
                }`}
              >
                {id === "identity" ? "Identity" : "Files"}
              </button>
            ))}
          </div>

          {tab === "identity" ? (
            <div
              id="profile-panel-identity"
              role="tabpanel"
              aria-labelledby="profile-tab-identity"
              className="p-4 border-b border-white/10"
            >
              <h3 className="text-xs font-semibold text-ps-text-muted uppercase tracking-wider mb-2">
                Voice
              </h3>
              <p className="text-sm text-ps-text-secondary">
                {profile.personality?.trim()
                  ? profile.personality
                  : "No voice recorded yet. It is read from SOUL.md the next time this profile is pulled or saved."}
              </p>
              <p className="mt-3 text-xs text-ps-text-muted">
                SOUL.md below is what the agent reads. Editing it here is the same save the
                Files tab makes.
              </p>
            </div>
          ) : (
            <div id="profile-panel-files" role="tabpanel" aria-labelledby="profile-tab-files">
              <AgentProfileFiles
                files={profile.files}
                openFileKey={openFileKey}
                onOpenFile={(file) => onOpenFile(profile.id, file)}
              />
            </div>
          )}

          {editor && editor.profileId === profile.id && (
            <AgentFileEditor
              editor={editor}
              hasChanges={hasChanges}
              previewMode={previewMode}
              saveStatus={saveStatus}
              saving={saving}
              onTogglePreview={onTogglePreview}
              onReset={onResetEditor}
              onContentChange={onEditorContentChange}
              onSave={onSaveEditor}
              onClose={onCloseEditor}
            />
          )}
        </>
      )}
    </div>
  );
}
