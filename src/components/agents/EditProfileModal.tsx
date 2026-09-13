// ═══════════════════════════════════════════════════════════════
// EditProfileModal — rename a profile, and say what it is for
//
// PUT /api/agent/profiles/[id] implemented a careful rename, slug move and
// all, and had no caller anywhere in the product: a profile's name and
// description could never be changed after the moment it was created
// (T-0102, D25). This is that route's control.
//
// The root agent is not a row in agent_profiles, so it goes to its own
// route with its own field name. The page decides which; this collects the
// two values and hands them back.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Field, Input } from "@/components/ui/field";
import type { AgentProfile } from "@/types/console";

export interface EditProfileModalProps {
  open: boolean;
  profile: AgentProfile | null;
  saving: boolean;
  onClose: () => void;
  onSave: (values: { name: string; description: string }) => void;
}

/** The list's cosmetic suffix is not part of the stored name. */
function editableName(profile: AgentProfile): string {
  return profile.isDefault
    ? profile.name.replace(/\s*\(local default\)\s*$/i, "")
    : profile.name;
}

export default function EditProfileModal({
  open,
  profile,
  saving,
  onClose,
  onSave,
}: EditProfileModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Re-seed whenever the dialog opens on a profile, so it always shows what
  // is stored rather than the last thing that was typed into it.
  useEffect(() => {
    if (open && profile) {
      setName(editableName(profile));
      setDescription(profile.description ?? "");
    }
  }, [open, profile]);

  return (
    <Modal
      open={open && profile !== null}
      onClose={onClose}
      title={profile?.isDefault ? "Rename this agent" : "Edit profile"}
      icon={Pencil}
      iconColor="text-neon-cyan"
      size="md"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            color="cyan"
            size="sm"
            onClick={() => onSave({ name: name.trim(), description: description.trim() })}
            disabled={!name.trim() || saving}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Research Assistant"
          />
        </Field>
        <Field label="Description">
          <Input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this agent is for"
          />
        </Field>
        {profile?.isDefault && (
          <p className="text-body text-ps-text-muted">
            This is the name PatterStage shows. Nothing is written into the agent&apos;s own
            files, so renaming it here is safe and can be undone by renaming it back.
          </p>
        )}
      </div>
    </Modal>
  );
}
