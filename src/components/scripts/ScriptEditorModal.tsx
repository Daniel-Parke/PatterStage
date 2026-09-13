// ═══════════════════════════════════════════════════════════════
// ScriptEditorModal — write or edit a script file
//
// The editor's state and its save/delete calls stay on the page; this
// component renders the modal and calls back. Presentation only.
// ═══════════════════════════════════════════════════════════════

"use client";

import { FileCode, Save, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import ConfirmButton from "@/components/ui/ConfirmButton";
import Modal from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/field";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export interface ScriptEditorModalProps {
  open: boolean;
  isNew: boolean;
  name: string;
  onNameChange: (name: string) => void;
  content: string;
  onContentChange: (content: string) => void;
  loading: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  /** True when this script has a schedule that the delete would take with it. */
  scheduled?: boolean;
}

export default function ScriptEditorModal({
  open,
  isNew,
  name,
  onNameChange,
  content,
  onContentChange,
  loading,
  saving,
  onClose,
  onSave,
  onDelete,
  scheduled = false,
}: ScriptEditorModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? "New script" : `Edit · ${name}`}
      icon={FileCode}
      iconColor="text-neon-cyan"
      size="xl"
      footer={
        <>
          {!isNew && (
            // Two clicks in the modal's own footer, not a native confirm over it
            // (T-0096, D51). The warning beside it is the other half: a
            // scheduled script loses its schedule with the file, and that was
            // said only in this comment (T-0107).
            <ConfirmButton
              variant="ghost"
              size="sm"
              icon={Trash2}
              onConfirm={onDelete}
              disabled={saving}
              confirmLabel="Delete for good?"
              armedClassName="text-semantic-danger bg-semantic-danger/10 ring-1 ring-semantic-danger/30"
            >
              Delete
            </ConfirmButton>
          )}
          {!isNew && scheduled && (
            <span className="ml-2 font-mono text-micro text-semantic-warning">
              Deleting the file also removes its schedule.
            </span>
          )}
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" color="cyan" size="sm" icon={Save} onClick={onSave} loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {isNew && (
          <div>
            <label htmlFor="script-filename" className="mb-1 block font-mono text-micro text-ps-text-muted">Filename</label>
            <Input
              id="script-filename"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="my-script.mjs"
              spellCheck={false}
              className="font-mono"
            />
          </div>
        )}
        {loading ? (
          <div className="py-8"><LoadingSpinner text="Loading script…" /></div>
        ) : (
          <>
            <Textarea
              aria-label="Script content"
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Tab") {
                  e.preventDefault();
                  const el = e.currentTarget;
                  const s = el.selectionStart;
                  const next = `${content.slice(0, s)}  ${content.slice(el.selectionEnd)}`;
                  onContentChange(next);
                  requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 2; });
                }
                if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                  e.preventDefault();
                  onSave();
                }
              }}
              spellCheck={false}
              rows={20}
              className="block leading-relaxed"
              style={{ tabSize: 2 }}
            />
            <div className="flex items-center justify-between font-mono text-micro text-ps-text-muted">
              <span>{content.split("\n").length} lines · {new Blob([content]).size} bytes</span>
              <span>Tab = 2 spaces · ⌘/Ctrl+S to save · runs server-side via /bin/bash</span>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
