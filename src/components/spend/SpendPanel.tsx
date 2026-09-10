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

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Input } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/field/Select";
import { InlineToggle } from "@/components/ui/Input";
import { neonAlpha } from "@/components/viz/colors";
import { sectionHeadingClasses } from "@/lib/theme";
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
      <Card data-testid="spend-loading" className="text-body text-ps-text-muted">
        Loading provider spend…
      </Card>
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
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Wallet className="h-4 w-4 text-neon-green" />
        <h2 className={sectionHeadingClasses}>
          Provider spend
        </h2>
        {/* The old wording here said "prices are the published per-model rates".
            On an install running a model the rate table has never heard of, not
            one figure on this panel came from a published rate: they all came
            from the fallback. Do not put that sentence back. The rates are a
            short static list, and the copy has to hold for the installs that
            are not on it. */}
        <span
          title="Estimated from the token usage already recorded against each run. Where there is a price on file for the model it is used; where there is not, the run is priced at a fallback rate and the panel says so below. Either way this is an estimate, not an invoice."
          aria-label="How this is estimated"
          className="ml-0.5 cursor-help text-ps-text-faint transition-colors hover:text-ps-text-secondary"
        >
          <Info className="h-3 w-3" />
        </span>
      </div>

      {/* ── Per period. Always on screen, budget or no budget. ── */}
      <div className="grid grid-cols-3 gap-3">
        {summary.periods.map((p) => (
          <Card
            key={p.period}
            variant="raised"
            padding="none"
            data-testid={`spend-total-${p.period}`}
          >
            {/* The inset glow is painted on the tile's own inner box: Card
                carries no style prop, and an inset shadow on a wrapper would
                sit behind the card's opaque fill. */}
            <div className="rounded-ps-lg p-3" style={{ boxShadow: `inset 0 0 18px ${neonAlpha("green", 5)}` }}>
              <div className="font-mono text-display font-bold text-ps-text-primary">
                {formatUsd(p.totalUsd)}
              </div>
              <div className="mt-0.5 text-micro uppercase tracking-wider text-ps-text-muted">{p.label}</div>
              {/* Driven by the row's OWN note, not by its basis.
                  The mark used to key off `basis.estimatedUsd > 0` and point at a
                  sentence built from the budget period alone, which broke twice:
                  a week can be estimated while the month it hangs under is not
                  (the ISO week opens on a Monday, so early in most months the
                  week window reaches back past the month boundary), and the note
                  that did render carried the budget period's dollars, not this
                  tile's. The note is per period now, and the mark and its
                  explanation come from the same field so neither can outlive the
                  other. */}
              {p.estimateNote && (
                <div
                  data-testid={`spend-estimated-${p.period}`}
                  title={p.estimateNote}
                  className="mt-1 text-body text-ps-text-faint"
                >
                  {p.basis.knownUsd > 0 ? "Part estimated" : "Estimated"}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* ── Per source, for the period the budget covers. ──
          The heading is not decoration. Three period tiles sit directly above
          this list and it counts only one of them, so without the label its
          figures read as belonging to whichever tile the eye landed on last. */}
      <div
        data-testid="spend-sources-period"
        className="mt-3 text-micro uppercase tracking-wider text-ps-text-faint"
      >
        {periodLabel(summary.budgetPeriod)}, by source
      </div>
      {/* Columns, not one full-width list. Measured on /results/insights,
          this put a source name at one end of a 1,134px row and its
          figures at the other: a 944px gap, the worst label-to-value
          distance anywhere in the product, and four of these rows were
          over 400px. A pair you have to track across a thousand pixels
          is two facts rather than one (T-0124). */}
      <ul className="mt-1.5 grid grid-cols-1 gap-x-8 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
        {budget.sources.map((s) => (
          <li
            key={s.source}
            data-testid={`spend-source-${s.source}`}
            className="flex items-center justify-between gap-2 text-body"
          >
            <span className="text-ps-text-secondary">{s.label}</span>
            <span className="font-mono text-ps-text-muted">
              {s.runs} run{s.runs === 1 ? "" : "s"}
              {" · "}
              {/* Never "$0.00" for a source this database did not record. A
                  confident zero is a worse answer than an honest blank. */}
              {s.recorded ? formatUsd(s.costUsd ?? 0) : "cost not recorded"}
              {/* Composer stages and Story Weaver chapters carry no model, so
                  they are ALWAYS priced at the fallback. Saying so on the row
                  is the difference between a figure and a figure you can
                  judge. */}
              {s.estimatedUsd > 0 && (
                <span className="ml-1.5 text-ps-text-faint">
                  {s.costUsd !== null && s.estimatedUsd < s.costUsd ? "part estimated" : "estimated"}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {summary.estimateNote && (
        <p data-testid="spend-rate-basis" className="mt-2 text-body leading-relaxed text-ps-text-faint">
          {summary.estimateNote}
        </p>
      )}

      {summary.unmeasured.length > 0 && (
        <p data-testid="spend-unmeasured" className="mt-2 text-body leading-relaxed text-ps-text-faint">
          {summary.unmeasured.join(" ")}
        </p>
      )}

      {/* ── The meter exists only when a figure does. ── */}
      {policy.limitUsd !== null && (
        <div data-testid="spend-meter" className="mt-4">
          <div className="flex items-center justify-between text-body text-ps-text-muted">
            <span>
              {periodLabel(policy.period)} against {formatUsd(policy.limitUsd)}
            </span>
            <span className="font-mono">{meterPct}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ps-surface-raised">
            <div
              className={`h-full rounded-full ${verdict.breached ? "bg-neon-pink" : "bg-neon-green"}`}
              style={{ width: `${meterPct}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Clause 3: a figure warns. Clause 4: only an armed stop stops. ── */}
      {verdict.state === "over" && !verdict.blocksUnattended && (
        <Card
          variant="raised"
          padding="none"
          data-testid="spend-warning"
          className="mt-3 flex items-start gap-2 p-2.5 text-body leading-relaxed text-ps-text-secondary"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-warn" />
          <span>{verdict.message}</span>
        </Card>
      )}

      {verdict.blocksUnattended && (
        <Card
          variant="raised"
          padding="none"
          data-testid="spend-stopped"
          className="mt-3 flex items-start gap-2 p-2.5 text-body leading-relaxed text-ps-text-secondary"
        >
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-blocked" />
          <span>{verdict.message}</span>
        </Card>
      )}

      {/* ── The budget control. One line until it is asked for. ── */}
      <div className="mt-4 border-t border-ps-edge-hairline pt-3">
        <button
          type="button"
          data-testid="spend-budget-toggle"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex min-h-6.5 items-center text-body text-ps-text-muted transition-colors hover:text-ps-text-secondary"
        >
          {policy.limitUsd === null
            ? "Set a budget (optional)"
            : `Budget: ${formatUsd(policy.limitUsd)} per ${summary.budgetPeriod}${policy.hardStop ? ", hard stop on" : ""}`}
        </button>

        {open && (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-body text-ps-text-muted" htmlFor="spend-limit">
                USD per
              </label>
              <NativeSelect
                aria-label="Spend limit period"
                id="spend-period"
                data-testid="spend-period-select"
                value={draftPeriod}
                onChange={(e) => setPeriod(e.target.value as SpendPeriod)}
                className="w-28 font-mono"
              >
                {SPEND_PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </NativeSelect>
              <Input
                id="spend-limit"
                data-testid="spend-limit-input"
                type="text"
                inputMode="decimal"
                value={draftLimit}
                placeholder="no budget"
                onChange={(e) => setLimitText(e.target.value)}
                className="w-32 font-mono"
              />
            </div>

            <div className="flex items-start gap-2 text-body leading-relaxed text-ps-text-secondary">
              <InlineToggle
                data-testid="spend-hard-stop"
                value={draftHardStop}
                disabled={draftLimitValue === null}
                onChange={setHardStop}
                color="green"
                labelledBy="spend-hard-stop-label"
              />
              <span id="spend-hard-stop-label">
                Hard stop: pause unattended dispatch when this figure is passed. Off by default.
                Scheduled runs, the queue and Composer wait; dispatching by hand always works.
              </span>
            </div>

            {formError && (
              <p data-testid="spend-form-error" className="text-body text-neon-pink">
                {formError}
              </p>
            )}

            <Button
              variant="primary"
              color="green"
              size="sm"
              data-testid="spend-save"
              disabled={saving}
              onClick={save}
            >
              {saving ? "Saving…" : "Save budget"}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
