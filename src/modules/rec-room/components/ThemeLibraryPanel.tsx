// ── ThemeLibraryPanel — the saved themes, on the Create page.
//
// The Themes page was a grid of these with Use, Edit and Delete, reached by
// leaving the form you were filling in. Create already listed them to load
// one and to delete one; the two missing verbs, make and edit, are the
// dialog. So the page goes and the list stays where it was used (decision 6,
// T-0126). The read contract holds here as it did there: a failed read is an
// error with Retry inside the panel, never "no saved themes yet".

"use client";

import { ArrowRight, Edit2, FileText, Plus, Trash2 } from "lucide-react";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConfirmButton from "@/components/ui/ConfirmButton";
import { EmptyState } from "@/components/ui/EmptyState";
import IconButton from "@/components/ui/IconButton";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import Skeleton from "@/components/ui/Skeleton";
import { sectionHeadingClasses } from "@/lib/ui/theme";
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
  themes,
  loading,
  error,
  selectedId,
  onRetry,
  onUse,
  onEdit,
  onDelete,
  onNew,
}: ThemeLibraryPanelProps) {
  return (
    <Card as="section" id="themes" padding="lg" className="scroll-mt-24 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className={`${sectionHeadingClasses} flex-1`}>
          Saved themes
        </h2>
        <Button size="sm" color="green" icon={Plus} onClick={onNew}>
          New theme
        </Button>
      </div>

      {error ? (
        <LoadErrorBanner compact error={error} onRetry={onRetry} />
      ) : loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : themes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No saved themes yet"
          description="Save a premise and its tags once, and start any later story from it."
        />
      ) : (
        <ul className="divide-y divide-ps-edge-hairline">
          {themes.map((t) => {
            const inUse = t.id === selectedId;
            const meta = [...(t.genre ?? []), t.era].filter(Boolean).join(" · ") || "Custom";
            return (
              <li key={t.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-body font-semibold text-ps-text-primary">{t.name}</span>
                    {inUse && <Badge color="green">In use</Badge>}
                  </div>
                  <div className="mt-0.5 font-mono text-micro text-ps-text-muted">{meta}</div>
                  {t.premise && <p className="mt-1 line-clamp-2 text-body text-ps-text-secondary">{t.premise}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="sm" color="green" icon={ArrowRight} aria-label={`Use theme ${t.name}`} onClick={() => onUse(t)}>
                    Use
                  </Button>
                  <IconButton icon={Edit2} label={`Edit theme ${t.name}`} size="sm" onClick={() => onEdit(t)} />
                  <ConfirmButton
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete theme ${t.name}`}
                    title="Delete theme"
                    confirmLabel="Delete?"
                    onConfirm={() => onDelete(t.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </ConfirmButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
