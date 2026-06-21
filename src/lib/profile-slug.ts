/** Hermes-compatible profile slug (lowercase). Matches hermes_cli profiles._PROFILE_ID_RE. */
const PROFILE_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export function isValidProfileSlug(slug: string): boolean {
  return PROFILE_SLUG_PATTERN.test(slug.trim());
}

/** Normalize display name to slug for create flows. */
export function slugifyDisplayName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!base) return "profile";
  const slug = base.slice(0, 64);
  return PROFILE_SLUG_PATTERN.test(slug) ? slug : slug.replace(/^[^a-z0-9]+/, "") || "profile";
}
