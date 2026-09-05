// ═══════════════════════════════════════════════════════════════
// Sidebar Navigation — main nav + config groups + deploy footer.
// The branch dropdown, version/deploy footer, and collapsible config group
// are extracted to sibling files (BranchDropdown / VersionFooter /
// ConfigGroupSection); this file owns the layout + link rendering.
//
// Two things a keyboard user meets here (T-0096):
//   D119: every link carries its label as an accessible name, so the
//         collapsed rail is thirty named links rather than thirty "link"s.
//   D120: the mobile drawer is `inert` while closed (a transform only moves
//         it off screen and leaves every link in the tab order), and a dialog
//         on the shared contract while open, above the header it slides over.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, ChevronLeft, Terminal, Settings } from "lucide-react";

import { useSidebar } from "./SidebarContext";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import { iconColorMap } from "@/lib/theme";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { mainSections, configSettingsPinnedLinks, configGroups } from "./sidebar-config";
import type { SidebarLink } from "./sidebar-config";
import { VersionFooter } from "./VersionFooter";
import { ConfigGroupSection } from "./ConfigGroupSection";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { mobileOpen, setMobileOpen } = useSidebar();
  const { data: flags } = useFeatureFlags();
  const closeMobile = useCallback(() => setMobileOpen(false), [setMobileOpen]);
  const drawerRef = useDialogA11y({ open: mobileOpen, onClose: closeMobile });

  // Flags default ON: hide a link only when its flag is explicitly disabled,
  // so the nav never flashes while flags load (or if the fetch fails).
  const linkVisible = useCallback(
    (link: SidebarLink) => !link.featureFlag || flags?.[link.featureFlag] !== false,
    [flags],
  );

  const renderLink = useCallback(
    (link: SidebarLink) => {
      const active = isActive(pathname, link.href);
      const showSubs = active && link.subLinks && !collapsed;

      return (
        <div key={link.href}>
          <Link
            href={link.href}
            aria-label={link.label}
            title={collapsed ? link.label : undefined}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              active ? "bg-white/10 text-white" : "text-ps-text-muted hover:bg-white/5 hover:text-ps-text-primary"
            }`}
            onClick={closeMobile}
          >
            <link.icon
              className={`w-4 h-4 flex-shrink-0 ${active ? iconColorMap[link.color] : ""}`}
            />
            {!collapsed && <span>{link.label}</span>}
          </Link>
          {showSubs && (
            <div className="ml-7 mt-1 space-y-0.5 border-l border-white/5 pl-3">
              {link.subLinks!.map((sub) => (
                <Link
                  key={sub.href}
                  href={sub.href}
                  className={`block py-1 text-xs transition-colors ${
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
    [pathname, collapsed, closeMobile],
  );

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo — min-height matches main app chrome (see --ps-shell-header-min-height) */}
      <div className="px-4 min-h-[var(--ps-shell-header-min-height)] flex items-center border-b border-white/10">
        <Link href="/" aria-label="PatterStage home" className="flex items-center gap-2" onClick={closeMobile}>
          <div className="w-8 h-8 rounded-lg animated-border p-[1.5px]">
            <div className="w-full h-full bg-dark-900 rounded-[5px] flex items-center justify-center">
              <Terminal className="w-4 h-4 text-neon-cyan" />
            </div>
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-tight text-white">
                PatterStage
              </div>
              <div className="text-xs text-ps-text-muted mt-0.5">
                The Stage is{" "}
                <span className="font-bold text-neon-cyan text-glow-cyan">Yours</span>
              </div>
            </div>
          )}
        </Link>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Main">
        {/* Main + Agent sections */}
        {mainSections.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <div className="text-xs font-mono text-ps-text-muted uppercase tracking-widest px-3 mb-2 mt-4 first:mt-0">
                {section.label}
              </div>
            )}
            {section.links.filter(linkVisible).map(renderLink)}
          </div>
        ))}

        {/* Config Settings section */}
        {!collapsed && (
          <div className="text-xs font-mono text-ps-text-muted uppercase tracking-widest px-3 mb-2 mt-4">
            Config Settings
          </div>
        )}
        {collapsed && <div className="my-2 border-t border-white/10" />}
        {configSettingsPinnedLinks.map((link) => renderLink(link))}

        {/* All Settings link */}
        {renderLink({ icon: Settings, label: "All Settings", href: "/config", color: "purple" })}

        {/* Grouped config sections */}
        {configGroups.map((group) => (
          <ConfigGroupSection
            key={group.label}
            group={group}
            collapsed={collapsed}
            renderLink={renderLink}
            pathname={pathname}
          />
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-white/10 space-y-2 flex-shrink-0">
        <VersionFooter collapsed={collapsed} />
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-ps-text-muted hover:text-ps-text-secondary hover:bg-white/5 transition-colors font-mono"
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
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile backdrop: a real control with a name, not a div with a click
          handler, so it is reachable and announced. Above the header (z-50). */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={closeMobile}
          className="lg:hidden fixed inset-0 bg-black/60 z-[55] cursor-default"
        />
      )}

      {/* Sidebar — desktop */}
      <aside
        className={`hidden lg:flex flex-col bg-dark-900/80 border-r border-white/10 backdrop-blur-xl transition-all duration-200 h-screen ${
          collapsed ? "w-16" : "w-56"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Sidebar — mobile drawer. `inert` while closed takes its thirty links
          out of the tab order; open, it is the dialog the hook governs. */}
      <aside
        ref={drawerRef as React.RefObject<HTMLElement | null>}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        tabIndex={-1}
        inert={!mobileOpen}
        aria-hidden={!mobileOpen}
        className={`lg:hidden fixed inset-y-0 left-0 z-[60] w-56 bg-dark-950 border-r border-white/10 transform transition-transform h-screen ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
