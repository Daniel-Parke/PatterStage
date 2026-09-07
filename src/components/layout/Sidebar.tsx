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
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, ChevronLeft, Terminal } from "lucide-react";

import { useSidebar } from "./SidebarContext";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import { useIsMobile } from "@/hooks/useIsMobile";
import { iconColorMap } from "@/lib/theme";
import { safeApiCall } from "@/lib/api-fetch";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { mainSections } from "./sidebar-config";
import type { SidebarLink } from "./sidebar-config";
import { RailFooter } from "./RailFooter";
import QuestBadge from "@/components/quests/QuestBadge";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { mobileOpen, setMobileOpen } = useSidebar();
  const isMobile = useIsMobile();
  const { data: flags } = useFeatureFlags();
  const closeMobile = useCallback(() => setMobileOpen(false), [setMobileOpen]);

  // The drawer is a dialog while it is open on a phone, and only then.
  const drawerOpen = isMobile && mobileOpen;
  const drawerRef = useDialogA11y({ open: drawerOpen, onClose: closeMobile });

  // The collapsed state is a preference: read once, written on each toggle.
  // A failed read or write (read-only, offline) leaves the rail where it is.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await safeApiCall<{ data?: { prefs?: Record<string, unknown> } }>("/api/prefs");
      if (cancelled || !res.ok) return;
      const stored = res.data?.data?.prefs?.["sidebar.collapsed"];
      if (typeof stored === "boolean") setCollapsed(stored);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const toggleCollapsed = useCallback(() => {
    const next = !collapsed;
    setCollapsed(next);
    void safeApiCall("/api/prefs", { method: "PUT", body: { key: "sidebar.collapsed", value: next } });
  }, [collapsed]);

  // Flags default ON: hide a link only when its flag is explicitly disabled,
  // so the nav never flashes while flags load (or if the fetch fails).
  const linkVisible = useCallback(
    (link: SidebarLink) => !link.featureFlag || flags?.[link.featureFlag] !== false,
    [flags],
  );

  // Icons only on a desktop rail the operator collapsed; the drawer is always full.
  const iconsOnly = collapsed && !isMobile;

  // Home's rows other than Dashboard (Quests, Help) render in the footer.
  const utilityLinks = (mainSections.find((s) => s.label === "Home")?.links ?? []).filter((l) => l.href !== "/");

  const renderLink = useCallback(
    (link: SidebarLink) => {
      const active = isActive(pathname, link.href);
      const showSubs = active && link.subLinks && !iconsOnly;

      return (
        <div key={link.href}>
          <Link
            href={link.href}
            aria-label={link.label}
            title={iconsOnly ? link.label : undefined}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2.5 px-3 py-[3px] rounded-ps-md text-body transition-colors ${
              active ? "bg-ps-surface-raised text-ps-text-primary" : "text-ps-text-muted hover:bg-ps-surface-raised hover:text-ps-text-primary"
            }`}
            onClick={closeMobile}
          >
            <link.icon
              className={`w-4 h-4 flex-shrink-0 ${active ? iconColorMap[link.color] : ""}`}
            />
            {!iconsOnly && <span>{link.label}</span>}
          </Link>
          {showSubs && (
            <div className="ml-7 mt-1 space-y-0.5 border-l border-ps-edge-hairline pl-3">
              {link.subLinks!.map((sub) => (
                <Link
                  key={sub.href}
                  href={sub.href}
                  className={`block py-1 text-body transition-colors ${
                    pathname === sub.href ? "text-ps-text-primary" : "text-ps-text-muted hover:text-ps-text-secondary"
                  }`}
                  onClick={closeMobile}
                >
                  {sub.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    },
    [pathname, iconsOnly, closeMobile],
  );

  return (
    <>
      {/* Mobile backdrop: a real control with a name, above the header (z-50). */}
      {drawerOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={closeMobile}
          className="lg:hidden fixed inset-0 bg-black/60 z-[55] cursor-default"
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
        className={`flex flex-col h-screen border-r border-ps-edge transition-all duration-200 fixed inset-y-0 left-0 z-[60] w-56 bg-ps-surface-panel transform ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:static lg:z-auto lg:translate-x-0 ${iconsOnly ? "lg:w-16" : "lg:w-56"}`}
      >
        {/* Logo — min-height matches main app chrome (see --ps-shell-header-min-height) */}
        <div className="px-4 min-h-[var(--ps-shell-header-min-height)] flex items-center border-b border-ps-edge-hairline">
          <Link href="/" aria-label="PatterStage home" className="flex items-center gap-2" onClick={closeMobile}>
            <div className="w-8 h-8 rounded-ps-md animated-border p-[1.5px]">
              <div className="w-full h-full bg-ps-surface-panel rounded-ps-sm flex items-center justify-center">
                <Terminal className="w-4 h-4 text-neon-cyan" />
              </div>
            </div>
            {!iconsOnly && (
              <div className="leading-tight">
                <div className="text-body font-bold tracking-tight text-ps-text-primary">
                  PatterStage
                </div>
                <div className="text-body text-ps-text-muted mt-0.5">
                  The Stage is{" "}
                  <span className="font-bold text-neon-cyan text-glow-cyan">Yours</span>
                </div>
              </div>
            )}
          </Link>
        </div>

        {/* The five sections. Home carries no heading: it is where the rail
            starts, and its Quests and Help rows sit in the footer below as the
            plan's utility rows. Every pixel here is budgeted: the rail must
            fit 720px without scrolling (tests/e2e/rail-no-scroll.spec.ts). */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto" aria-label="Main">
          {mainSections.map((section) => (
            <div key={section.label}>
              {section.label !== "Home" && !iconsOnly && (
                <div className="text-micro leading-4 font-mono text-ps-text-muted uppercase tracking-widest px-3 mb-0.5 mt-1.5">
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
