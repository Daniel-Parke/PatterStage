"use client";

import { useState } from "react";
import { FolderOpen, Plus, Trash2 } from "lucide-react";

import type { LocalDirEntry } from "@/types/console";
import { useGitBranches } from "@/hooks/useGitBranches";

import DirectoryPickerModal from "./DirectoryPickerModal";

interface LocalDirRowProps {
  mode: "draft" | "saved";
  entry: LocalDirEntry;
  onChange: (next: LocalDirEntry) => void;
  onAdd?: () => void;
  onDelete?: () => void;
}

export default function LocalDirRow({
  mode,
  entry,
  onChange,
  onAdd,
  onDelete,
}: LocalDirRowProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const git = useGitBranches(entry.path);

  const branchValue =
    entry.branch !== undefined && entry.branch !== null && entry.branch !== ""
      ? String(entry.branch)
      : git?.current && git.branches.includes(git.current)
        ? git.current
        : "";

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex-1 min-w-[160px]">
        <input
          value={entry.path}
          onChange={(e) =>
            onChange({ ...entry, path: e.target.value, branch: entry.branch })
          }
          placeholder="~/projects/my-app/" aria-label="~/projects/my-app/"
          className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-neon-cyan/50 font-mono"
        />
      </div>
      {git?.isGitRepo && git.branches.length > 0 && (
        <select aria-label="Git branch"
          value={branchValue}
          onChange={(e) =>
            onChange({
              ...entry,
              branch: e.target.value === "" ? null : e.target.value,
            })
          }
          className="bg-dark-800/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-mono outline-none focus:border-neon-cyan/50 max-w-[140px]"
        >
          <option value="">branch</option>
          {git.branches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        title="Browse"
        onClick={() => setPickerOpen(true)}
        className="p-1.5 rounded-lg border border-white/10 text-ps-text-muted hover:text-neon-cyan hover:border-neon-cyan/30 transition-colors"
      >
        <FolderOpen className="w-4 h-4" />
      </button>
      {mode === "draft" && onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neon-cyan/10 border border-neon-cyan/30 text-xs text-neon-cyan hover:bg-neon-cyan/20 font-mono transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      )}
      {mode === "saved" && onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 rounded-lg border border-white/10 text-ps-text-muted hover:text-red-400 hover:border-red-500/30 transition-colors"
          title="Remove"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
      <DirectoryPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(abs) => onChange({ path: abs, branch: null })}
      />
    </div>
  );
}
