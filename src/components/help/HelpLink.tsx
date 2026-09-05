// ═══════════════════════════════════════════════════════════════
// HelpLink — the ? that every header carries
//
// No page passes a slug. The control reads the current path and asks the
// manifest which guide documents that screen, exactly the way the h1 asks the
// registry which word names it; two notions of what owns
// /results/sessions/abc123 would put the title and its guide out of step on
// every detail page. A page cannot therefore quietly lose its guide by
// forgetting a prop.
//
// It is never dead. A screen with no guide yet, or a checkout with no built
// corpus at all, lands on the Help index rather than a 404 — a ? that
// sometimes goes nowhere teaches an operator to stop pressing it.
//
// The `?` key is the same control, so its listener lives in the same file: one
// PageHeader per screen means one listener per screen, registered and removed
// with the thing it duplicates.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { HelpCircle } from "lucide-react";

import { helpSlugForPathname } from "@/lib/help/help-manifest";
import { labelFor } from "@/lib/modules/registry";
import { useHelpScreens } from "@/components/help/HelpProvider";

/**
 * Is the keystroke a question mark someone is writing rather than pressing?
 *
 * A `?` typed into a prompt box is text, and stealing it would make the one
 * screen operators type most into the one screen they cannot type a question
 * mark on.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest("input, textarea, select, [contenteditable]") !== null;
}

/**
 * The app router, or null when this header is rendered outside one.
 *
 * next/navigation's useRouter throws rather than answering null when there is
 * no app-router context above it. The keystroke is a shortcut on top of a link
 * that already works, so a header mounted outside the router loses the
 * shortcut instead of taking the whole header down with it.
 */
function useRouterIfMounted(): ReturnType<typeof useRouter> | null {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

export default function HelpLink() {
  const pathname = usePathname() ?? "/";
  const router = useRouterIfMounted();
  const screens = useHelpScreens();

  // Help does not point at itself: the page already has its own navigation,
  // and a ? on it would either be a no-op or a loop.
  const onHelp = pathname === "/help" || pathname.startsWith("/help/");
  const slug = helpSlugForPathname(pathname, screens);
  const href = slug ? `/help/${slug}` : "/help";
  const label = labelFor(pathname);
  const name = label ? `Help for ${label}` : "Help";

  useEffect(() => {
    if (onHelp) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "?") return;
      // Shift is expected — `?` is Shift+/ — but ctrl, cmd and alt make chords
      // the browser and the OS have already claimed.
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.defaultPrevented) return;
      if (isTypingTarget(event.target)) return;
      router?.push(href);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onHelp, href, router]);

  if (onHelp) return null;

  return (
    <Link
      href={href}
      aria-label={name}
      title={name}
      data-testid="help-link"
      className="flex items-center text-ps-text-muted hover:text-white transition-colors shrink-0"
    >
      <HelpCircle className="w-4 h-4" aria-hidden="true" />
    </Link>
  );
}
