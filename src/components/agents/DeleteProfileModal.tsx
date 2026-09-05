// ═══════════════════════════════════════════════════════════════
// DeleteProfileModal — confirm deleting a profile and its files
//
// Extracted verbatim from app/operations/agents/page.tsx.
// ═══════════════════════════════════════════════════════════════

"use client";

import { Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

export default function DeleteProfileModal({
  open,
  deleting,
  onClose,
  onDelete,
}: {
  open: boolean;
  deleting: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Delete Profile"
      icon={Trash2}
      iconColor="text-red-400"
      size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            color="orange"
            size="sm"
            icon={Trash2}
            onClick={onDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ps-text-secondary">
        This will permanently delete the profile and all its files. This action cannot be undone.
      </p>
    </Modal>
  );
}
