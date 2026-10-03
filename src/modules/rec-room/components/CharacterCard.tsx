// CharacterCard — one member of a story's cast, on the Create page: a
// collapsed row that opens into the character's fields, with Save to Library
// and Remove at its foot. The fields are the Field kit's and the two actions
// are Buttons (U12, T-0126); the row itself stays a raw button, because a
// disclosure row with a name, a summary and a role has no primitive yet.

"use client";

import { ChevronDown, ChevronRight, Save, X } from "lucide-react";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { InlineSelect } from "@/components/ui/Select";
import { Field, Input, Textarea } from "@/components/ui/field";
import type { StoryCharacter } from "@/modules/rec-room/types";

const ROLES = ["protagonist", "ally", "antagonist", "supporting", "mystery"];

const DETAIL_FIELDS = [
  { field: "personality" as const, label: "Personality traits", ph: "e.g., Pragmatic, Protective, Stubborn — how they think and react" },
  { field: "appearance" as const, label: "Appearance", ph: "Physical description — build, features, distinguishing marks" },
  { field: "backstory" as const, label: "Backstory", ph: "Their history, motivations, what drives them..." },
  { field: "speechPatterns" as const, label: "Speech patterns", ph: "How they talk — formal, slang, accent, verbal tics" },
  { field: "relationships" as const, label: "Relationships", ph: "Connections to other characters — allies, enemies, bonds" },
];

export default function CharacterCard({ char, index, onUpdate, onRemove, onSave, saved, expanded, onToggle }: {
  char: StoryCharacter;
  index: number;
  onUpdate: (idx: number, field: keyof StoryCharacter, value: string) => void;
  onRemove: (idx: number) => void;
  onSave: (char: StoryCharacter) => void;
  saved: boolean;
  expanded: boolean;
  onToggle: (idx: number) => void;
}) {
  const canSave = Boolean(char.name.trim() && char.description.trim());
  const Chevron = expanded ? ChevronDown : ChevronRight;
  return (
    <Card variant="raised" padding="none" className="overflow-hidden">
      <button
        type="button"
        onClick={() => onToggle(index)}
        aria-expanded={expanded}
        className="flex min-h-12 w-full items-center gap-3 p-3 text-left transition-colors hover:bg-ps-surface-panel"
      >
        <Chevron className="h-4 w-4 shrink-0 text-ps-text-muted" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-semibold text-ps-text-primary">{char.name || "New character"}</span>
          {!expanded && char.description && (
            <span className="block truncate text-body text-ps-text-muted">{char.description}</span>
          )}
        </span>
        {/* Solid, not outline: this card sits on the raised rung, where the
            hairline an outline Badge draws is 1.11:1 and the live gate refuses
            it as an invisible boundary. */}
        <Badge color="purple">{char.role}</Badge>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-ps-edge-hairline p-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <Field label="Name">
              <Input value={char.name} onChange={(e) => onUpdate(index, "name", e.target.value)} placeholder="e.g. Mara Voss" className="font-semibold" />
            </Field>
            <div className="space-y-1">
              <span className="block text-micro font-medium uppercase tracking-wider text-ps-text-muted">Role</span>
              <InlineSelect
                ariaLabel="Role"
                accentColor="purple"
                value={char.role}
                onChange={(v) => onUpdate(index, "role", v)}
                options={ROLES.map((r) => ({ value: r, label: r }))}
              />
            </div>
          </div>

          <Field label="Description">
            <Textarea
              value={char.description}
              onChange={(e) => onUpdate(index, "description", e.target.value)}
              rows={2}
              placeholder="A brief summary of who they are..."
            />
          </Field>

          {DETAIL_FIELDS.map(({ field, label, ph }) => (
            <Field key={field} label={label}>
              <Textarea value={char[field] || ""} onChange={(e) => onUpdate(index, field, e.target.value)} rows={2} placeholder={ph} />
            </Field>
          ))}

          <div className="flex items-center gap-2 border-t border-ps-edge-hairline pt-3">
            <Button
              size="sm"
              color="green"
              variant={saved ? "primary" : "secondary"}
              icon={Save}
              disabled={!canSave}
              onClick={() => onSave(char)}
              title={canSave ? "Save this character to the library" : "A name and a description are needed first"}
            >
              {saved ? "Saved!" : "Save to Library"}
            </Button>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" icon={X} onClick={() => onRemove(index)}>
              Remove
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
