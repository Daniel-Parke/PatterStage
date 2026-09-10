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
import { Plug } from "lucide-react";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/field";
import { Select } from "@/components/ui/Input";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { useToast } from "@/components/ui/Toast";
import { useApiResource } from "@/hooks/useApiResource";
import { safeApiCall, type SafeApiCallResult } from "@/lib/api-fetch";
import { runWrite } from "@/lib/api-write";
import ConceptHint from "@/components/help/ConceptHint";

import { healthBannerMessage } from "./hindsight/health-message";
import type { HealthState } from "./hindsight/types";
import type { MemoryProviderType } from "@/lib/memory/memory-providers/types";

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

/**
 * The backends an operator can pick between.
 *
 * Mirrors the `options` on memory.provider in config-schema.ts, which is the
 * declaration the config page reads. If one is added there and not here, this
 * screen quietly stops being the place the provider is set, which is the defect
 * this control exists to end.
 */
const SELECTABLE_PROVIDERS: ReadonlyArray<{ type: MemoryProviderType; label: string }> = [
  { type: "hindsight", label: "Hindsight" },
  { type: "holographic", label: "Holographic" },
];

interface MemoryConfigPayload {
  active?: { type?: string; config?: Cfg };
  providers?: ActiveRow[];
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
  const { showToast, toastElement } = useToast();
  const [cfg, setCfg] = useState<Cfg>({ host: "127.0.0.1", port: 9177, bank: "hermes" });
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  // The row as loaded. Save edits THIS provider: hardcoding hindsight here is
  // how editing a port on a holographic install silently switched the whole
  // memory backend (T-0101, D65).
  const [row, setRow] = useState<ActiveRow | null>(null);
  // The provider the operator has PICKED, which is not always the one that
  // was loaded. Held separately so Save can send a change: it used to post
  // `type: current.type` and a choice could never leave the screen.
  const [chosenType, setChosenType] = useState<MemoryProviderType | null>(null);
  // Save is a decision about the row this card loaded. Acting before the read
  // lands means acting on a guess, which is the whole of D65 in a smaller
  // window, so the buttons wait.
  const [loaded, setLoaded] = useState(false);

  // The read goes through the hook (T-0129); the effect below only copies
  // what it answered into the form's own state, once, when it answers.
  const configRead = useApiResource<MemoryConfigPayload>("/api/memory/config", {
    select: (p) => (p as MemoryConfigPayload | null) ?? undefined,
    staleTime: 30_000,
  });
  useEffect(() => {
    if (!configRead.settled) return;
    const payload = configRead.data;
    const c = payload?.active?.config;
    if (c) setCfg({ host: c.host, port: c.port, bank: c.bank });
    const providers = payload?.providers ?? [];
    const activeRow =
      providers.find((p) => p.isActive) ??
      providers.find((p) => p.type === payload?.active?.type) ??
      null;
    setRow(activeRow);
    setLoaded(true);
  }, [configRead.settled, configRead.data]);

  // TWO levels. `ok({ health })` is `{ data: { health } }` and safeApiCall
  // hands back the raw body in `.data`, so reading `res.data.health` was
  // always undefined and every probe of a healthy Hindsight reported
  // failure (T-0101, D58).
  function probeHealth(res: SafeApiCallResult<{ data?: { health?: Health } }>): Health {
    return res.data?.data?.health ?? { available: false, error: res.error ?? "Connection test failed" };
  }

  // The probe's answer is said once, as a toast, in the store's own words: the
  // card used to paint it a second time beside the button, and this card is
  // the page's one voice about memory (T-0101). Through safeApiCall rather
  // than a throwing request because a refused probe is an answer, not a fault.
  async function test(): Promise<void> {
    await runWrite<SafeApiCallResult<{ data?: { health?: Health } }>>({
      showToast,
      setBusy: setTesting,
      request: () =>
        safeApiCall<{ data?: { health?: Health } }>("/api/memory/config", {
          method: "POST",
          body: { action: "test", config: cfg },
        }),
      checkSuccess: false,
      successMessage: (res) => {
        const h = probeHealth(res);
        return h.available
          ? `Connected (${h.status ?? "healthy"})`
          : { message: h.error ?? "Unreachable", type: "error" };
      },
      errorMessage: "Connection test failed",
      onSuccess: (res) => {
        if (probeHealth(res).available) onReconnected?.();
      },
    });
  }

