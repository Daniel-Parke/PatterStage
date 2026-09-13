"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronUp, File, Folder, FolderOpen } from "lucide-react";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { useApiResource } from "@/hooks/useApiResource";

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

interface Listing {
  path: string;
  parent: string | null;
  entries: Entry[];
}

export default function DirectoryPickerModal({
  open,
  onClose,
  onSelect,
}: DirectoryPickerModalProps) {
  // The folder asked for; null is the root the server chooses. The listing
  // is a read keyed on it (T-0129), so going up and back down is a cache hit.
  const [requested, setRequested] = useState<string | null>(null);
  const q = requested && requested.length > 0 ? "?path=" + encodeURIComponent(requested) : "";
  const listing = useApiResource<Listing>("/api/fs/list" + q, {
    select: (p) => (p as Listing | null) ?? undefined,
    errorMessage: "Failed to list",
    enabled: open,
    staleTime: 10_000,
  });
  const path = listing.data?.path ?? "";
  const parent = listing.data?.parent ?? null;
  const entries = listing.data?.entries ?? [];
  const loading = listing.isLoading || listing.isFetching;
  const error = listing.error;
  const loadPath = useCallback((next: string | null) => setRequested(next), []);

  useEffect(() => {
    if (open) setRequested(null);
  }, [open]);

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
          <div className="text-micro font-mono text-ps-text-muted truncate flex-1" title={path}>
            {path || "…"}
          </div>
        </div>
        {error && (
          <LoadErrorBanner compact error={error} onRetry={() => void listing.refetch()} />
        )}
        <Card padding="none" className="max-h-72 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-micro text-ps-text-muted font-mono">Loading…</div>
          ) : (
            <ul className="divide-y divide-ps-edge-hairline">
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
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-micro font-mono transition-colors ${
                      e.isDir
                        ? "hover:bg-ps-surface-raised text-ps-text-primary"
                        : "text-ps-text-faint cursor-not-allowed"
                    }`}
                  >
                    {e.isDir ? (
                      <Folder className="w-3.5 h-3.5 text-neon-cyan flex-shrink-0" />
                    ) : (
                      <File className="w-3.5 h-3.5 text-ps-viz-glyph-idle flex-shrink-0" />
                    )}
                    <span className="truncate">{e.name}</span>
                  </button>
                </li>
              ))}
              {entries.length === 0 && !loading && (
                <li className="px-3 py-4 text-micro text-ps-text-muted font-mono text-center">
                  Empty folder
                </li>
              )}
            </ul>
          )}
        </Card>
      </div>
    </Modal>
  );
}
