// ── SkillEditorModal — edit one skill's markdown.
// Extracted verbatim from app/operations/skills/page.tsx. The content,
// the original snapshot and the PUT stay on the page; this renders the
// modal and calls back. Presentation only.

"use client";

import { Edit3, RotateCcw, Save } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

export interface SkillEditorModalProps {
  skillName: string | null;
  content: string;
  original: string;
  saving: boolean;
  onContentChange: (value: string) => void;
  onReset: () => void;
  onClose: () => void;
  onSave: () => void;
}

export default function SkillEditorModal({
  skillName,
  content,
  original,
  saving,
  onContentChange,
  onReset,
  onClose,
  onSave,
}: SkillEditorModalProps) {
  return (
    <Modal
      open={skillName !== null}
      onClose={onClose}
      title={skillName ? `Edit: ${skillName}` : "Edit skill"}
      icon={Edit3}
      iconColor="text-neon-green"
      size="lg"
      footer={
        <>
          <Button
            variant="ghost"
            size="sm"
            icon={RotateCcw}
            onClick={onReset}
            disabled={content === original}
          >
            Reset
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            color="green"
            size="sm"
            icon={Save}
            onClick={onSave}
            disabled={saving || content === original}
            loading={saving}
          >
            Save
          </Button>
        </>
      }
    >
      <textarea
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        className="w-full min-h-[320px] bg-dark-800 border border-white/10 rounded-lg p-4 text-sm text-ps-text-primary font-mono resize-y focus:border-neon-green/50 focus:outline-none"
        spellCheck={false}
      />
    </Modal>
  );
}
