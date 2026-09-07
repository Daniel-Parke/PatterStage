// ═══════════════════════════════════════════════════════════════
// SettingsNav — the sticky section nav down the right of Settings
//
// Twenty-seven sections in seven groups, as anchors, and the three pages that
// are not sections. On a wide screen it is a column that stays put while the
// sections scroll past it, with the one in view marked; on a narrow one it is
// a strip that scrolls sideways under the search box. One nav, not two: a
// second copy is twice the links for a screen reader to walk.
//
// The anchors are plain `<a href="#id">`. In-page navigation is what the
// browser already does well, and next/link would make it a route change.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

import type { SettingsTool } from "@/lib/config-sections";
import type { SectionDef } from "@/lib/config-schema";

interface SettingsNavGroup {
  label: string;
  sections: SectionDef[];
}

export interface SettingsNavProps {
  groups: SettingsNavGroup[];
  tools: readonly SettingsTool[];
  activeId: string | null;
}

const LINK = "block rounded-ps-sm px-2 py-1 text-body transition-colors hover:bg-ps-surface-raised hover:text-ps-text-primary";

export default function SettingsNav({ groups, tools, activeId }: SettingsNavProps) {
  const navRef = useRef<HTMLElement>(null);

  // The nav scrolls on its own when the list is taller than the viewport, so
  // the entry it marks current has to be brought into ITS view: a bookmark to
  // the twentieth section marked the twentieth entry and left the nav scrolled
  // to the first (T-0125). `nearest`, so a mark already in view moves nothing.
  useEffect(() => {
    if (!activeId || !navRef.current) return;
    const link = navRef.current.querySelector<HTMLAnchorElement>(`a[href="#${activeId}"]`);
    if (link && typeof link.scrollIntoView === "function") {
      link.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [activeId]);

  return (
    <nav
      ref={navRef}
      aria-label="Settings sections"
      className="flex gap-4 overflow-x-auto pb-2 lg:sticky lg:top-[calc(var(--ps-shell-header-min-height)_+_1.5rem)] lg:block lg:max-h-[calc(100vh_-_var(--ps-shell-header-min-height)_-_3rem)] lg:space-y-4 lg:overflow-y-auto lg:pb-0"
    >
      {groups.map((group) => (
        <div key={group.label} className="shrink-0">
          <p className="mb-1 hidden font-mono text-micro uppercase tracking-widest text-ps-text-faint lg:block">
            {group.label}
          </p>
          <ul className="flex gap-1 lg:block lg:space-y-0.5">
            {group.sections.map((section) => {
              const active = section.id === activeId;
              return (
                <li key={section.id} className="shrink-0">
                  <a
                    href={`#${section.id}`}
                    aria-current={active ? "true" : undefined}
                    className={`${LINK} whitespace-nowrap ${
                      active ? "bg-ps-surface-raised text-ps-text-primary" : "text-ps-text-muted"
                    }`}
                  >
                    {section.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="shrink-0 lg:border-t lg:border-ps-edge-hairline lg:pt-3">
        <p className="mb-1 hidden font-mono text-micro uppercase tracking-widest text-ps-text-faint lg:block">
          Pages
        </p>
        <ul className="flex gap-1 lg:block lg:space-y-0.5">
          {tools.map((tool) => (
            <li key={tool.href} className="shrink-0">
              <Link href={tool.href} className={`${LINK} whitespace-nowrap text-ps-text-muted`}>
                {tool.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
