// ═══════════════════════════════════════════════════════════════
// AgentFileEditor — the preview/edit card for one behaviour file
//
// Extracted verbatim from app/operations/agents/page.tsx. The editor
// buffer, the save call and the save-status timer stay on the page;
// this renders the card and calls back. Presentation only.
// ═══════════════════════════════════════════════════════════════

"use client";

import { AlertCircle, Check, Eye, EyeOff, RotateCcw, Save } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

/** The file currently open in the editor, and the buffer being edited. */
export interface EditorState {
  profileId: string;
  fileKey: string;
  fileName: string;
  content: string;
  original: string;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface AgentFileEditorProps {
  editor: EditorState;
  hasChanges: boolean;
  previewMode: boolean;
  saveStatus: SaveStatus;
  saving: boolean;
  onTogglePreview: () => void;
  onReset: () => void;
  onContentChange: (content: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export default function AgentFileEditor({
  editor,
  hasChanges,
  previewMode,
  saveStatus,
  saving,
  onTogglePreview,
  onReset,
  onContentChange,
  onSave,
  onClose,
}: AgentFileEditorProps) {
  return (
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
            onClick={onTogglePreview}
          >
            {previewMode ? "Edit" : "Preview"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={RotateCcw}
            onClick={onReset}
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
            onClick={onSave}
            disabled={!hasChanges || saving}
          >
            {saving ? "Saving..." : saveStatus === "saved" ? "Saved!" : "Save"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
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
          onChange={(e) => onContentChange(e.target.value)}
          className="w-full min-h-[200px] max-h-64 bg-dark-800 border border-white/10 rounded-lg p-4 text-sm text-white/80 font-mono resize-y focus:border-purple-500/50 focus:outline-none"
          spellCheck={false}
        />
      )}
    </div>
  );
}
