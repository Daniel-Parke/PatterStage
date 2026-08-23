// ═══════════════════════════════════════════════════════════════
// ConfigGroupSection — collapsible group of config links in the sidebar.
// Auto-expands when one of its links is the active route.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import type { SidebarLink, ConfigGroup } from "./sidebar-config";

export function ConfigGroupSection({
  group,
  collapsed,
  renderLink,
  pathname,
}: {
  group: ConfigGroup;
  collapsed: boolean;
  renderLink: (link: SidebarLink) => React.ReactNode;
  pathname: string;
}) {
  const [open, setOpen] = useState(() => {
    // Lazy init: auto-expand if any link in this group is active
    return (
      group.defaultOpen ??
      group.links.some(
        (link) =>
          pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href)),
      )
    );
  });

  if (collapsed) {
    return <>{group.links.map((link) => renderLink(link))}</>;
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 w-full text-xs font-mono text-ps-text-muted uppercase tracking-widest px-3 py-1.5 mb-1 mt-3 first:mt-0 hover:text-ps-text-secondary transition-colors"
      >
        <ChevronDown
          className={`w-3 h-3 transition-transform ${open ? "" : "-rotate-90"}`}
        />
        {group.label}
      </button>

      {open && (
        <div className="space-y-0.5">{group.links.map((link) => renderLink(link))}</div>
      )}
    </div>
  );
}
