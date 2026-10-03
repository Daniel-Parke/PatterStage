// ═══════════════════════════════════════════════════════════════
// ConfirmButton — the two-step pattern as a component
//
// The product's rule for a destructive click is two clicks: the first arms
// ("Confirm?"), the second acts, and the armed state disarms itself after a
// few seconds. useTwoStepConfirm held the rule and eleven call sites each
// wired it by hand. One of them wired it wrong: the mission panel's Cancel
// disabled itself on the same predicate that armed it, so the confirming
// click could never land and a running mission could not be cancelled from
// the board (T-0096, D66). Five other sites never adopted the rule and used
// the native window.confirm (D51).
//
// So the rule is a component. It is never disabled BY being armed; `loading`
// and an external `disabled` are the only things that disable it.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useCallback, type MouseEvent, type ReactNode } from "react";

import Button, { type ButtonProps } from "@/components/ui/Button";
import { useTwoStepConfirm } from "@/hooks/useTwoStepConfirm";

export interface ConfirmButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
  /** Runs on the second click only. */
  onConfirm: () => void | Promise<void>;
  /** The idle label. */
  children?: ReactNode;
  /** The armed label. */
  confirmLabel?: ReactNode;
  /** How long the armed state lasts before it disarms itself. */
  autoDismissMs?: number;
  /**
   * Runs on EVERY click before the arm/confirm logic, for a caller that needs
   * to stop propagation (a delete button inside a clickable card). Calling
   * preventDefault() on the event cancels the click entirely.
   */
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  /** Classes added while armed. */
  armedClassName?: string;
}

export default function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = "Confirm?",
  autoDismissMs = 4000,
  onClick,
  armedClassName = "ring-1 ring-semantic-danger/60",
  className = "",
  disabled,
  loading = false,
  ...rest
}: ConfirmButtonProps) {
  const { isArmed, arm, confirm: confirmArmed } = useTwoStepConfirm({ autoDismissMs });

  const handleClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      if (e.defaultPrevented) return;
      if (isArmed) void confirmArmed(onConfirm);
      else arm();
    },
    [onClick, isArmed, confirmArmed, onConfirm, arm],
  );

  return (
    <Button
      {...rest}
      className={`${className} ${isArmed ? armedClassName : ""}`.trim()}
      // Armed is not disabled. That is the whole point (D66).
      disabled={disabled || loading}
      loading={loading}
      data-armed={isArmed ? "true" : undefined}
      onClick={handleClick}
    >
      {isArmed ? confirmLabel : children}
    </Button>
  );
}
