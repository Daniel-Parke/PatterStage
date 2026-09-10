// ── LibraryPanel — the shelf both Create panels are.
//
// Saved themes and the character library were the same card written twice: a
// heading with a New button, the error / loading / empty / list ladder, and a
// row with a verb, an edit and a confirmed delete. Only the subject differed,
// so the subject is what arrives here. Both panels keep their own names and
// prop shapes: their callers and the U12 oracle name them (C8, T-0146).

"use client";

import type { ComponentType, ReactNode } from "react";
import { Edit2, Plus, Trash2 } from "lucide-react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConfirmButton from "@/components/ui/ConfirmButton";
import { EmptyState } from "@/components/ui/EmptyState";
import IconButton from "@/components/ui/IconButton";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import Skeleton from "@/components/ui/Skeleton";
import { sectionHeadingClasses } from "@/lib/ui/theme";
import type { AccentColor } from "@/types/console";

type Glyph = ComponentType<{ className?: string }>;

/** One entry: its left half, and the three things a row can do to it. */
export interface LibraryRow {
  key: string;
  /** The entry's own name, which is what the edit and delete labels are built from. */
  name: string;
  body: ReactNode;
  /** The row's first verb: use the theme, add the character to the story. */
  action: { icon: Glyph; label: string; ariaLabel: string; title?: string; disabled?: boolean; onClick: () => void };
  onEdit: () => void;
  onDelete: () => void;
}

export interface LibraryPanelProps<T> {
  /** The anchor the Create page's jump links land on. */
  id: string;
  heading: string;
  newLabel: string;
  /** The subject's accent, on the New button and on every row's verb. */
  color: AccentColor;
  /** The word the row's edit and delete labels are written with: a character, a theme. */
  noun: string;
  empty: { icon: Glyph; title: string; description: string };
  items: T[];
  loading: boolean;
  /** The read contract (T-0096): a failed read is the banner, never the empty state. */
  error: string | null;
  onRetry: () => void;
  onNew: () => void;
  row: (item: T) => LibraryRow;
}

export default function LibraryPanel<T>(props: LibraryPanelProps<T>) {
  const { color, empty } = props;
  return (
    <Card as="section" id={props.id} padding="lg" className="scroll-mt-24 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className={`${sectionHeadingClasses} flex-1`}>{props.heading}</h2>
        <Button size="sm" color={color} icon={Plus} onClick={props.onNew}>{props.newLabel}</Button>
      </div>

      {props.error ? (
        <LoadErrorBanner compact error={props.error} onRetry={props.onRetry} />
      ) : props.loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : props.items.length === 0 ? (
        <EmptyState icon={empty.icon} title={empty.title} description={empty.description} />
      ) : (
        <ul className="divide-y divide-ps-edge-hairline">
          {props.items.map((item) => {
            const { key, name, body, action, onEdit, onDelete } = props.row(item);
            return (
              <li key={key} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">{body}</div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    color={color}
                    icon={action.icon}
                    aria-label={action.ariaLabel}
                    title={action.title}
                    disabled={action.disabled}
                    onClick={action.onClick}
                  >
                    {action.label}
                  </Button>
                  <IconButton icon={Edit2} label={`Edit ${props.noun} ${name}`} size="sm" onClick={onEdit} />
                  <ConfirmButton
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete ${props.noun} ${name}`}
                    title={`Delete ${props.noun}`}
                    confirmLabel="Delete?"
                    onConfirm={onDelete}
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
