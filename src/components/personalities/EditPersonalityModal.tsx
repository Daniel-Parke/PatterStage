// ═══════════════════════════════════════════════════════════════
// EditPersonalityModal — edit a profile's SOUL.md prompt
//
// Extracted verbatim from app/operations/personalities/page.tsx. The
// profile name is read-only here: a personality IS a profile, so new
// ones are created on the Agents page.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import { AlertCircle, Check, Edit3, Loader2, Plus } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { apiFetch, setErrorFromCaught } from "@/lib/api-fetch";
import type { Personality } from "@/components/personalities/PersonalityCard";

export default function EditPersonalityModal({
  personality,
  onClose,
  onSaved,
}: {
  personality: Personality | null; // null = create mode
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name] = useState(personality?.name || "");
  const [prompt, setPrompt] = useState(personality?.prompt || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = personality !== null;

  const handleSubmit = async () => {
    if (!name.trim() || !prompt.trim()) {
      setError("Name and prompt are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/personalities", {
        method: isEdit ? "PUT" : "POST",
        body: JSON.stringify({ profile: name.trim(), prompt: prompt.trim() }),
      });
      onSaved();
    } catch (err) {
      setErrorFromCaught(setError, err, "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `Edit: ${personality.name}` : "New Personality"}
      icon={isEdit ? Edit3 : Plus}
      iconColor="text-neon-purple"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            color="purple"
            onClick={handleSubmit}
            loading={saving}
            icon={saving ? Loader2 : Check}
          >
            {isEdit ? "Save Changes" : "Create"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-ps-text-secondary">Agent Profile</label>
          <input aria-label="Agent profile"
            type="text"
            value={name}
            readOnly
            className="w-full bg-dark-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-ps-text-secondary outline-none focus:border-white/20 font-mono opacity-70 cursor-not-allowed"
          />
          <p className="text-xs text-ps-text-muted font-mono">
            The profile whose SOUL.md voice this is — create profiles on the Agents page
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-ps-text-secondary">System Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={6}
            placeholder="You are a helpful assistant who..." aria-label="System prompt"
            className="w-full bg-dark-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-neon-purple/50 transition-colors font-mono resize-y"
          />
          <p className="text-xs text-ps-text-muted font-mono">
            {prompt.length} characters — this prompt is prepended to the agent&apos;s system prompt
          </p>
        </div>

        {/* Live preview */}
        {prompt.trim() && (
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-ps-text-muted uppercase tracking-widest">
              Preview
            </label>
            <div className="bg-dark-800/50 border border-white/5 rounded-lg p-3 text-sm text-ps-text-secondary font-mono max-h-40 overflow-y-auto whitespace-pre-wrap">
              {prompt}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
