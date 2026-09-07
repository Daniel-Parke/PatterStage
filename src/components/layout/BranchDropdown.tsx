// ═══════════════════════════════════════════════════════════════
// BranchDropdown — branch picker anchored above the sidebar footer buttons.
// Inline dropdown (not a modal overlay); closes on outside click.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";

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
    <div
      ref={ref}
      className="absolute bottom-full left-0 right-0 mb-1 rounded-ps-md border border-ps-edge-hairline bg-ps-surface-ground shadow-xl overflow-hidden z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-ps-edge-hairline">
        <span className="text-micro font-mono text-ps-text-muted">Branch</span>
        <button
          type="button"
          aria-label="Close branch picker"
          onClick={onCancel}
          className="p-0.5 rounded-ps-sm text-ps-text-muted hover:text-ps-text-secondary transition-colors"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Body */}
      <div className="p-2">
        <select aria-label="Branch"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full px-2 py-1.5 rounded-ps-md bg-ps-surface-panel border border-ps-edge text-ps-text-primary text-body"
        >
          {branches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <label className="block mt-2 text-micro font-mono text-ps-text-muted uppercase tracking-wide">
          Other branch
        </label>
        <input
          type="text"
          value={customBranch}
          onChange={(e) => setCustomBranch(e.target.value)}
          placeholder="e.g. feature/my-branch" aria-label="Other branch name"
          className="w-full mt-0.5 px-2 py-1.5 rounded-ps-md bg-ps-surface-panel border border-ps-edge text-ps-text-primary text-body placeholder:text-ps-text-faint"
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 px-2 pb-2">
        <button
          onClick={onCancel}
          disabled={loading}
          className="px-3 py-1 rounded-ps-sm text-body text-ps-text-muted hover:text-ps-text-secondary transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={() =>
            onConfirm(customBranch.trim() ? sanitizeGitBranch(customBranch) : selected)
          }
          disabled={loading || (!customBranch.trim() && !selected)}
          className="px-3 py-1 rounded-ps-sm text-body font-medium bg-neon-cyan text-dark-900 hover:brightness-110 transition disabled:opacity-50"
        >
          {loading ? "..." : "Confirm"}
        </button>
      </div>
    </div>
  );
}