  async function save() {
    const current = row ?? FALLBACK_ROW;
    await runWrite<SafeApiCallResult<{ data?: { configYaml?: { written: boolean; error: string | null } } }>>({
      showToast,
      setBusy: setSaving,
      request: () =>
        safeApiCall<{ data?: { configYaml?: { written: boolean; error: string | null } } }>("/api/memory/config", {
          method: "PUT",
          body: {
            // The chosen provider, falling back to the loaded one when the
            // operator has not touched the chooser.
            type: chosenType ?? current.type,
            label: current.label,
            enabled: true,
            // Only when this row is not already the active one. makeActive
            // rewrites every other row's flag, which is not what "I edited the
            // port" means. Choosing a DIFFERENT provider is exactly that
            // though, so a change of type always makes the new one active:
            // otherwise the product would go on reading the old backend while
            // the operator believed they had switched.
            ...(current.isActive && (chosenType ?? current.type) === current.type
              ? {}
              : { makeActive: true }),
            config: cfg,
          },
        }),
      checkSuccess: false,
      successMessage: (res) => {
        if (!res.ok) return { message: res.error ?? "Save failed", type: "error" };
        const yamlNote = res.data?.data?.configYaml;
        return yamlNote && !yamlNote.written
          ? { message: `Saved. ${yamlNote.error}`, type: "info" }
          : "Saved — endpoint updated.";
      },
      errorMessage: "Save failed",
      onSuccess: async (res) => {
        if (!res.ok) return;
        setRow({ ...current, isActive: true, confirmed: true });
        await test();
      },
    });
  }

  // Nothing answered: this card is the whole story, and its heading says so.
  const storeUnreachable = storeHealth !== null && storeHealth.available === false;
  // Something answered at an endpoint nobody confirmed. The warning is about
  // reading SOMEBODY ELSE'S memories, which only happens when there is a
  // service there at all.
  const unconfirmedGuess = !storeUnreachable && row !== null && row.confirmed === false;

  return (
    <Card padding="md" glow="pink">
      {toastElement}
      <div className="mb-3 flex items-center gap-2">
        <Plug className="h-4 w-4 text-neon-pink" />
        <h2 className="text-body font-semibold text-ps-text-primary">
          {/* The card is the first thing on the screen and the heading is the
              first place the word appears, in either of its two states. */}
          <ConceptHint id="memory">{storeUnreachable ? "Set up memory" : "Memory provider"}</ConceptHint>
        </h2>
        <span className="rounded-ps-sm bg-ps-surface-raised px-1.5 py-0.5 text-micro font-mono uppercase tracking-wider text-ps-text-muted">
          {row?.label ?? "Memory"}
        </span>
      </div>
      <p className="mb-4 text-body text-ps-text-muted">
        PatterStage owns this connection — edit it here, no Hermes file edits. Stored in the database.
      </p>

      {/* The page's one health voice, inside the card that can fix it. One
          error surface with its Retry inside it (T-0096); the sentence is
          healthBannerMessage's, which reads the health payload's shape. */}
      {storeUnreachable && storeHealth && (
        <LoadErrorBanner error={healthBannerMessage(storeHealth)} onRetry={() => onRetry?.()} />
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
        <Card variant="raised" padding="none" className="mb-4 px-3 py-2 text-body text-neon-orange">
          <p role="status">
            Using the built-in default — not yet confirmed. PatterStage guessed{" "}
            <span className="font-mono">
              {cfg.host}:{cfg.port}
            </span>
            . If another memory service is already running there, this will show its
            memories rather than yours. Check the values and press Save to confirm.
          </p>
        </Card>
      )}

      {/* The provider itself. The config page renders memory.provider read-only
          under "Set this on the Memory page", so this is the control that
          sentence has always been pointing at, and until now it did not exist.
          `none` is not offered: choosing it would mean "turn memory off", which
          the enabled flag already says, and two controls for one decision is
          how they come to disagree. */}
      <div className="mb-3">
        <Select
          label="Provider"
          value={chosenType ?? row?.type ?? FALLBACK_ROW.type}
          onChange={(v) => setChosenType(v as MemoryProviderType)}
          options={SELECTABLE_PROVIDERS.map((p) => p.type)}
        />
        <p className="mt-1 text-body text-ps-text-faint">
          Which memory backend the agent uses. Saving a different one switches
          the agent over and writes it into its configuration.
        </p>
      </div>

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
      </div>
    </Card>
  );
}
