// ═══════════════════════════════════════════════════════════════
// MemoryProviderSettings — the one card that owns the memory connection
//
// Edit the active provider's host/port/bank and test it. The endpoint lives in
// the database (memory_providers), so it changes with no Hermes file edits;
// PUT /api/memory/config writes `memory.provider` into config.yaml afterwards
// so the agent's own file agrees rather than competing (T-0101, D64).
//
// This card is also the page's ONE voice about memory being set up. A first
// visit with nothing listening used to stack an orange "we guessed the
// endpoint" notice on top of a red "no provider is answering" banner rendered
// by the browser below it: two warnings, one fact, and the fields that fix it
// in neither of them. Now the store's health arrives here, the heading becomes
// "Set up memory", and the guess warning is kept for the case it was written
// for: something ANSWERED at an endpoint nobody confirmed, and it may not be
// yours.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Plug, XCircle } from "lucide-react";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/field";
import { safeApiCall } from "@/lib/api-fetch";

import HealthBanner from "./hindsight/HealthBanner";
import type { HealthState } from "./hindsight/types";

interface Cfg {
  host: string;
  port: number;
  bank: string;
}
interface Health {
  available: boolean;
  status?: string;
  error?: string;
}

/** The active row, as GET /api/memory/config describes it. */
interface ActiveRow {
  type: string;
  label: string;
  isActive: boolean;
  confirmed: boolean;
}

interface MemoryProviderSettingsProps {
  /** The store's health, as the browser below found it. */
  storeHealth?: HealthState | null;
  /** Called when a probe or a save finds the store answering. */
  onReconnected?: () => void;
  /** Re-probe the store from the card's own banner. */
  onRetry?: () => void;
}

const FALLBACK_ROW: ActiveRow = {
  type: "hindsight",
  label: "Hindsight",
  isActive: true,
  confirmed: true,
};

