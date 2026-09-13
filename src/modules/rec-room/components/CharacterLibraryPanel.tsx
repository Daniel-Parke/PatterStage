// ── CharacterLibraryPanel — the saved character sheets, on the Create page.
//
// The Characters page was this list with an editor, and Create reached it
// through "From Library", a button that opened a picker that listed the same
// sheets again: two clicks and a modal to add one character. The list is on
// the page now, and adding is one click on the row (decision 6, T-0126).
// The shelf is LibraryPanel, shared with the themes (C8, T-0146); what is
// left here is the character.

"use client";

import type { ComponentProps } from "react";
import { UserPlus, Users } from "lucide-react";

import Badge from "@/components/ui/Badge";
import LibraryPanel from "@/modules/rec-room/components/LibraryPanel";
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
  characters, loading, error, inCast, onRetry, onAdd, onEdit, onDelete, onNew,
}: CharacterLibraryPanelProps) {
  return (
    <LibraryPanel<CharacterSheet>
      id="characters"
      heading="Character library"
      newLabel="New character"
      color="purple"
      noun="character"
      empty={{
        icon: Users,
        title: "No saved characters yet",
        description: "Save a character once and drop them into any story. Save to Library on a cast card does the same.",
      }}
      items={characters}
      loading={loading}
      error={error}
      onRetry={onRetry}
      onNew={onNew}
      row={(c) => {
        const already = inCast(c);
        return {
          key: c.id,
          name: c.name,
          body: (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-body font-semibold text-ps-text-primary">{c.name}</span>
                <Badge color={ROLE_TONE[c.role] ?? "gray"}>{c.role}</Badge>
                {c.tags.map((t) => (
                  <Badge key={t} color="gray" variant="outline">{t}</Badge>
                ))}
              </div>
              <p className="mt-1 line-clamp-2 text-body text-ps-text-secondary">
                {c.description || c.backstory?.slice(0, 120) || "No description"}
              </p>
            </>
          ),
          action: {
            icon: UserPlus,
            label: already ? "In the story" : "Add to story",
            ariaLabel: `Add ${c.name} to the story`,
            title: already ? `${c.name} is already in the story` : `Add ${c.name} to the story`,
            disabled: already,
            onClick: () => onAdd(c),
          },
          onEdit: () => onEdit(c),
          onDelete: () => onDelete(c.id),
        };
      }}
    />
  );
}
