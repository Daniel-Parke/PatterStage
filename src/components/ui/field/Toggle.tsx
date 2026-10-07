"use client";

import { useId } from "react";

const toggleColorMap: Record<string, { track: string; thumb: string }> = {
  cyan: { track: "bg-neon-cyan/30 border-neon-cyan/50", thumb: "bg-neon-cyan" },
  purple: { track: "bg-neon-purple/30 border-neon-purple/50", thumb: "bg-neon-purple" },
  green: { track: "bg-neon-green/30 border-neon-green/50", thumb: "bg-neon-green" },
  pink: { track: "bg-neon-pink/30 border-neon-pink/50", thumb: "bg-neon-pink" },
  orange: { track: "bg-neon-orange/30 border-neon-orange/50", thumb: "bg-neon-orange" },
};

export function Toggle({
  label,
  value,
  onChange,
  description,
  hint,
  disabled = false,
  color = "cyan",
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  description?: string;
  hint?: string;
  disabled?: boolean;
  color?: string;
}) {
  // The visible label is pointed at rather than copied. Before this the text and
  // the control were two unrelated boxes: the label was not announced with the
  // switch and clicking it did nothing.
  const labelId = useId();
  const descId = useId();
  const details = [description, hint].filter(Boolean).join(" ");
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <div id={labelId} className="text-body font-medium text-ps-text-secondary">
          {label}
        </div>
        {details && (
          <p id={descId} className="text-body text-ps-text-muted mt-0.5">
            {details}
          </p>
        )}
      </div>
      <InlineToggle
        value={value}
        onChange={onChange}
        color={color}
        disabled={disabled}
        title={hint}
        labelledBy={labelId}
        describedBy={details ? descId : undefined}
      />
    </div>
  );
}

// ── Inline Toggle (no visible label of its own: for tables, lists, rows) ─
//
// Give this control a name with label or labelledBy. Its switch role and
// aria-checked expose the state to assistive technology (T-0062).
//
// Prefer `labelledBy` when a visible label exists elsewhere on screen: pointing
// at it makes the accessible name and the visible name the same string by
// construction, which is what WCAG 2.5.3 asks for and what a duplicated
// `label` string quietly stops being the first time one of them is edited.
export function InlineToggle({
  value,
  onChange,
  disabled = false,
  color = "cyan",
  label,
  labelledBy,
  describedBy,
  title,
  "data-testid": testId,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  color?: string;
  /** Required unless `labelledBy` points at visible text that names it. */
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  title?: string;
  "data-testid"?: string;
}) {
  const colors = toggleColorMap[color] || toggleColorMap.cyan;
  return (
    <button
      type="button"
      role="switch"
      data-testid={testId}
      title={title}
      aria-checked={value}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onClick={() => onChange(!value)}
      disabled={disabled}
      // The BUTTON is 44x24 and the track inside it is 36x20. The track was
      // the button, and 36x20 is under the 24x24 WCAG 2.5.8 asks of a target;
      // the census counted 109 of them the first time this switch appeared on
      // a censused route (T-0125). The look is unchanged; the hit area is not.
      className="relative inline-flex h-6 w-11 shrink-0 items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span
        className={`relative block h-5 w-9 rounded-full transition-colors ${
          value ? colors.track : "bg-ps-surface-raised border border-ps-edge-emphasis"
        }`}
      >
        <span
          className={`absolute left-0 top-0.5 h-4 w-4 rounded-full transition-transform ${
            value
              ? `translate-x-4 ${colors.thumb}`
              : "translate-x-0.5 bg-ps-edge-emphasis"
          }`}
        />
      </span>
    </button>
  );
}
