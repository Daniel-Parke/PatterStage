// ═══════════════════════════════════════════════════════════════
// AgentProfileDetail — the right-hand column for the selected profile
//
// Extracted verbatim from app/operations/agents/page.tsx. It composes
// the identity header, the behaviour-file list and the file editor, and
// renders the "Select a profile" placeholder when nothing is selected.
// Presentation only: every callback goes back to the page.
// ═══════════════════════════════════════════════════════════════

"use client";

import AgentProfileHeader from "@/components/agents/AgentProfileHeader";
import AgentProfileFiles from "@/components/agents/AgentProfileFiles";
import AgentFileEditor, {
  type EditorState,
  type SaveStatus,
} from "@/components/agents/AgentFileEditor";
import type { AgentProfile, ProfileFile } from "@/types/console";

export interface AgentProfileDetailProps {
  profile: AgentProfile | null;
  onDelete: (profileId: string) => void;
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
  onDelete,
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
          <AgentProfileHeader profile={profile} onDelete={onDelete} />

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
