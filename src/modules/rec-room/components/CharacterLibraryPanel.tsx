// ── CharacterLibraryPanel — the saved character sheets, on the Create page.
//
// The Characters page was this list with an editor, and Create reached it
// through "From Library", a button that opened a picker that listed the same
// sheets again: two clicks and a modal to add one character. The list is on
// the page now, and adding is one click on the row (decision 6, T-0126).

"use client";

import type { ComponentProps } from "react";
import { Edit2, Plus, Trash2, UserPlus, Users } from "lucide-react";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConfirmButton from "@/components/ui/ConfirmButton";
import { EmptyState } from "@/components/ui/EmptyState";
import IconButton from "@/components/ui/IconButton";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import Skeleton from "@/components/ui/Skeleton";
import { sectionHeadingClasses } from "@/lib/theme";
import type { CharacterSheet } from "@/modules/rec-room/types";

type BadgeColor = NonNullable<ComponentProps<typeof Badge>["color"]>;

/** A role's accent. The eight roles were eight raw palette classes on the old page. */
const ROLE_TONE: Record<string, BadgeColor> = {
  protagonist: "green",
  ally: "cyan",
  antagonist: "red",
  supporting: "gray",
  mystery: "purple",
  mentor: "orange",
  trickster: "pink",
  guardian: "cyan",
};

export interface CharacterLibraryPanelProps {
  characters: CharacterSheet[];
  loading: boolean;
  error: string | null;
  /** Whether a sheet is already in the story's cast, matched the way import always did: by name. */
  inCast: (character: CharacterSheet) => boolean;
  onRetry: () => void;
  onAdd: (character: CharacterSheet) => void;
  onEdit: (character: CharacterSheet) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

export default function CharacterLibraryPanel({
  characters,
  loading,
  error,
  inCast,
  onRetry,
  onAdd,
  onEdit,
  onDelete,
  onNew,
}: CharacterLibraryPanelProps) {
  return (
    <Card as="section" id="characters" padding="lg" className="scroll-mt-24 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className={`${sectionHeadingClasses} flex-1`}>
          Character library
        </h2>
        <Button size="sm" color="purple" icon={Plus} onClick={onNew}>
          New character
        </Button>
      </div>

      {error ? (
        <LoadErrorBanner compact error={error} onRetry={onRetry} />
      ) : loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : characters.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No saved characters yet"
          description="Save a character once and drop them into any story. Save to Library on a cast card does the same."
        />
      ) : (
        <ul className="divide-y divide-ps-edge-hairline">
          {characters.map((c) => {
            const already = inCast(c);
            const summary = c.description || c.backstory?.slice(0, 120) || "No description";
            return (
              <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-body font-semibold text-ps-text-primary">{c.name}</span>
                    <Badge color={ROLE_TONE[c.role] ?? "gray"}>{c.role}</Badge>
                    {c.tags.map((t) => (
                      <Badge key={t} color="gray" variant="outline">
                        {t}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-1 line-clamp-2 text-body text-ps-text-secondary">{summary}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    color="purple"
                    icon={UserPlus}
                    aria-label={`Add ${c.name} to the story`}
                    title={already ? `${c.name} is already in the story` : `Add ${c.name} to the story`}
                    disabled={already}
                    onClick={() => onAdd(c)}
                  >
                    {already ? "In the story" : "Add to story"}
                  </Button>
                  <IconButton icon={Edit2} label={`Edit character ${c.name}`} size="sm" onClick={() => onEdit(c)} />
                  <ConfirmButton
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete character ${c.name}`}
                    title="Delete character"
                    confirmLabel="Delete?"
                    onConfirm={() => onDelete(c.id)}
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
