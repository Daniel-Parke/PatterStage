// ═══════════════════════════════════════════════════════════════
// /agent/settings/<slug> — the way to a section, for a slug that is not one
//
// The section editor lived here, twenty-seven times over. Since decision 7
// (T-0125) every section is on the Settings page, and the twenty-seven real
// slugs answer a 307 to their anchor from next.config.ts before this file is
// involved. What reaches here is a slug the server did not recognise: a
// section id typed by hand and slightly wrong, or nonsense.
//
// A near miss is sent to the section it obviously meant (T-0038): the singular
// /model, the kebab-cased /session-reset, the label the operator actually read
// on the card. A miss that is not near gets the whole list, one link per
// section, rather than a slug echoed back and a Back link to go and guess
// again. A valid id that reaches here by a client-side navigation goes to its
// anchor the same way.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";

import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import { CONFIG_SECTIONS, getSectionDef, resolveSectionRedirect } from "@/lib/config/config-schema";
import { iconColorMap } from "@/lib/ui/theme";

function UnknownConfigSection({ slug }: { slug: string }) {
  return (
    <AppPageShell
      header={
        <PageHeader
          icon={AlertCircle}
          title="Unknown Config Section"
          subtitle="Pick the section you meant"
          color="orange"
          backHref="/agent/settings"
          backLabel="SETTINGS"
        />
      }
    >
      <p className="font-mono text-body text-ps-text-muted">
        No config section is called <code className="text-ps-text-primary">{slug}</code>. These are the
        ones there are.
      </p>
      <ul className="divide-y divide-ps-edge-hairline overflow-hidden rounded-ps-lg border border-ps-edge-hairline">
        {Object.entries(CONFIG_SECTIONS).map(([id, section]) => {
          const SectionIcon = section.icon;
          return (
            <li key={id}>
              <Link
                href={`/agent/settings#${id}`}
                className="flex items-center gap-3 px-4 py-2.5 text-body text-ps-text-primary transition-colors hover:bg-ps-surface-raised"
              >
                <SectionIcon className={`h-4 w-4 shrink-0 ${iconColorMap[section.color]}`} />
                <span className="truncate">{section.label}</span>
                <span className="ml-auto font-mono text-micro text-ps-text-faint">{id}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </AppPageShell>
  );
}

export default function ConfigSectionPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.section as string;
  // A known id goes to its anchor; a near miss to the anchor it meant; the
  // model alias to its page. `resolveSectionRedirect` returns null for a
  // valid id, so the first branch is the one that answers it.
  const target = getSectionDef(slug) ? `/agent/settings#${slug}` : resolveSectionRedirect(slug);

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  if (target) {
    // While a replace is in flight, show nothing that invites a second click.
    return (
      <div className="grid-bg flex min-h-screen items-center justify-center bg-ps-surface-ground">
        <p className="font-mono text-ps-text-muted">Redirecting…</p>
      </div>
    );
  }
  return <UnknownConfigSection slug={slug} />;
}
