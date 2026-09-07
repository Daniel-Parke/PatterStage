"use client";

import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/field";
import type { FallbackChainEntry } from "@/types/console";

interface FallbackUrlEditModalProps {
  entry: FallbackChainEntry | null;
  url: string;
  saving: boolean;
  onUrlChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void | Promise<void>;
}

/**
 * The override base URL for one fallback entry.
 *
 * Was a hand-rolled overlay: its own backdrop, panel, header and footer,
 * and two raw buttons. It is a Dialog now (T-0125), which is where the
 * contract it already kept - Escape, the Tab trap, focus returned (T-0096,
 * D116) - has always lived.
 */
export default function FallbackUrlEditModal({
  entry,
  url,
  saving,
  onUrlChange,
  onClose,
  onSave,
}: FallbackUrlEditModalProps) {
  return (
    <Dialog
      open={entry !== null}
      onClose={onClose}
      title={entry ? `Edit override base URL: ${entry.modelName}` : "Edit override base URL"}
      size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" color="purple" size="sm" loading={saving} onClick={() => void onSave()}>
            Save
          </Button>
        </>
      }
    >
      <Field label="Override base URL" hint="Leave empty to use the model's default base URL" htmlFor="fallback-url-edit-input">
        <Input
          id="fallback-url-edit-input"
          type="text"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://api.openai.com/v1"
          className="font-mono"
          autoFocus
        />
      </Field>
    </Dialog>
  );
}
