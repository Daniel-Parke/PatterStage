// ═══════════════════════════════════════════════════════════════
// CreateProfileModal — new agent profile, optionally cloned
//
// Extracted verbatim from app/operations/agents/page.tsx. Note the two
// different closes, which is deliberate and was deliberate before the
// split: `onClose` (X / overlay) clears the form, `onCancel` is a SOFT
// close that keeps in-flight input if the user cancels by accident.
// ═══════════════════════════════════════════════════════════════

"use client";

import { Plus } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/field";
import type { AgentProfile } from "@/types/console";

export interface CreateProfileModalProps {
  open: boolean;
  profiles: AgentProfile[];
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  cloneFrom: string;
  onCloneFromChange: (value: string) => void;
  creating: boolean;
  onClose: () => void;
  onCancel: () => void;
  onCreate: () => void;
}

export default function CreateProfileModal({
  open,
  profiles,
  name,
  onNameChange,
  description,
  onDescriptionChange,
  cloneFrom,
  onCloneFromChange,
  creating,
  onClose,
  onCancel,
  onCreate,
}: CreateProfileModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Agent Profile"
      icon={Plus}
      iconColor="text-neon-purple"
      size="md"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button
            variant="primary"
            color="purple"
            size="sm"
            icon={Plus}
            onClick={onCreate}
            disabled={!name.trim() || creating}
          >
            {creating ? "Creating..." : "Create"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <Input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Research Assistant"
          />
        </Field>
        <Field label="Description">
          <Input
            type="text"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="e.g. Academic research and analysis"
          />
        </Field>
        <Field label="Clone From">
          <Select
            ariaLabel="Clone from profile"
            value={cloneFrom}
            onChange={onCloneFromChange}
            options={[
              { value: "default", label: "Default (Bob)" },
              ...profiles.filter((p) => !p.isDefault).map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
        </Field>
      </div>
    </Modal>
  );
}
