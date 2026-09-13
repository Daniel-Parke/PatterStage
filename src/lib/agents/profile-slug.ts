/**
 * The slug the ROOT agent answers to. Not a profile: no `agent_profiles` row,
 * and `resolveProfileHermesHome("default")` returns the root home. Anything
 * that creates or renames a profile must refuse it (T-0061).
 */
export const DEFAULT_PROFILE_SLUG = "default";

/** Hermes-compatible profile slug (lowercase). Matches hermes_cli profiles._PROFILE_ID_RE. */
const PROFILE_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export function isValidProfileSlug(slug: string): boolean {
  return PROFILE_SLUG_PATTERN.test(slug.trim());
}

/** Handed back when a name reduces to nothing; the API refuses such a name outright (T-0061). */
const FALLBACK_SLUG = "profile";

/** No fallback, so a caller can tell "produced nothing" from "produced the word profile". */
function slugifyRaw(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Normalize display name to slug for create flows. */
export function slugifyDisplayName(name: string): string {
  const base = slugifyRaw(name);
  if (!base) return FALLBACK_SLUG;
  const slug = base.slice(0, 64);
  return PROFILE_SLUG_PATTERN.test(slug) ? slug : slug.replace(/^[^a-z0-9]+/, "") || FALLBACK_SLUG;
}

/**
 * Windows refuses these as filenames, so the directory could not exist on half
 * the platforms. Checked on the slug, since "Con Artist" slugifies to `con-artist`.
 */
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/;

/**
 * Judge the NAME the operator typed, before it is slugified. The old check ran
 * on the ALREADY-SLUGIFIED value, which satisfies the pattern by construction,
 * so `../evil` was laundered into `evil` and `..` into the fallback `profile`
 * (T-0061). The rule is about intent, not characters: an emoji-decorated name
 * slugifies normally, while one that leaves nothing is refused rather than
 * renamed to `profile`, where two agents would collide on one slug.
 */
export function validateProfileDisplayName(
  name: string,
): { ok: true } | { ok: false; error: string } {
  const trimmed = (name ?? "").trim();

  if (trimmed.length < 2) return { ok: false, error: "Name is required (min 2 characters)" };
  // NO SEPARATE ".." CHECK, deliberately: mutation testing showed it dead. Every
  // traversal-shaped name is refused by the separator or leading-dot check, and
  // the rest ("a..b" → "a-b") are harmless, so it refused safe names and protected nothing.
  if (trimmed.includes("/") || trimmed.includes("\\")) {
    return { ok: false, error: "Name cannot contain a path separator" };
  }
  if (trimmed.startsWith(".")) {
    return { ok: false, error: "Name cannot start with a dot" };
  }
  // A control character is never intentional and would reach a directory name.
  // Tested by code point rather than regex, so the rule needs no eslint escape hatch.
  if ([...trimmed].some((ch) => (ch.codePointAt(0) ?? 0) < 0x20)) {
    return { ok: false, error: "Name cannot contain control characters" };
  }

  const slug = slugifyDisplayName(trimmed);
  if (slug === FALLBACK_SLUG && slugifyRaw(trimmed) === "") {
    return {
      ok: false,
      error: "Name must contain at least one letter or digit",
    };
  }
  if (WINDOWS_RESERVED.test(slug)) {
    return { ok: false, error: `Name produces "${slug}", which is a reserved device name on Windows` };
  }
  return { ok: true };
}
