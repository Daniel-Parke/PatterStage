"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronUp, File, Folder, FolderOpen } from "lucide-react";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { safeApiCall } from "@/lib/api-fetch";

interface Entry {
  name: string;
  isDir: boolean;
  isFile: boolean;
}

interface DirectoryPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (absolutePath: string) => void;
}

export default function DirectoryPickerModal({
  open,
  onClose,
  onSelect,
}: DirectoryPickerModalProps) {
  const [path, setPath] = useState<string>("");
  const [parent, setParent] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPath = useCallback((next: string | null) => {
    setLoading(true);
    setError(null);
    const q = next && next.length > 0 ? "?path=" + encodeURIComponent(next) : "";
    // safeApiCall returns { ok, data: <body> } where <body> is the API
    // envelope ({ data: { path, parent, entries } }). `safeApiCall<T>`
    // does NOT unwrap — `data` is the full body — so the type is the
    // envelope shape and the inner fields are read via
    // `j.data?.data?.path` / `j.data?.data?.parent` /
    // `j.data?.data?.entries` (two indirections).
    safeApiCall<{ data?: { path: string; parent: string | null; entries: Entry[] } }>(
      "/api/fs/list" + q,
    )
      .then((j) => {
        if (!j.ok) {
          setError(typeof j.error === "string" ? j.error : "Failed to list");
          return;
        }
        const payload = j.data?.data;
        if (payload) {
          setPath(payload.path);
          setParent(payload.parent);
          setEntries(payload.entries ?? []);
        }
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadPath(null);
  }, [open, loadPath]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Select folder"
      icon={FolderOpen}
      iconColor="text-neon-cyan"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            color="cyan"
            onClick={() => {
              onSelect(path);
              onClose();
            }}
            disabled={!path || loading}
          >
            Select this folder
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={!parent || loading}
            onClick={() => parent && void loadPath(parent)}
          >
            <ChevronUp className="w-4 h-4" />
            Up
          </Button>
          <div className="text-[10px] font-mono text-white/50 truncate flex-1" title={path}>
            {path || "…"}
          </div>
        </div>
        {error && (
          <div className="text-xs text-red-400 font-mono border border-red-500/30 rounded-lg px-2 py-1.5">
            {error}
          </div>
        )}
        <div className="max-h-72 overflow-y-auto rounded-lg border border-white/10 bg-dark-900/50">
          {loading ? (
            <div className="p-6 text-center text-xs text-white/40 font-mono">Loading…</div>
          ) : (
            <ul className="divide-y divide-white/5">
              {entries.map((e) => (
                <li key={e.name}>
                  <button
                    type="button"
                    disabled={!e.isDir}
                    onClick={() => {
                      if (!e.isDir) return;
                      const sep = path.endsWith("\\") || path.includes("\\") ? "\\" : "/";
                      const next =
                        path.replace(/[/\\]+$/, "") + sep + e.name;
                      void loadPath(next);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-mono transition-colors ${
                      e.isDir
                        ? "hover:bg-white/5 text-white/80"
                        : "text-white/25 cursor-not-allowed"
                    }`}
                  >
                    {e.isDir ? (
                      <Folder className="w-3.5 h-3.5 text-neon-cyan flex-shrink-0" />
                    ) : (
                      <File className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />
                    )}
                    <span className="truncate">{e.name}</span>
                  </button>
                </li>
              ))}
              {entries.length === 0 && !loading && (
                <li className="px-3 py-4 text-xs text-white/30 font-mono text-center">
                  Empty folder
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
