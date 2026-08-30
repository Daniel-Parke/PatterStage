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
      className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border border-white/10 bg-dark-950 shadow-xl overflow-hidden z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-xs font-mono text-ps-text-muted">Branch</span>
        <button
          type="button"
          aria-label="Close branch picker"
          onClick={onCancel}
          className="p-0.5 rounded text-ps-text-muted hover:text-ps-text-secondary transition-colors"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Body */}
      <div className="p-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full px-2 py-1.5 rounded-md bg-dark-900 border border-white/10 text-white text-xs focus:outline-none focus:border-neon-cyan/50"
        >
          {branches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <label className="block mt-2 text-xs font-mono text-ps-text-muted uppercase tracking-wide">
          Other branch
        </label>
        <input
          type="text"
          value={customBranch}
          onChange={(e) => setCustomBranch(e.target.value)}
          placeholder="e.g. feature/my-branch"
          className="w-full mt-0.5 px-2 py-1.5 rounded-md bg-dark-900 border border-white/10 text-white text-xs placeholder:text-ps-text-faint focus:outline-none focus:border-neon-cyan/50"
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 px-2 pb-2">
        <button
          onClick={onCancel}
          disabled={loading}
          className="px-3 py-1 rounded text-xs text-ps-text-muted hover:text-ps-text-secondary transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={() =>
            onConfirm(customBranch.trim() ? sanitizeGitBranch(customBranch) : selected)
          }
          disabled={loading || (!customBranch.trim() && !selected)}
          className="px-3 py-1 rounded text-xs font-medium bg-neon-cyan text-dark-900 hover:brightness-110 transition disabled:opacity-50"
        >
          {loading ? "..." : "Confirm"}
        </button>
      </div>
    </div>
  );
}
