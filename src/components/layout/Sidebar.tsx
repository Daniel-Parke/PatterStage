// ═══════════════════════════════════════════════════════════════
// Sidebar Navigation — the rail, rendered ONCE
//
// One <aside>. On a desktop it is the rail beside the page; on a phone it is
// the drawer that slides over the page, a dialog on the shared contract while
// open and inert while closed. It used to be rendered twice (a hidden desktop
// copy and a hidden mobile copy), which is why the icon-button gate once
// counted the rail's links twice and why a tab order on a phone began with
// thirty invisible links (T-0096, D120; T-0097).
//
// The sections come from the registry through sidebar-config (five, in a
// fixed order; Home has no heading); the config tree and the deploy buttons
// are not here any more (decision 12): Settings is one entry, System holds
// the deploy block, and the footer is a version line with an update badge.
// The collapsed state is the operator's preference, kept in /api/prefs.
//
// Two small parts of the rail live here with it (C6): the quest count that
// hangs on the Quests row, and the phone's header bar, whose one job is to
// open this drawer.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ChevronLeft, Menu, Terminal } from "lucide-react";

import { useSidebar } from "./SidebarContext";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import { TABLET_QUERY, useIsMobile } from "@/hooks/useIsMobile";
import { apiQueryKey } from "@/hooks/useApiResource";
import { useStats } from "@/hooks/useStats";
import { iconColorMap, railAccentBarMap } from "@/lib/theme";
import { safeApiCall } from "@/lib/api-fetch";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import IconButton from "@/components/ui/IconButton";
import { mainSections } from "./sidebar-config";
import type { SidebarLink } from "./sidebar-config";
import { RailFooter } from "./RailFooter";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

// ── QuestBadge ──────────────────────────────────────────────────
// How many quests are left, in the rail. It reads the same deduped stats
// poll every quest surface reads, renders nothing while stats are unread and
// nothing once every quest is done (32/32 forever is a nag).
//
// Collapsed, it is a DOT rather than "n/N": the 64px rail's footer stacks its
// links vertically and mono text there would widen or wrap the row; the rail
// must fit 1280x720 without scrolling (tests/e2e/rail-no-scroll.spec.ts).
// Decorative, deliberately: the link's own aria-label ("Quests") is the name
// D119 pins, a second name inside it would be ignored, and a live region would
// re-announce a count every poll. The count is said in full on the page and in a title.
function QuestBadge({ collapsed = false }: { collapsed?: boolean }) {
  const { stats } = useStats();
  const quests = stats?.quests;

  // Unread, empty, or finished: say nothing at all.
  if (!quests || quests.total <= 0 || quests.completed >= quests.total) return null;

  const label = `${quests.completed} of ${quests.total} quests complete`;

  if (collapsed) {
    return (
      <span
        data-testid="quest-badge"
        aria-hidden="true"
        title={label}
        className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-neon-orange"
      />
    );
  }

  return (
    <span
      data-testid="quest-badge"
      aria-hidden="true"
      title={label}
      className="flex-shrink-0 font-mono text-micro text-neon-orange"
    >
      {quests.completed}/{quests.total}
    </span>
  );
}

// ── MobileHeader ────────────────────────────────────────────────
// Compact mobile chrome (3rem): the drawer's entrypoint, intentionally
// shorter than desktop `--ps-shell-header-min-height` (5rem). Below md only:
// from 768 the rail is on the screen as the icon column and there is nothing
// for a hamburger to open (T-0128). Rendered by the root layout beside the
// rail; a client component, which is why it lives here and not there.
export function MobileHeader() {
  const { toggleMobile } = useSidebar();

  // Opaque, and no backdrop blur, for the reason the rail gives below: at
  // 95% the bar was a translucent surface paying a compositing layer on every
  // scroll to blur the 5% of the page it let through.
  return (
    <div className="md:hidden sticky top-0 z-sticky flex items-center min-h-[var(--ps-mobile-header-min-height)] px-3 bg-ps-surface-ground border-b border-ps-edge-hairline flex-shrink-0 gap-3">
      {/* 44px square whatever the size ladder says: a thumb target on a phone. */}
      <IconButton
        icon={Menu}
        label="Open navigation"
        size="lg"
        onClick={toggleMobile}
        className="min-w-[44px] min-h-[44px] text-ps-text-secondary"
      />
      {/* One mark, one name. This said "PT / Hermes": an abbreviation of the
          product beside the name of its dependency, so on a phone the product
          appeared to be called something else than it does on a desktop. */}
      {/* Named, because the words are gone: the compact lockup is the mark
          alone, and an icon-only link with no name is what D119 refuses. Same
          name the rail's own home link carries. */}
      <Link
        href="/"
        aria-label="PatterStage home"
        className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity"
      >
        <BrandMark size="bar" />
      </Link>
    </div>
  );
}

