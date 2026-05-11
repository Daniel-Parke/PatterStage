// ═══════════════════════════════════════════════════════════════
// FallbackChainList — ordered fallback chain management
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, Plus, Edit3, Trash2, ChevronDown as ChevronDownIcon } from "lucide-react";
import type { FallbackChainEntry } from "@/types/hermes";

interface FallbackChainListProps {
  chain: FallbackChainEntry[];
  models: Array<{ id: string; name: string; provider: string; modelId: string }>;
  onReorder: (entryId: string, direction: "up" | "down") => void;
  onToggle: (entryId: string, enabled: boolean) => void;
  onDelete: (entryId: string) => void;
  onEdit: (entry: FallbackChainEntry) => void;
  onAddFromRegistry: (modelId: string) => void;
  onAddCustom: (modelId: string, provider: string, modelIdString: string, baseUrl?: string) => void;
  disabled?: boolean;
}

interface AddCustomFormProps {
  onConfirm: (modelId: string, provider: string, modelIdString: string, baseUrl?: string) => void;
  onCancel: () => void;
}

function AddCustomForm({ onConfirm, onCancel }: AddCustomFormProps) {
  const [modelId, setModelId] = useState("");
  const [provider, setProvider] = useState("");
  const [modelIdString, setModelIdString] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (modelId && provider && modelIdString) {
      onConfirm(modelId, provider, modelIdString, baseUrl || undefined);
    }
  };

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="p-3 bg-white/5 rounded-lg space-y-2"
    >
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-mono text-white/40 uppercase mb-0.5">
            Name
          </label>
          <input
            type="text"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            placeholder="My Custom Model"
            className="w-full h-8 bg-dark-800 border border-white/10 rounded px-2 text-xs text-white font-mono outline-none focus:border-neon-purple/50"
            required
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono text-white/40 uppercase mb-0.5">
            Provider
          </label>
          <input
            type="text"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            placeholder="openai"
            className="w-full h-8 bg-dark-800 border border-white/10 rounded px-2 text-xs text-white font-mono outline-none focus:border-neon-purple/50"
            required
          />
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-mono text-white/40 uppercase mb-0.5">
          Model ID
        </label>
        <input
          type="text"
          value={modelIdString}
          onChange={(e) => setModelIdString(e.target.value)}
          placeholder="gpt-4o"
          className="w-full h-8 bg-dark-800 border border-white/10 rounded px-2 text-xs text-white font-mono outline-none focus:border-neon-purple/50"
          required
        />
      </div>
      <div>
        <label className="block text-[10px] font-mono text-white/40 uppercase mb-0.5">
          Base URL (optional)
        </label>
        <input
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.openai.com/v1"
          className="w-full h-8 bg-dark-800 border border-white/10 rounded px-2 text-xs text-white font-mono outline-none focus:border-neon-purple/50"
        />
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1 text-xs font-mono text-white/50 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-3 py-1 text-xs font-mono bg-neon-purple/20 text-neon-purple rounded-lg hover:bg-neon-purple/30 transition-colors"
        >
          Add
        </button>
      </div>
    </form>
  );
}

export default function FallbackChainList({
  chain,
  models,
  onReorder,
  onToggle,
  onDelete,
  onEdit,
  onAddFromRegistry,
  onAddCustom,
  disabled = false,
}: FallbackChainListProps) {
  const [showRegistryDropdown, setShowRegistryDropdown] = useState(false);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteClick = (id: string) => {
    if (deletingId === id) {
      onDelete(id);
      setDeletingId(null);
    } else {
      setDeletingId(id);
      setTimeout(() => setDeletingId((curr) => (curr === id ? null : curr)), 3000);
    }
  };

  const handleAddFromRegistry = (modelId: string) => {
    onAddFromRegistry(modelId);
    setShowRegistryDropdown(false);
  };

  const sortedChain = [...chain].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-2">
      {sortedChain.length === 0 && !showAddCustom ? (
        <div className="text-center py-6 text-xs text-white/30 font-mono">
          No fallback models configured
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-dark-900/30 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-mono uppercase tracking-widest text-white/40 border-b border-white/5">
                <th className="px-3 py-2 w-10">#</th>
                <th className="px-3 py-2">Model</th>
                <th className="px-3 py-2 w-16 text-center">Enabled</th>
                <th className="px-3 py-2 w-28 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedChain.map((entry, index) => (
                <tr
                  key={entry.id}
                  className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
                >
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-mono bg-white/10 text-white/50 rounded">
                      {index + 1}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-mono text-white truncate max-w-[200px]">
                      {entry.modelName}
                    </div>
                    <div className="text-[10px] font-mono text-white/30 truncate max-w-[200px]">
                      {entry.provider} / {entry.modelIdString}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => onToggle(entry.id, !entry.enabled)}
                      disabled={disabled}
                      className={`w-9 h-5 rounded-full transition-colors relative ${
                        entry.enabled
                          ? "bg-neon-purple/30"
                          : "bg-white/10"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                          entry.enabled
                            ? "left-4 bg-neon-purple"
                            : "left-0.5 bg-white/30"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {/* Reorder buttons */}
                      <button
                        type="button"
                        onClick={() => onReorder(entry.id, "up")}
                        disabled={disabled || index === 0}
                        title="Move up"
                        className="p-1 rounded text-white/30 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onReorder(entry.id, "down")}
                        disabled={disabled || index === sortedChain.length - 1}
                        title="Move down"
                        className="p-1 rounded text-white/30 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      {/* Edit */}
                      <button
                        type="button"
                        onClick={() => onEdit(entry)}
                        disabled={disabled}
                        title="Edit"
                        className="p-1 rounded text-white/30 hover:text-neon-purple hover:bg-neon-purple/10 transition-colors disabled:opacity-50"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(entry.id)}
                        disabled={disabled}
                        title={deletingId === entry.id ? "Click again to confirm" : "Delete"}
                        className={`p-1 rounded transition-colors disabled:opacity-50 ${
                          deletingId === entry.id
                            ? "text-red-400 bg-red-500/10"
                            : "text-white/30 hover:text-red-400 hover:bg-red-500/10"
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Custom inline form */}
      {showAddCustom && (
        <AddCustomForm
          onConfirm={(modelId, provider, modelIdString, baseUrl) => {
            onAddCustom(modelId, provider, modelIdString, baseUrl);
            setShowAddCustom(false);
          }}
          onCancel={() => setShowAddCustom(false)}
        />
      )}

      {/* Add buttons */}
      <div className="flex items-center gap-2 pt-1">
        {/* Add from Registry dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowRegistryDropdown((v) => !v)}
            disabled={disabled || models.length === 0}
            className="flex items-center gap-1.5 px-3 h-8 text-xs font-mono text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" />
            Add from Registry
            <ChevronDownIcon className="w-3 h-3" />
          </button>
          {showRegistryDropdown && (
            <div className="absolute top-full left-0 mt-1 z-10 w-56 bg-dark-800 border border-white/10 rounded-lg shadow-xl overflow-hidden">
              {models.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => void handleAddFromRegistry(m.id)}
                  className="w-full px-3 py-2 text-left hover:bg-white/5 transition-colors"
                >
                  <div className="text-xs font-mono text-white truncate">
                    {m.name}
                  </div>
                  <div className="text-[10px] font-mono text-white/30 truncate">
                    {m.provider} / {m.modelId}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Add Custom button */}
        <button
          type="button"
          onClick={() => setShowAddCustom(true)}
          disabled={disabled}
          className="flex items-center gap-1.5 px-3 h-8 text-xs font-mono text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Custom
        </button>
      </div>
    </div>
  );
}