// ═══════════════════════════════════════════════════════════════
// components/spend/SpendPanel — provider spend, and the operator's optional
// budget beside it.
//
// Two instructions that pull in opposite directions, and the way this component
// resolves them is the whole design:
//
//   VISIBLE BY DEFAULT. The numbers are always on screen. Spend is the only
//   thing in PatterStage that costs money, and it was computable from recorded
//   data long before anything showed it.
//
//   NOT IN YOUR FACE. Until the operator sets a figure there is no meter, no
//   warning, no red anything, and no form demanding a number. The budget
//   control is one quiet line that opens when it is asked to. A tool that
//   refuses to work until you have filled in a budget field teaches you to
//   resent it, which is the sentence this component was written against.
//
// Presentational on purpose: it takes a summary and an onSave and owns no
// fetching, so every branch above is testable without a network or a database.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import { Wallet, AlertTriangle, ShieldAlert, Info } from "lucide-react";

import { neonAlpha } from "@/components/viz/colors";
import { inputFieldClasses } from "@/lib/theme";
import {
  SPEND_PERIODS,
  formatUsd,
  periodLabel,
  type SpendPeriod,
} from "@/lib/spend/spend-law";
import type { SpendSummary } from "@/lib/spend/spend-summary";

export interface SpendPolicyDraft {
  limitUsd: number | null;
  period: SpendPeriod;
  hardStop: boolean;
}

interface SpendPanelProps {
  summary: SpendSummary | undefined;
  onSave: (draft: SpendPolicyDraft) => void;
  saving?: boolean;
}