/**
 * `initialCollapsed` comes from the server (see src/app/layout.tsx). The rail
 * used to read the preference on the client, so on every hard load it painted
 * itself 224px wide and then snapped to 64px once the fetch answered: a visible
 * jump on a surface the operator is looking at while the page arrives.
 */
export default function Sidebar({ initialCollapsed = false }: { initialCollapsed?: boolean }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const { mobileOpen, setMobileOpen } = useSidebar();
  const isMobile = useIsMobile();
  const isTablet = useIsMobile(TABLET_QUERY);
  const { data: flags } = useFeatureFlags();
  const closeMobile = useCallback(() => setMobileOpen(false), [setMobileOpen]);

  // The drawer is a dialog while it is open on a phone, and only then.
  const drawerOpen = isMobile && mobileOpen;
  const drawerRef = useDialogA11y({ open: drawerOpen, onClose: closeMobile });

  // The preference arrives with the markup now; only the WRITE is a fetch,
  // through react-query's mutation so the prefs map every other reader holds
  // is re-read afterwards. A failed write (read-only, offline) leaves the
  // rail where the operator put it for this session and the server keeps its
  // old answer; nothing is said, because the rail is already where they put it.
  const queryClient = useQueryClient();
  const { mutate: savePref } = useMutation({
    mutationFn: async (next: boolean) => {
      const res = await safeApiCall("/api/prefs", { method: "PUT", body: { key: "sidebar.collapsed", value: next } });
      if (!res.ok) throw new Error(res.error ?? "Failed to save the preference");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: apiQueryKey("/api/prefs") });
    },
  });
  const toggleCollapsed = useCallback(() => {
    const next = !collapsed;
    setCollapsed(next);
    savePref(next);
  }, [collapsed, savePref]);

  // Flags default ON: hide a link only when its flag is explicitly disabled,
  // so the nav never flashes while flags load (or if the fetch fails).
  const linkVisible = useCallback(
    (link: SidebarLink) => !link.featureFlag || flags?.[link.featureFlag] !== false,
    [flags],
  );

  // Icons only on a desktop rail the operator collapsed, and on any tablet:
  // between md and lg there is room for the 64px column beside a page and not
  // for labels, and until T-0128 that width got the phone's drawer instead.
  // The drawer itself is always full.
  const iconsOnly = !isMobile && (collapsed || isTablet);

  // Home's rows other than Dashboard (Quests, Help) render in the footer.
  const utilityLinks = (mainSections.find((s) => s.label === "Home")?.links ?? []).filter((l) => l.href !== "/");

  const renderLink = useCallback(
    (link: SidebarLink) => {
      const active = isActive(pathname, link.href);
      const bar = railAccentBarMap[link.color];

      return (
        <div key={link.href}>
          <Link
            href={link.href}
            aria-label={link.label}
            title={iconsOnly ? link.label : undefined}
            aria-current={active ? "page" : undefined}
            // `relative`, because the accent bar is anchored to the row's
            // own left edge. Labels sit on the SECONDARY tier: an inactive row
            // that is already the quietest thing on the rail leaves the active
            // one nowhere to go, which is how 63 elements came to share one
            // tone. Collapsed, the row is a 40px square rather than 39x22:
            // under 24x24 it failed WCAG 2.5.8, and it was smaller than the
            // same row expanded, which is backwards for the mode that exists
            // to be reachable.
            //
            // The EXPANDED row was 3px, and is 2px since T-0123. Deleting the
            // sub-link tier was supposed to pay for a taller row, but that tier
            // only rendered under the ACTIVE link, so it never cost more than
            // one route's worth at a time and there was nothing to spend: at
            // py-1.5 the nav measured 673px against a 572px budget, and at py-1
            // it measured 597.
            //
            // 2px because decision 9 added an Automation destination, and the
            // rail had 7px of slack. 24px is still the row: a 20px icon and 2px
            // either side, which is exactly the 24x24 WCAG 2.5.8 asks of a
            // target, and the collapsed row is a 40px square either way. The
            // 34px this returns also pays for the heading margin below, which
            // U7 declared and never rendered.
            className={`relative flex items-center rounded-ps-md text-body transition-colors ${
              iconsOnly ? "h-10 w-10 justify-center" : "gap-2.5 px-3 py-[2px]"
            } ${
              active
                ? "bg-ps-surface-raised text-ps-text-primary"
                : "text-ps-text-secondary hover:bg-ps-surface-raised hover:text-ps-text-primary"
            }`}
            onClick={closeMobile}
          >
            {active && (
              <span
                aria-hidden
                className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-ps-sm ${bar}`}
              />
            )}
            <link.icon
              // Quieter than its own label when the row is not the one you are
              // on: an icon is a landmark, not a second label.
              className={`w-4 h-4 flex-shrink-0 ${active ? iconColorMap[link.color] : "text-ps-text-muted"}`}
            />
            {!iconsOnly && <span>{link.label}</span>}
          </Link>
        </div>
      );
    },
    [pathname, iconsOnly, closeMobile],
  );

  return (
    <>
      {/* Mobile backdrop: a real control with a name, on the overlay layer,
          above the sticky header; the drawer itself is on the modal layer. */}
      {drawerOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={closeMobile}
          className="md:hidden fixed inset-0 bg-black/60 z-overlay cursor-default"
        />
      )}

      <aside
        ref={drawerRef as React.RefObject<HTMLElement | null>}
        data-testid="app-rail"
        role={drawerOpen ? "dialog" : undefined}
        aria-modal={drawerOpen ? "true" : undefined}
        aria-label={drawerOpen ? "Navigation" : undefined}
        tabIndex={drawerOpen ? -1 : undefined}
        inert={isMobile && !mobileOpen}
        aria-hidden={isMobile && !mobileOpen ? true : undefined}
        // One surface and one seam. It used to paint the ground on a phone
        // and dark-900 at 80% on a desktop, measuring 1.02:1 and 1.10:1
        // against the page beside it: two answers to the same question, and
        // neither of them an answer. The panel rung is 1.47:1 and the seam is
        // 3:1, which is what WCAG 1.4.11 asks of a boundary that identifies a
        // region. No backdrop blur: there is nothing behind an opaque surface
        // to blur, and the filter cost a compositing layer on every scroll.
        // `transition-[width]`, not `transition-all`: the second animated colour
        // as well, so the active row faded in over 200ms on every navigation
        // instead of appearing where you clicked.
        className={`flex flex-col h-screen border-r border-ps-edge transition-[width] duration-200 fixed inset-y-0 left-0 z-modal w-56 bg-ps-surface-panel transform ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:static md:z-auto md:translate-x-0 ${iconsOnly ? "md:w-16" : "md:w-56"}`}
      >
        {/* Logo — min-height matches main app chrome (see --ps-shell-header-min-height) */}
        <div className="px-4 min-h-[var(--ps-shell-header-min-height)] flex items-center border-b border-ps-edge-hairline">
          <Link href="/" aria-label="PatterStage home" className="flex items-center gap-2 min-w-0" onClick={closeMobile}>
            <BrandMark words={!iconsOnly} />
          </Link>
        </div>

        {/* The five sections. Home carries no heading: it is where the rail
            starts, and its Quests and Help rows sit in the footer below as the
            plan's utility rows. Every pixel here is budgeted: the rail must
            fit 720px without scrolling (tests/e2e/rail-no-scroll.spec.ts). */}
        {/* py-1, not py-2. Decision 9 added an Automation row and the nav
            measured 590 against a 571 box: the rail had 7px of slack and a
            row costs 26. Four of those pixels come back here and sixteen from
            the section headings below, which is the whole of it (T-0123). The
            headroom is still 7px until U12 takes the Rec Room from five rail
            entries to two and hands back 78. */}
        <nav className="flex-1 px-3 py-1 overflow-y-auto" aria-label="Main">
          {mainSections.map((section) => (
            <div key={section.label}>
              {section.label !== "Home" && !iconsOnly && (
                // A tier of its own, and room above it. A heading set at the
                // same weight as the rows under it is not a heading.
                // `mt-2`, with no `first:` variant, and that is a FIX rather
                // than a tightening. It read `mt-3 first:mt-1`, and every
                // heading is the first child of its own section div - so
                // `first:` won every time, all four rendered at 4px, and the
                // "space above a heading" U7 recorded as delivered never
                // painted at all. Measured: mt=4px on all four (T-0123).
                <div className="text-micro leading-4 font-mono text-ps-text-faint uppercase tracking-widest px-3 mb-0.5 mt-2">
                  {section.label}
                </div>
              )}
              {section.label !== "Home" && iconsOnly && <div className="my-1.5 border-t border-ps-edge-hairline" />}
              {section.links
                .filter(linkVisible)
                .filter((link) => section.label !== "Home" || link.href === "/")
                .map(renderLink)}
            </div>
          ))}
        </nav>

        {/* Footer: Quests and Help, then Collapse with the version or the update badge.
            The two utility cells size to their content (flex-auto) rather than
            splitting the row in half: Quests carries a count beside its label
            and half a 200px row is not enough for icon, word and "12/32"
            together, so equal halves would push the row past the rail's width. */}
        <div className="px-3 py-2 border-t border-ps-edge-hairline space-y-1 flex-shrink-0">
          <div className={`flex ${iconsOnly ? "flex-col items-center gap-1" : "gap-1"}`}>
            {utilityLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-label={link.label}
                title={iconsOnly ? link.label : undefined}
                aria-current={isActive(pathname, link.href) ? "page" : undefined}
                onClick={closeMobile}
                className={`flex items-center justify-center gap-1.5 rounded-ps-md text-micro font-mono transition-colors ${
                  isActive(pathname, link.href) ? "bg-ps-surface-raised text-ps-text-primary" : "text-ps-text-muted hover:bg-ps-surface-raised hover:text-ps-text-primary"
                } ${iconsOnly ? "p-1.5" : "flex-auto px-2 py-1"}`}
              >
                <link.icon className="w-3.5 h-3.5 flex-shrink-0" />
                {!iconsOnly && <span>{link.label}</span>}
                {/* Quests carries how many are left; Help carries nothing.
                    The badge is null until the stats poll answers, so this
                    adds no request and the rail never waits. */}
                {link.href === "/quests" && <QuestBadge collapsed={iconsOnly} />}
              </Link>
            ))}
          </div>
          <div className={`flex items-center ${iconsOnly ? "flex-col gap-1" : "justify-between gap-2"}`}>
            <button
              type="button"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              onClick={toggleCollapsed}
              className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-ps-md text-micro text-ps-text-muted hover:text-ps-text-secondary hover:bg-ps-surface-raised transition-colors font-mono"
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4" />
                  <span>Collapse</span>
                </>
              )}
            </button>
            <RailFooter collapsed={iconsOnly} />
          </div>
        </div>
      </aside>
    </>
  );
}

// ── The product's name, drawn once ──────────────────────────────────────
// It used to be drawn twice and they disagreed: the rail said "PatterStage /
// The Stage is Yours" and the mobile header "PT / Hermes", the product's
// abbreviation beside its dependency's name (T-0121). The words are optional
// because a collapsed rail has 64px and no room for them; the mark is not.

/**
 * `rail` is the desktop lockup at the top of the sidebar; `bar` is the compact
 * one in the mobile header, which is 3rem tall against the rail's 5rem.
 */
function BrandMark({
  size = "rail",
  words = true,
}: {
  size?: "rail" | "bar";
  words?: boolean;
}) {
  const box = size === "rail" ? "w-8 h-8" : "w-7 h-7";
  return (
    <>
      <div className={`${box} rounded-ps-md animated-border p-[1.5px] shrink-0`}>
        <div className="w-full h-full bg-ps-surface-panel rounded-ps-sm flex items-center justify-center">
          <Terminal className="w-4 h-4 text-neon-cyan" />
        </div>
      </div>
      {words && (
        <div className="leading-tight min-w-0">
          <div className="text-body font-bold tracking-tight text-ps-text-primary truncate">
            PatterStage
          </div>
          {size === "rail" && (
            <div className="text-micro text-ps-text-muted mt-0.5 truncate">
              The Stage is{" "}
              {/* The one call site of .text-glow-cyan in the product. Seven
                  sibling glow classes had none and were deleted at T-0120;
                  this one is the product's own name and stays. */}
              <span className="font-bold text-neon-cyan text-glow-cyan">Yours</span>
            </div>
          )}
        </div>
      )}
    </>
  );
}
