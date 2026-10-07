// ═══════════════════════════════════════════════════════════════
// BranchDropdown — branch picker anchored above the sidebar footer buttons.
// Inline dropdown (not a modal overlay); closes on outside click.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import IconButton from "@/components/ui/IconButton";
import { Field, Input, Select } from "@/components/ui/field";
import { sanitizeGitBranch } from "@/lib/git/git-branch";

export function BranchDropdown({
  branches,
  defaultBranch,
  onConfirm,
  onCancel,
  loading,
}: {
  branches: string[];
  defaultBranch: string;
  onConfirm: (branch: string) => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  const [selected, setSelected] = useState(defaultBranch);
  const [customBranch, setCustomBranch] = useState("");

  // Close on outside click
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCancel();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onCancel]);

  return (
    <div ref={ref} className="absolute bottom-full left-0 right-0 mb-1 z-dropdown">
      <Card padding="none" className="overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-ps-edge-hairline">
          <span className="text-micro font-mono text-ps-text-muted">Branch</span>
          <IconButton icon={X} label="Close branch picker" size="sm" onClick={onCancel} />
        </div>

        {/* Body */}
        <div className="p-2 space-y-2">
          <Select
            ariaLabel="Branch"
            value={selected}
            onChange={setSelected}
            options={branches.map((b) => ({ value: b, label: b }))}
          />
          <Field label="Other branch">
            <Input
              type="text"
              value={customBranch}
              onChange={(e) => setCustomBranch(e.target.value)}
              placeholder="e.g. feature/my-branch"
              aria-label="Other branch name"
            />
          </Field>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-2 pb-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onConfirm(customBranch.trim() ? sanitizeGitBranch(customBranch) : selected)}
            disabled={loading || (!customBranch.trim() && !selected)}
          >
            {loading ? "..." : "Confirm"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
