// ═══════════════════════════════════════════════════════════════
// LinkButton — a link wearing Button's chrome.
//
// S4 named it and nothing built it, so every link that wanted to look like a
// button hand-rolled its own class string at its own height: the quest row's
// Go, the Start here card's Go and All quests, the Progress line's Quests, the
// dashboard's Session browser. None of the four was one of Button's three
// heights. This is Next's Link on button-chrome.ts, so a link and a button
// side by side are the same height and the same shape, and a screen reader
// still hears a link, which is what a navigation is (T-0127).
// ═══════════════════════════════════════════════════════════════

"use client";

import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes, ComponentType, ReactNode } from "react";

import type { AccentColor } from "@/types/console";
import {
  buttonChrome,
  buttonHeights,
  buttonPadding,
  type ButtonSize,
  type ButtonVariant,
} from "@/components/ui/button-chrome";

export interface LinkButtonProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: LinkProps["href"];
  variant?: ButtonVariant;
  color?: AccentColor;
  size?: ButtonSize;
  icon?: ComponentType<{ className?: string }>;
  children?: ReactNode;
}

export default function LinkButton({
  href,
  variant = "secondary",
  color = "cyan",
  size = "md",
  icon: Icon,
  className = "",
  children,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={`${buttonChrome({ variant, color })} ${buttonHeights[size]} ${buttonPadding[size]} ${className}`.trim()}
      // Bloom tier (WG-WEB-011 C), tight variant, as Button.
      data-bloom="tight"
      {...props}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      {children}
    </Link>
  );
}
