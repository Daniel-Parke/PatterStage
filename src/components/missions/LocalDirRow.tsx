"use client";

import { useState } from "react";
import { FolderOpen, Plus, Trash2 } from "lucide-react";

import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import { InlineSelect } from "@/components/ui/Select";
import { Input } from "@/components/ui/field";
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
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex-1 min-w-[160px]">
        <Input
          value={entry.path}
          onChange={(e) =>
            onChange({ ...entry, path: e.target.value, branch: entry.branch })
          }
          placeholder="~/projects/my-app/"
          aria-label="Local directory path"
          className="font-mono"
        />
      </div>
      {git?.isGitRepo && git.branches.length > 0 && (
        <InlineSelect
          ariaLabel="Git branch"
          value={branchValue}
          onChange={(v) => onChange({ ...entry, branch: v === "" ? null : v })}
          options={[
            { value: "", label: "branch" },
            ...git.branches.map((b) => ({ value: b, label: b })),
          ]}
          className="max-w-[140px]"
        />
      )}
      <IconButton
        icon={FolderOpen}
        label="Browse"
        variant="secondary"
        onClick={() => setPickerOpen(true)}
      />
      {mode === "draft" && onAdd && (
        <Button variant="primary" color="cyan" icon={Plus} onClick={onAdd}>
          Add
        </Button>
      )}
      {mode === "saved" && onDelete && (
        <IconButton icon={Trash2} label="Remove" variant="secondary" onClick={onDelete} />
      )}
      <DirectoryPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(abs) => onChange({ path: abs, branch: null })}
      />
    </div>
  );
}
