// ═══════════════════════════════════════════════════════════════
// SettingsNav — the sticky section nav down the right of Settings
//
// From lg: every section by group and the three pages that are not
// sections, in a column that stays put while the page scrolls and marks the
// section in view. Below lg it was one row running off the right edge with
// no scroll affordance (the review of 2026-09-08); it is a select now,
// "Jump to section", that moves the page, with the three pages as links
// beside it (T-0133).
// ═══════════════════════════════════════════════════════════════

"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

import { InlineSelect } from "@/components/ui/Select";
import type { SettingsTool } from "@/lib/config/config-sections";
import type { SectionDef } from "@/lib/config/config-schema";

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

  useEffect(() => {
    if (!activeId || !navRef.current) return;
    const link = navRef.current.querySelector<HTMLAnchorElement>(`a[href="#${activeId}"]`);
    if (link && typeof link.scrollIntoView === "function") {
      link.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [activeId]);

  const options = groups.flatMap((group) => group.sections.map((s) => ({ value: s.id, label: s.label })));
  const selected = activeId && options.some((o) => o.value === activeId) ? activeId : (options[0]?.value ?? "");

  return (
    <nav
      ref={navRef}
      aria-label="Settings sections"
      className="lg:sticky lg:top-[calc(var(--ps-shell-header-min-height)_+_1.5rem)] lg:max-h-[calc(100vh_-_var(--ps-shell-header-min-height)_-_3rem)] lg:overflow-y-auto"
    >
      {/* Below lg: the select, and the pages as links. The page's hashchange
          listener does the jump. */}
      <div className="flex flex-wrap items-center gap-3 lg:hidden">
        <InlineSelect
          ariaLabel="Jump to section"
          value={selected}
          options={options}
          onChange={(id) => {
            window.location.hash = id;
          }}
          className="min-w-[14rem]"
        />
        {tools.map((tool) => (
          <Link key={tool.href} href={tool.href} className={`${LINK} whitespace-nowrap text-ps-text-muted`}>
            {tool.label}
          </Link>
        ))}
      </div>

      <div className="hidden lg:block lg:space-y-4">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-1 font-mono text-micro uppercase tracking-widest text-ps-text-faint">{group.label}</p>
            <ul className="space-y-0.5">
              {group.sections.map((section) => {
                const active = section.id === activeId;
                return (
                  <li key={section.id}>
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
        <div className="border-t border-ps-edge-hairline pt-3">
          <p className="mb-1 font-mono text-micro uppercase tracking-widest text-ps-text-faint">Pages</p>
          <ul className="space-y-0.5">
            {tools.map((tool) => (
              <li key={tool.href}>
                <Link href={tool.href} className={`${LINK} whitespace-nowrap text-ps-text-muted`}>
                  {tool.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}
