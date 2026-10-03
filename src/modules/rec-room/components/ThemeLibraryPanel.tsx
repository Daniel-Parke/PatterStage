// ── ThemeLibraryPanel — the saved themes, on the Create page.
//
// The Themes page was a grid of these with Use, Edit and Delete, reached by
// leaving the form you were filling in. Create already listed them to load
// one and to delete one; the two missing verbs, make and edit, are the
// dialog. So the page goes and the list stays where it was used (decision 6,
// T-0126). The read contract holds here as it did there: a failed read is an
// error with Retry inside the panel, never "no saved themes yet" — and it
// holds in LibraryPanel, the shelf this shares with the characters (C8,
// T-0146). What is left here is the theme.

"use client";

import { ArrowRight, FileText } from "lucide-react";

import Badge from "@/components/ui/Badge";
import LibraryPanel from "@/modules/rec-room/components/LibraryPanel";
import type { StoryTheme } from "@/modules/rec-room/types";

export interface ThemeLibraryPanelProps {
  themes: StoryTheme[];
  loading: boolean;
  error: string | null;
  /** The theme the form is currently built from, if any. */
  selectedId: string;
  onRetry: () => void;
  onUse: (theme: StoryTheme) => void;
  onEdit: (theme: StoryTheme) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

export default function ThemeLibraryPanel({
  themes, loading, error, selectedId, onRetry, onUse, onEdit, onDelete, onNew,
}: ThemeLibraryPanelProps) {
  return (
    <LibraryPanel<StoryTheme>
      id="themes"
      heading="Saved themes"
      newLabel="New theme"
      color="green"
      noun="theme"
      empty={{
        icon: FileText,
        title: "No saved themes yet",
        description: "Save a premise and its tags once, and start any later story from it.",
      }}
      items={themes}
      loading={loading}
      error={error}
      onRetry={onRetry}
      onNew={onNew}
      row={(t) => ({
        key: t.id,
        name: t.name,
        body: (
          <>
            <div className="flex items-center gap-2">
              <span className="text-body font-semibold text-ps-text-primary">{t.name}</span>
              {t.id === selectedId && <Badge color="green">In use</Badge>}
            </div>
            <div className="mt-0.5 font-mono text-micro text-ps-text-muted">
              {[...(t.genre ?? []), t.era].filter(Boolean).join(" · ") || "Custom"}
            </div>
            {t.premise && <p className="mt-1 line-clamp-2 text-body text-ps-text-secondary">{t.premise}</p>}
          </>
        ),
        action: { icon: ArrowRight, label: "Use", ariaLabel: `Use theme ${t.name}`, onClick: () => onUse(t) },
        onEdit: () => onEdit(t),
        onDelete: () => onDelete(t.id),
      })}
    />
  );
}
