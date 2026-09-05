"use client";

// ═══════════════════════════════════════════════════════════════
// CredentialsPanel — the credentials an operator has, and the door out
//
// Credentials could be CREATED and never removed. They were visible in this
// page only as a count in the subtitle and as options in the model editor's
// dropdown, so a key added by mistake, or rotated away, stayed in the database
// and in ~/.hermes/.env forever (QA finding 17, operator ruling 3).
//
// TWO-STEP, never a modal. `useTwoStepConfirm` is the house pattern for a
// destructive row action, and this is the case it was built for: the click is
// cheap, the consequence is not, and the second click is the whole safeguard.
//
// The KEY is never shown, only the hint the API returns. That is the same rule
// the list endpoint keeps, and this component must not be the place it lapses:
// the rotate input below is write-only, is a password field, and is unmounted
// the moment its value has been handed over.
//
// ROTATE is the second door (T-0100, D14). Before it, replacing a key that had
// leaked or expired meant deleting the credential and adding it again, which
// unlinked every model pointing at it.
// ═══════════════════════════════════════════════════════════════

import { useState } from "react";

import { KeyRound, Trash2, Check } from "lucide-react";

import { Input } from "@/components/ui/field";
import ConceptHint from "@/components/help/ConceptHint";
import { useTwoStepConfirm } from "@/hooks/useTwoStepConfirm";
import type { ApiCredential } from "./types";

export interface CredentialsPanelProps {
  credentials: ApiCredential[];
  onDelete: (credential: ApiCredential) => void;
  onRotate: (credential: ApiCredential, apiKey: string) => void | Promise<void>;
  busyId: string | null;
}

export default function CredentialsPanel({
  credentials,
  onDelete,
  onRotate,
  busyId,
}: CredentialsPanelProps) {
  const confirm = useTwoStepConfirm();
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");

  const closeRotate = () => {
    setRotatingId(null);
    setNewKey("");
  };

  if (credentials.length === 0) return null;

  return (
    <section className="mb-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-ps-text-muted" />
        {/* "Credentials" is this screen's word for the thing the corpus calls
            an API key, and this card is where it is met. */}
        <h2 className="font-mono text-xs uppercase tracking-widest text-ps-text-muted">
          <ConceptHint id="api-key">Credentials</ConceptHint>
        </h2>
      </div>

      <ul className="space-y-1">
        {credentials.map((c) => {
          const armed = confirm.isArmedFor(c.id);
          const busy = busyId === c.id;
          const rotating = rotatingId === c.id;
          return (
            <li key={c.id} className="rounded-lg px-3 py-2 hover:bg-white/[0.03]">
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-sm text-ps-text-secondary">
                  {c.label}
                </span>
                <span className="font-mono text-xs text-ps-text-muted">{c.provider}</span>
                {/* The hint, never the key. */}
                <span className="font-mono text-xs text-ps-text-faint">{c.keyHint}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => (rotating ? closeRotate() : setRotatingId(c.id))}
                  aria-label={`Rotate key for ${c.label}`}
                  className="rounded-lg px-2 py-1 font-mono text-xs text-ps-text-muted transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
                >
                  Rotate key
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => (armed ? onDelete(c) : confirm.arm(c.id))}
                  aria-label={
                    armed ? `Confirm delete credential ${c.label}` : `Delete credential ${c.label}`
                  }
                  title={armed ? "Click again to confirm" : "Delete credential"}
                  className={`rounded-lg p-1.5 transition-colors disabled:opacity-50 ${
                    armed
                      ? "bg-neon-red/20 text-neon-red"
                      : "text-ps-text-muted hover:bg-neon-red/20 hover:text-neon-red"
                  }`}
                >
                  {armed ? <Check className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>

              {rotating && (
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    type="password"
                    autoComplete="off"
                    aria-label={`New API key for ${c.label}`}
                    placeholder="Paste the replacement key"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    className="font-mono"
                  />
                  <button
                    type="button"
                    disabled={busy || newKey.trim().length === 0}
                    aria-label={`Save new key for ${c.label}`}
                    onClick={() => {
                      const key = newKey.trim();
                      // Cleared before the call, not after: the value has been
                      // handed over, and the only copy left should be the one
                      // travelling to the route.
                      closeRotate();
                      void onRotate(c, key);
                    }}
                    className="shrink-0 rounded-lg bg-neon-cyan/20 px-2.5 py-1.5 font-mono text-xs text-neon-cyan transition-colors hover:bg-neon-cyan/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Save new key
                  </button>
                  <button
                    type="button"
                    aria-label={`Cancel rotating ${c.label}`}
                    onClick={closeRotate}
                    className="shrink-0 rounded-lg px-2.5 py-1.5 font-mono text-xs text-ps-text-muted transition-colors hover:bg-white/5 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