export default function SpendPanel({ summary, onSave, saving = false }: SpendPanelProps) {
  const [open, setOpen] = useState(false);
  const [limitText, setLimitText] = useState<string | null>(null);
  const [period, setPeriod] = useState<SpendPeriod | null>(null);
  const [hardStop, setHardStop] = useState<boolean | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  if (!summary) {
    return (
      <div
        data-testid="spend-loading"
        className="rounded-2xl border border-white/10 bg-dark-900/60 p-4 text-xs text-ps-text-muted"
      >
        Loading provider spend…
      </div>
    );
  }

  const { policy, verdict } = summary;
  // The draft falls back to the stored policy, so opening the form shows what
  // is set rather than an empty box implying nothing is.
  const draftLimit = limitText ?? (policy.limitUsd === null ? "" : String(policy.limitUsd));
  const draftPeriod = period ?? policy.period;
  const draftHardStop = hardStop ?? policy.hardStop;
  const draftLimitValue = draftLimit.trim() === "" ? null : Number(draftLimit);
  const budget = summary.periods.find((p) => p.period === summary.budgetPeriod) ?? summary.periods[0];

  function save() {
    if (draftLimitValue !== null && (!Number.isFinite(draftLimitValue) || draftLimitValue <= 0)) {
      setFormError("Enter a positive number of US dollars, or leave it blank for no budget.");
      return;
    }
    setFormError(null);
    onSave({
      limitUsd: draftLimitValue,
      period: draftPeriod,
      // Clearing the figure disarms the stop with it. The two can never be
      // saved apart, which is the same rule the database enforces.
      hardStop: draftLimitValue === null ? false : draftHardStop,
    });
  }

  const meterPct = verdict.fraction === null ? 0 : Math.min(100, Math.round(verdict.fraction * 100));

  return (
    <div className="rounded-2xl border border-white/10 bg-dark-900/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Wallet className="h-4 w-4 text-neon-green" />
        <h2 className="text-xs font-mono uppercase tracking-widest text-ps-text-muted">
          Provider spend
        </h2>
        <span
          title="Estimated from the token usage already recorded against each run. Prices are the published per-model rates, so treat this as an estimate, not an invoice."
          aria-label="How this is estimated"
          className="ml-0.5 cursor-help text-ps-text-faint transition-colors hover:text-ps-text-secondary"
        >
          <Info className="h-3 w-3" />
        </span>
      </div>

      {/* ── Per period. Always on screen, budget or no budget. ── */}
      <div className="grid grid-cols-3 gap-3">
        {summary.periods.map((p) => (
          <div
            key={p.period}
            data-testid={`spend-total-${p.period}`}
            className="rounded-xl border border-white/10 bg-dark-900/40 p-3"
            style={{ boxShadow: `inset 0 0 18px ${neonAlpha("green", 5)}` }}
          >
            <div className="font-mono text-2xl font-bold text-ps-text-primary">
              {formatUsd(p.totalUsd)}
            </div>
            <div className="mt-0.5 text-xs uppercase tracking-wider text-ps-text-muted">{p.label}</div>
          </div>
        ))}
      </div>

      {/* ── Per source, for the period the budget covers. ── */}
      <ul className="mt-3 space-y-1.5">
        {budget.sources.map((s) => (
          <li
            key={s.source}
            data-testid={`spend-source-${s.source}`}
            className="flex items-center justify-between gap-2 text-xs"
          >
            <span className="text-ps-text-secondary">{s.label}</span>
            <span className="font-mono text-ps-text-muted">
              {s.runs} run{s.runs === 1 ? "" : "s"}
              {" · "}
              {/* Never "$0.00" for a source this database did not record. A
                  confident zero is a worse answer than an honest blank. */}
              {s.recorded ? formatUsd(s.costUsd ?? 0) : "cost not recorded"}
            </span>
          </li>
        ))}
      </ul>

      {summary.unmeasured.length > 0 && (
        <p data-testid="spend-unmeasured" className="mt-2 text-xs leading-relaxed text-ps-text-faint">
          {summary.unmeasured.join(" ")}
        </p>
      )}

      {/* ── The meter exists only when a figure does. ── */}
      {policy.limitUsd !== null && (
        <div data-testid="spend-meter" className="mt-4">
          <div className="flex items-center justify-between text-xs text-ps-text-muted">
            <span>
              {periodLabel(policy.period)} against {formatUsd(policy.limitUsd)}
            </span>
            <span className="font-mono">{meterPct}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full ${verdict.breached ? "bg-neon-pink" : "bg-neon-green"}`}
              style={{ width: `${meterPct}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Clause 3: a figure warns. Clause 4: only an armed stop stops. ── */}
      {verdict.state === "over" && !verdict.blocksUnattended && (
        <p
          data-testid="spend-warning"
          className="mt-3 flex items-start gap-2 rounded-lg border border-neon-orange/30 bg-neon-orange/5 p-2.5 text-xs leading-relaxed text-ps-text-secondary"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neon-orange" />
          <span>{verdict.message}</span>
        </p>
      )}

      {verdict.blocksUnattended && (
        <p
          data-testid="spend-stopped"
          className="mt-3 flex items-start gap-2 rounded-lg border border-neon-pink/30 bg-neon-pink/5 p-2.5 text-xs leading-relaxed text-ps-text-secondary"
        >
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neon-pink" />
          <span>{verdict.message}</span>
        </p>
      )}

      {/* ── The budget control. One line until it is asked for. ── */}
      <div className="mt-4 border-t border-white/10 pt-3">
        <button
          type="button"
          data-testid="spend-budget-toggle"
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-ps-text-muted transition-colors hover:text-ps-text-secondary"
        >
          {policy.limitUsd === null
            ? "Set a budget (optional)"
            : `Budget: ${formatUsd(policy.limitUsd)} per ${summary.budgetPeriod}${policy.hardStop ? ", hard stop on" : ""}`}
        </button>

        {open && (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-ps-text-muted" htmlFor="spend-limit">
                USD per
              </label>
              <select
                id="spend-period"
                data-testid="spend-period-select"
                value={draftPeriod}
                onChange={(e) => setPeriod(e.target.value as SpendPeriod)}
                className={`${inputFieldClasses("green")} w-28`}
              >
                {SPEND_PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <input
                id="spend-limit"
                data-testid="spend-limit-input"
                type="text"
                inputMode="decimal"
                value={draftLimit}
                placeholder="no budget"
                onChange={(e) => setLimitText(e.target.value)}
                className={`${inputFieldClasses("green")} w-32`}
              />
            </div>

            <label className="flex items-start gap-2 text-xs leading-relaxed text-ps-text-secondary">
              <input
                type="checkbox"
                data-testid="spend-hard-stop"
                checked={draftHardStop}
                disabled={draftLimitValue === null}
                onChange={(e) => setHardStop(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Hard stop: pause unattended dispatch when this figure is passed. Off by default.
                Scheduled runs, the queue and Composer wait; dispatching by hand always works.
              </span>
            </label>

            {formError && (
              <p data-testid="spend-form-error" className="text-xs text-neon-pink">
                {formError}
              </p>
            )}

            <button
              type="button"
              data-testid="spend-save"
              disabled={saving}
              onClick={save}
              className="rounded-lg border border-neon-green/40 px-3 py-1.5 text-xs font-mono text-neon-green transition-colors hover:bg-neon-green/10 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save budget"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