export default function MemoryProviderSettings({
  storeHealth = null,
  onReconnected,
  onRetry,
}: MemoryProviderSettingsProps) {
  const [cfg, setCfg] = useState<Cfg>({ host: "127.0.0.1", port: 9177, bank: "hermes" });
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [savedMsg, setSavedMsg] = useState("");
  // The row as loaded. Save edits THIS provider: hardcoding hindsight here is
  // how editing a port on a holographic install silently switched the whole
  // memory backend (T-0101, D65).
  const [row, setRow] = useState<ActiveRow | null>(null);
  // Save is a decision about the row this card loaded. Acting before the read
  // lands means acting on a guess, which is the whole of D65 in a smaller
  // window, so the buttons wait.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await safeApiCall<{
        data?: {
          active?: { type?: string; config?: Cfg };
          providers?: ActiveRow[];
        };
      }>("/api/memory/config");
      const payload = (res.data as {
        data?: { active?: { type?: string; config?: Cfg }; providers?: ActiveRow[] };
      } | undefined)?.data;
      const c = payload?.active?.config;
      if (c) setCfg({ host: c.host, port: c.port, bank: c.bank });
      const providers = payload?.providers ?? [];
      const activeRow =
        providers.find((p) => p.isActive) ??
        providers.find((p) => p.type === payload?.active?.type) ??
        null;
      setRow(activeRow);
      setLoaded(true);
    })();
  }, []);

  async function test(): Promise<Health | null> {
    setTesting(true);
    setHealth(null);
    try {
      // TWO levels. `ok({ health })` is `{ data: { health } }` and safeApiCall
      // hands back the raw body in `.data`, so reading `res.data.health` was
      // always undefined and every probe of a healthy Hindsight reported
      // failure (T-0101, D58).
      const res = await safeApiCall<{ data?: { health?: Health } }>("/api/memory/config", {
        method: "POST",
        body: { action: "test", config: cfg },
      });
      const h = (res.data as { data?: { health?: Health } } | undefined)?.data?.health ?? {
        available: false,
        error: res.error ?? "Connection test failed",
      };
      setHealth(h);
      if (h.available) onReconnected?.();
      return h;
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    setSaving(true);
    setSavedMsg("");
    try {
      const current = row ?? FALLBACK_ROW;
      const res = await safeApiCall<{ data?: { configYaml?: { written: boolean; error: string | null } } }>(
        "/api/memory/config",
        {
          method: "PUT",
          body: {
            type: current.type,
            label: current.label,
            enabled: true,
            // Only when this row is not already the active one. makeActive
            // rewrites every other row's flag, which is not what "I edited the
            // port" means.
            ...(current.isActive ? {} : { makeActive: true }),
            config: cfg,
          },
        },
      );
      const yamlNote = (res.data as { data?: { configYaml?: { written: boolean; error: string | null } } } | undefined)
        ?.data?.configYaml;
      setSavedMsg(
        res.ok
          ? yamlNote && !yamlNote.written
            ? `Saved. ${yamlNote.error}`
            : "Saved — endpoint updated."
          : res.error ?? "Save failed",
      );
      if (res.ok) {
        setRow({ ...current, isActive: true, confirmed: true });
        await test();
      }
    } finally {
      setSaving(false);
    }
  }

  // Nothing answered: this card is the whole story, and its heading says so.
  const storeUnreachable = storeHealth !== null && storeHealth.available === false;
  // Something answered at an endpoint nobody confirmed. The warning is about
  // reading SOMEBODY ELSE'S memories, which only happens when there is a
  // service there at all.
  const unconfirmedGuess = !storeUnreachable && row !== null && row.confirmed === false;

  return (
    <Card padding="md" glow="pink">
      <div className="mb-3 flex items-center gap-2">
        <Plug className="h-4 w-4 text-neon-pink" />
        <h2 className="text-sm font-semibold text-white">
          {storeUnreachable ? "Set up memory" : "Memory provider"}
        </h2>
        <span className="rounded bg-white/5 px-1.5 py-0.5 text-xs font-mono uppercase tracking-wider text-ps-text-muted">
          {row?.label ?? "Memory"}
        </span>
      </div>
      <p className="mb-4 text-xs text-ps-text-muted">
        PatterStage owns this connection — edit it here, no Hermes file edits. Stored in the database.
      </p>

      {/* The page's one health voice, inside the card that can fix it. */}
      {storeUnreachable && storeHealth && (
        <HealthBanner health={storeHealth} loadingInitial={false} onRetry={() => onRetry?.()} />
      )}

      {/* Say out loud that the endpoint below is a guess until somebody confirms
          it. The shipped default is 127.0.0.1:9177, which is exactly where a
          real Hindsight listens — so a second install on one machine connects
          to the first operator's memory and renders their facts as its own.
          That is not hypothetical: it is how a throwaway QA instance came to
          display the operator's real memories. The auto-connect stays, because
          it is what makes a fresh install work with no setup; what changes is
          that the product stops presenting a guess as a decision (T-0077). */}
      {unconfirmedGuess && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-neon-orange/30 bg-neon-orange/10 px-3 py-2 text-xs text-neon-orange"
        >
          Using the built-in default — not yet confirmed. PatterStage guessed{" "}
          <span className="font-mono">
            {cfg.host}:{cfg.port}
          </span>
          . If another memory service is already running there, this will show its
          memories rather than yours. Check the values and press Save to confirm.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px_1fr]">
        <Field label="Host" htmlFor="mp-host">
          <Input
            id="mp-host"
            value={cfg.host}
            onChange={(e) => setCfg({ ...cfg, host: e.target.value })}
            placeholder="127.0.0.1"
          />
        </Field>
        <Field label="Port" htmlFor="mp-port">
          <Input
            id="mp-port"
            type="number"
            value={cfg.port}
            onChange={(e) => setCfg({ ...cfg, port: Number(e.target.value) || 0 })}
            placeholder="9177"
          />
        </Field>
        <Field label="Bank" htmlFor="mp-bank">
          <Input
            id="mp-bank"
            value={cfg.bank}
            onChange={(e) => setCfg({ ...cfg, bank: e.target.value })}
            placeholder="hermes"
          />
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="secondary" color="cyan" size="sm" loading={testing} disabled={!loaded} onClick={() => void test()}>
          <Plug className="h-4 w-4" /> Test connection
        </Button>
        <Button variant="primary" color="pink" size="sm" loading={saving} disabled={!loaded} onClick={() => void save()}>
          Save
        </Button>
        {health ? (
          <span
            className={`inline-flex items-center gap-1.5 text-xs ${health.available ? "text-neon-green" : "text-neon-pink"}`}
          >
            {health.available ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {health.available ? `Connected (${health.status ?? "healthy"})` : health.error ?? "Unreachable"}
          </span>
        ) : testing ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-ps-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Probing…
          </span>
        ) : null}
        {savedMsg ? <span className="text-xs text-ps-text-muted">{savedMsg}</span> : null}
      </div>
    </Card>
  );
}
