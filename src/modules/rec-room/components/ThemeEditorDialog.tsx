// ── ThemeEditorDialog — make or change a saved theme.
//
// The Themes page's editor and Create's "Save as theme" prompt were two
// dialogs for one record: the first asked for everything, the second asked
// for a name and filled the rest in from the form. This is both, with the
// premise and the chips handed in as `initial` when it opens from the form
// (U12, T-0126). It is mounted while it is open and holds its own draft, so
// a parent re-render cannot reset what the operator is typing.

"use client";

import { useState } from "react";
import { FileText } from "lucide-react";

import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { Field, Input, Textarea } from "@/components/ui/field";
import Tags from "@/modules/rec-room/components/Tags";
import type { StoryTheme } from "@/modules/rec-room/types";

export type ThemeValues = Omit<StoryTheme, "id" | "createdAt" | "updatedAt">;

const EMPTY_THEME: ThemeValues = {
  name: "",
  premise: "",
  genre: [],
  era: "",
  setting: "",
  mood: [],
  notes: "",
};

/** The fixed chip sets the editor offers; Create's own rows also take custom values. */
export const THEME_GENRES = ["Sci-Fi", "Mystery", "Fantasy", "Romance", "Crime", "Horror", "Adventure", "Historical"];
export const THEME_ERAS = ["Ancient", "Medieval", "Modern", "Near Future", "Far Future", "Timeless"];
export const THEME_MOODS = ["Tense", "Wonder", "Humorous", "Dark", "Hopeful", "Melancholy", "Suspenseful", "Whimsical"];

export interface ThemeEditorDialogProps {
  /** The theme being edited, or null for a new one. */
  theme: StoryTheme | null;
  /** Values to start a NEW theme from: the form's premise and chips. */
  initial?: Partial<ThemeValues>;
  onClose: () => void;
  /** Writes it; answers an error message to show, or null when it succeeded. */
  onSave: (values: ThemeValues, id?: string) => Promise<string | null>;
}

function valuesOf(theme: StoryTheme): ThemeValues {
  return {
    name: theme.name,
    premise: theme.premise,
    genre: [...(theme.genre ?? [])],
    era: theme.era ?? "",
    setting: theme.setting ?? "",
    mood: [...(theme.mood ?? [])],
    notes: theme.notes ?? "",
  };
}

export default function ThemeEditorDialog({ theme, initial, onClose, onSave }: ThemeEditorDialogProps) {
  const [draft, setDraft] = useState<ThemeValues>(() => (theme ? valuesOf(theme) : { ...EMPTY_THEME, ...initial }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = draft.name.trim().length > 0 && draft.premise.trim().length > 0;

  const toggleIn = (field: "genre" | "mood", tag: string) =>
    setDraft((d) => ({ ...d, [field]: d[field].includes(tag) ? d[field].filter((t) => t !== tag) : [...d[field], tag] }));

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    const problem = await onSave({ ...draft, name: draft.name.trim() }, theme?.id);
    setSaving(false);
    if (problem) setError(problem);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={theme ? "Edit story theme" : "New story theme"}
      icon={FileText}
      iconColor="text-neon-green"
      size="lg"
      closeLabel="Close the theme editor"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" color="green" onClick={save} disabled={!canSave || saving} loading={saving}>
            Save theme
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <LoadErrorBanner compact error={error} />}
        <Field label="Name">
          <Input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="e.g. Salt and starlight"
          />
        </Field>
        <Field label="Premise">
          <Textarea
            rows={4}
            value={draft.premise}
            onChange={(e) => setDraft((d) => ({ ...d, premise: e.target.value }))}
            placeholder="What the story is about"
          />
        </Field>
        <Tags label="Genre" options={THEME_GENRES} selected={draft.genre} onToggle={(t) => toggleIn("genre", t)} />
        <Tags
          label="Era"
          options={THEME_ERAS}
          selected={draft.era ? [draft.era] : []}
          onToggle={(t) => setDraft((d) => ({ ...d, era: d.era === t ? "" : t }))}
        />
        <Tags label="Mood" options={THEME_MOODS} selected={draft.mood} onToggle={(t) => toggleIn("mood", t)} />
        <Field label="Setting">
          <Input
            value={draft.setting}
            onChange={(e) => setDraft((d) => ({ ...d, setting: e.target.value }))}
            placeholder="Where the story takes place"
          />
        </Field>
        <Field label="Notes" hint="For you. Notes are not carried into a story and never reach the model.">
          <Textarea
            rows={2}
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            placeholder="Character ideas, plot points, anything else"
          />
        </Field>
      </div>
    </Dialog>
  );
}
