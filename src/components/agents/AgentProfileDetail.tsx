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

export interface AgentProfileDetailProps {
  profile: AgentProfile | null;
  onEdit: (profile: AgentProfile) => void;
  onDelete: (profileId: string) => void;
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

          <AgentProfileFiles
            files={profile.files}
            openFileKey={openFileKey}
            onOpenFile={(file) => onOpenFile(profile.id, file)}
          />

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
