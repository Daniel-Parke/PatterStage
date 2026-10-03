// ═══════════════════════════════════════════════════════════════
// Hindsight Modals — Add/Edit modals for memories, directives, mental models
// ═══════════════════════════════════════════════════════════════

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { HINDSIGHT_TEXT_INPUT_CLASS, HINDSIGHT_TEXTAREA_CLASS } from "./utils";

// ── Add Memory Modal ───────────────────────────────────────────

interface AddMemoryModalProps {
  open: boolean;
  onClose: () => void;
  content: string;
  tags: string;
  adding: boolean;
  onContentChange: (v: string) => void;
  onTagsChange: (v: string) => void;
  onSave: () => void;
}

export function AddMemoryModal({
  open, onClose, content, tags, adding,
  onContentChange, onTagsChange, onSave,
}: AddMemoryModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Store New Memory" size="md">
      <div className="space-y-4">
        <div>
          <label htmlFor="memory-content" className="block text-body text-ps-text-muted mb-1">Memory content</label>
          <textarea
            id="memory-content"
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            placeholder="What should the agent remember?"
            className={`w-full h-32 ${HINDSIGHT_TEXTAREA_CLASS}`}
          />
        </div>
        <div>
          <label htmlFor="memory-tags" className="block text-body text-ps-text-muted mb-1">Tags (comma-separated)</label>
          <input
            id="memory-tags"
            type="text"
            value={tags}
            onChange={(e) => onTagsChange(e.target.value)}
            placeholder="e.g. user_pref, project, tech"
            className={HINDSIGHT_TEXT_INPUT_CLASS}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" color="pink" size="sm" onClick={onSave} disabled={adding || !content.trim()}>
            {adding ? "Storing..." : "Store Memory"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Create/Edit Directive Modal ────────────────────────────────

interface DirectiveModalProps {
  open: boolean;
  onClose: () => void;
  isEdit: boolean;
  name: string;
  content: string;
  priority: string;
  tags: string;
  saving: boolean;
  onNameChange: (v: string) => void;
  onContentChange: (v: string) => void;
  onPriorityChange: (v: string) => void;
  onTagsChange: (v: string) => void;
  onSave: () => void;
}

export function DirectiveModal({
  open, onClose, isEdit, name, content, priority, tags, saving,
  onNameChange, onContentChange, onPriorityChange, onTagsChange, onSave,
}: DirectiveModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Directive" : "Create Directive"} size="md">
      <div className="space-y-4">
        <div>
          <label htmlFor="directive-name" className="block text-body text-ps-text-muted mb-1">Directive name</label>
          <input
            id="directive-name"
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Always cite sources"
            className={HINDSIGHT_TEXT_INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="directive-content" className="block text-body text-ps-text-muted mb-1">Directive content</label>
          <textarea
            id="directive-content"
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            placeholder="The rule to inject into agent prompts..."
            className={`w-full h-28 ${HINDSIGHT_TEXTAREA_CLASS}`}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="directive-priority" className="block text-body text-ps-text-muted mb-1">Priority</label>
            <input
              id="directive-priority"
              type="number"
              value={priority}
              onChange={(e) => onPriorityChange(e.target.value)}
              placeholder="0"
              className={HINDSIGHT_TEXT_INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="directive-tags" className="block text-body text-ps-text-muted mb-1">Tags (comma-separated)</label>
            <input
              id="directive-tags"
              type="text"
              value={tags}
              onChange={(e) => onTagsChange(e.target.value)}
              placeholder="e.g. safety, behavior"
              className={HINDSIGHT_TEXT_INPUT_CLASS}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary" color="pink" size="sm" onClick={onSave}
            disabled={saving || !name.trim() || !content.trim()}
          >
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Directive"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Create/Edit Mental Model Modal ─────────────────────────────

interface MentalModelModalProps {
  open: boolean;
  onClose: () => void;
  isEdit: boolean;
  name: string;
  query: string;
  tags: string;
  saving: boolean;
  onNameChange: (v: string) => void;
  onQueryChange: (v: string) => void;
  onTagsChange: (v: string) => void;
  onSave: () => void;
}

export function MentalModelModal({
  open, onClose, isEdit, name, query, tags, saving,
  onNameChange, onQueryChange, onTagsChange, onSave,
}: MentalModelModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Mental Model" : "Create Mental Model"} size="md">
      <div className="space-y-4">
        <div>
          <label htmlFor="mental-model-name" className="block text-body text-ps-text-muted mb-1">Model name</label>
          <input
            id="mental-model-name"
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. User Communication Style"
            className={HINDSIGHT_TEXT_INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="mental-model-query" className="block text-body text-ps-text-muted mb-1">Source query</label>
          <textarea
            id="mental-model-query"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="e.g. What are Daniel's communication preferences and working style?"
            className={`w-full h-28 ${HINDSIGHT_TEXTAREA_CLASS}`}
          />
          <p className="text-body text-ps-text-muted mt-1">
            {isEdit
              ? "Changing the query won't re-generate content. Use Refresh to re-run reflect."
              : "Hindsight will run reflect with this query to generate the model content."}
          </p>
        </div>
        <div>
          <label htmlFor="mental-model-tags" className="block text-body text-ps-text-muted mb-1">Tags (comma-separated)</label>
          <input
            id="mental-model-tags"
            type="text"
            value={tags}
            onChange={(e) => onTagsChange(e.target.value)}
            placeholder="e.g. user, preferences"
            className={HINDSIGHT_TEXT_INPUT_CLASS}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary" color="pink" size="sm" onClick={onSave}
            disabled={saving || !name.trim() || (!isEdit && !query.trim())}
          >
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Mental Model"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}