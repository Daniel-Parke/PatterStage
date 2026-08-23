"use client";

import type { FallbackChainEntry } from "@/types/console";

interface FallbackUrlEditModalProps {
  entry: FallbackChainEntry | null;
  url: string;
  saving: boolean;
  onUrlChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void | Promise<void>;
}

export default function FallbackUrlEditModal({
  entry,
  url,
  saving,
  onUrlChange,
  onClose,
  onSave,
}: FallbackUrlEditModalProps) {
  if (!entry) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md bg-dark-900 border border-white/10 rounded-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fallback-url-edit-title"
      >
        <div className="px-4 py-3 border-b border-white/10">
          <h3 id="fallback-url-edit-title" className="text-sm font-semibold text-white">
            Edit override Base URL: {entry.modelName}
          </h3>
        </div>
        <div className="p-4">
          <label className="block text-xs font-mono text-ps-text-muted uppercase mb-1.5">
            Override Base URL
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://api.openai.com/v1"
            className="w-full bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-neon-purple/50 transition-colors"
            autoFocus
          />
          <p className="text-xs text-ps-text-muted font-mono mt-1.5">
            Leave empty to use the model&apos;s default base URL
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-mono text-ps-text-muted hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-mono bg-neon-purple/20 text-neon-purple rounded-lg hover:bg-neon-purple/30 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
