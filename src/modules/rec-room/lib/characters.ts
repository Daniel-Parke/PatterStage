// ═══════════════════════════════════════════════════════════════
// characters.ts — bound the character list before anything reads it
//
// `POST /api/stories` has no schema for `config.characters`, and TWO consumers
// cast it straight to objects: the master-prompt builder and the story-arc
// fallback. A caller that writes `characters: ["QA-Bot"]` -- which reads as
// perfectly reasonable -- therefore produces
//
//   - undefined (undefined): undefined
//
// in the prompt sent to the model, and `{ name: undefined }` in the persisted
// arc (T-0079).
//
// This is the same fix as `chapter-title.ts` in this directory, for the same
// reason: bound an untrusted field ONCE at the boundary rather than trusting a
// cast at each place that reads it.
// ═══════════════════════════════════════════════════════════════

/** A character as the prompt builder and the arc fallback expect to find it. */
export interface StoryCharacter {
  name: string;
  role?: string;
  description?: string;
  [key: string]: unknown;
}

/**
 * Normalise whatever arrived in `config.characters` into objects with a name.
 *
 * A bare string is a name — that is plainly what the caller meant. Anything
 * with no usable name is DROPPED rather than passed through, because a
 * character the prompt cannot describe contributes nothing but the word
 * "undefined" three times.
 */
export function normaliseStoryCharacters(raw: unknown): StoryCharacter[] {
  if (!Array.isArray(raw)) return [];
  const out: StoryCharacter[] = [];
  for (const entry of raw) {
    if (typeof entry === "string") {
      const name = entry.trim();
      if (name) out.push({ name });
      continue;
    }
    if (entry && typeof entry === "object") {
      const obj = entry as Record<string, unknown>;
      const name = typeof obj.name === "string" ? obj.name.trim() : "";
      if (name) out.push({ ...obj, name } as StoryCharacter);
    }
  }
  return out;
}
