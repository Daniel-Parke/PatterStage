// ── CharacterEditorDialog — make or change a saved character sheet.
//
// The Characters page's editor, kept whole when the page went (U12, T-0126):
// every field it offered is here, in a Dialog on the shared contract rather
// than a hand-rolled overlay. Mounted while open, so it owns its draft.

"use client";

import { useState } from "react";
import { Plus, Users, X } from "lucide-react";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import IconButton from "@/components/ui/IconButton";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { CharacterSheet } from "@/modules/rec-room/types";

export type SheetValues = Omit<CharacterSheet, "id" | "createdAt" | "updatedAt">;

const SHEET_ROLES = ["protagonist", "ally", "antagonist", "supporting", "mystery", "mentor", "trickster", "guardian"];

const EMPTY_SHEET: SheetValues = {
  name: "",
  role: "supporting",
  description: "",
  personality: [],
  backstory: "",
  appearance: "",
  speechPatterns: "",
  relationships: "",
  tags: [],
};

const PROSE_FIELDS: Array<{ key: keyof SheetValues & ("description" | "appearance" | "backstory" | "speechPatterns" | "relationships"); label: string; rows: number; placeholder: string }> = [
  { key: "description", label: "Description", rows: 2, placeholder: "Who they are, in a line or two" },
  { key: "appearance", label: "Appearance", rows: 2, placeholder: "Build, features, distinguishing marks" },
  { key: "backstory", label: "Backstory", rows: 3, placeholder: "Their history, their motivations, what drives them" },
  { key: "speechPatterns", label: "Speech patterns", rows: 2, placeholder: "How they talk: formal, slang, accent, catchphrases" },
  { key: "relationships", label: "Relationships", rows: 2, placeholder: "Connections to other characters" },
];

export interface CharacterEditorDialogProps {
  /** The sheet being edited, or null for a new one. */
  character: CharacterSheet | null;
  onClose: () => void;
  /** Writes it; answers an error message to show, or null when it succeeded. */
  onSave: (values: SheetValues, id?: string) => Promise<string | null>;
}

function valuesOf(c: CharacterSheet): SheetValues {
  return {
    name: c.name,
    role: c.role || "supporting",
    description: c.description ?? "",
    personality: [...(c.personality ?? [])],
    backstory: c.backstory ?? "",
    appearance: c.appearance ?? "",
    speechPatterns: c.speechPatterns ?? "",
    relationships: c.relationships ?? "",
    tags: [...(c.tags ?? [])],
  };
}

/** A list of short words the operator adds one at a time: traits, or tags. */
function WordList({
  label,
  words,
  placeholder,
  onChange,
}: {
  label: string;
  words: string[];
  placeholder: string;
  onChange: (words: string[]) => void;
}) {
  const [pending, setPending] = useState("");
  const add = () => {
    const word = pending.trim();
    if (!word) return;
    if (!words.includes(word)) onChange([...words, word]);
    setPending("");
  };
  return (
    <div className="space-y-2">
      {words.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {words.map((w) => (
            <Badge key={w} color="purple" className="gap-1 pr-0.5">
              {w}
              <IconButton icon={X} label={`Remove ${label.toLowerCase()} ${w}`} size="sm" onClick={() => onChange(words.filter((x) => x !== w))} />
            </Badge>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <Field label={label} className="flex-1">
          <Input
            value={pending}
            onChange={(e) => setPending(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder={placeholder}
          />
        </Field>
        <IconButton icon={Plus} label={`Add ${label.toLowerCase()}`} onClick={add} />
      </div>
    </div>
  );
}

export default function CharacterEditorDialog({ character, onClose, onSave }: CharacterEditorDialogProps) {
  const [draft, setDraft] = useState<SheetValues>(() => (character ? valuesOf(character) : { ...EMPTY_SHEET }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = draft.name.trim().length > 0;

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    const problem = await onSave({ ...draft, name: draft.name.trim() }, character?.id);
    setSaving(false);
    if (problem) setError(problem);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={character ? "Edit character" : "New character"}
      icon={Users}
      iconColor="text-neon-purple"
      size="lg"
      closeLabel="Close the character editor"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" color="purple" onClick={save} disabled={!canSave || saving} loading={saving}>
            Save character
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <LoadErrorBanner compact error={error} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. Mara Voss" />
          </Field>
          <div className="space-y-1">
            <span className="block text-micro font-medium uppercase tracking-wider text-ps-text-muted">Role</span>
            <Select
              ariaLabel="Role"
              value={draft.role}
              onChange={(role) => setDraft((d) => ({ ...d, role }))}
              options={SHEET_ROLES.map((r) => ({ value: r, label: r }))}
            />
          </div>
        </div>
        {PROSE_FIELDS.map((f) => (
          <Field key={f.key} label={f.label}>
            <Textarea
              rows={f.rows}
              value={draft[f.key]}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
            />
          </Field>
        ))}
        <WordList label="Personality trait" words={draft.personality} placeholder="e.g. stubborn" onChange={(personality) => setDraft((d) => ({ ...d, personality }))} />
        <WordList label="Tag" words={draft.tags} placeholder="e.g. noir" onChange={(tags) => setDraft((d) => ({ ...d, tags }))} />
      </div>
    </Dialog>
  );
}
