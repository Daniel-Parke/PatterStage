/**
 * The slug the ROOT agent answers to. It is not a profile: it has no row in
 * `agent_profiles` (the root lives in `agent_root`), and
 * `resolveProfileHermesHome("default")` returns the root Hermes home rather
 * than `profiles/default`. Anything that creates or renames a profile must
 * refuse it, or it writes over the operator's own agent (T-0061).
 */
export const DEFAULT_PROFILE_SLUG = "default";

/** Hermes-compatible profile slug (lowercase). Matches hermes_cli profiles._PROFILE_ID_RE. */
const PROFILE_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export function isValidProfileSlug(slug: string): boolean {
  return PROFILE_SLUG_PATTERN.test(slug.trim());
}

/** The slug handed back when a name reduces to nothing. Reachable only from the
 *  non-API callers now; the API refuses such a name outright (T-0061). */
const FALLBACK_SLUG = "profile";

/** The slugification proper, with no fallback, so a caller can tell "this name
 *  produced nothing" from "this name produced the word profile". */
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
 * Windows refuses these as filenames whatever the extension, so a profile named
 * one of them creates a directory that cannot exist on half the supported
 * platforms. Checked on the derived slug rather than the raw name, because
 * "Con Artist" is a perfectly good name and slugifies to `con-artist`.
 */
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/;

/**
 * Judge the NAME the operator typed, before it is slugified.
 *
 * This exists because the validation that used to guard the create path could
 * never fire: it ran on the ALREADY-SLUGIFIED value, and every value
 * `slugifyDisplayName` can produce satisfies the slug pattern by construction.
 * So `../evil` was laundered into a legitimate-looking profile called `evil`,
 * and `..` into the literal fallback `profile`. The sanitiser had destroyed the
 * evidence the validator existed to inspect (T-0061).
 *
 * The rule is deliberately about intent, not about characters: a name that is
 * DECORATED with an emoji is fine and slugifies normally, while a name that
 * leaves nothing to slugify is refused rather than silently renamed to
 * `profile`, where two differently-named agents would collide on one slug and
 * the operator would be told a profile they never created already exists.
 */
export function validateProfileDisplayName(
  name: string,
): { ok: true } | { ok: false; error: string } {
  const trimmed = (name ?? "").trim();

  if (trimmed.length < 2) return { ok: false, error: "Name is required (min 2 characters)" };
  // NO SEPARATE ".." CHECK, and that is deliberate rather than an omission.
  // Mutation testing showed one added here was dead: every traversal-shaped name
  // is already refused by the separator check below or the leading-dot check
  // after it (".." and "../evil" start with a dot; "a/../b" carries a
  // separator). The only names it caught that they do not are shapes like
  // "a..b", which slugifies to "a-b" and is harmless, so the check refused safe
  // names and protected nothing.
  if (trimmed.includes("/") || trimmed.includes("\\")) {
    return { ok: false, error: "Name cannot contain a path separator" };
  }
  if (trimmed.startsWith(".")) {
    return { ok: false, error: "Name cannot start with a dot" };
  }
  // A literal control character in a name is never intentional and would reach a
  // directory name. Tested by code point rather than by a regex, so the rule
  // needs no eslint escape hatch to be readable.
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
