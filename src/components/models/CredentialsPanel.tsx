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
// the list endpoint keeps, and this component must not be the place it lapses.
// ═══════════════════════════════════════════════════════════════

import { KeyRound, Trash2, Check } from "lucide-react";

import { useTwoStepConfirm } from "@/hooks/useTwoStepConfirm";
import type { ApiCredential } from "./types";

export interface CredentialsPanelProps {
  credentials: ApiCredential[];
  onDelete: (credential: ApiCredential) => void;
  busyId: string | null;
}

export default function CredentialsPanel({
  credentials,
  onDelete,
  busyId,
}: CredentialsPanelProps) {
  const confirm = useTwoStepConfirm();

  if (credentials.length === 0) return null;

  return (
    <section className="mb-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-ps-text-muted" />
        <h2 className="font-mono text-xs uppercase tracking-widest text-ps-text-muted">
          Credentials
        </h2>
      </div>

      <ul className="space-y-1">
        {credentials.map((c) => {
          const armed = confirm.isArmedFor(c.id);
          return (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/[0.03]"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-ps-text-secondary">
                {c.label}
              </span>
              <span className="font-mono text-xs text-ps-text-muted">{c.provider}</span>
              {/* The hint, never the key. */}
              <span className="font-mono text-xs text-ps-text-faint">{c.keyHint}</span>
              <button
                type="button"
                disabled={busyId === c.id}
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
            </li>
          );
        })}
      </ul>
    </section>
  );
}
