// ═══════════════════════════════════════════════════════════════
// profileSyncBody — shared body shape for /api/agent/profiles/sync/*
// ═══════════════════════════════════════════════════════════════
//
// Both the push and pull sync endpoints accept one of two body shapes:
//   - { root: true } for the default (root) profile
//   - { slug: "<name>" } for a named profile
//
// This helper consolidates the logic so callers don't have to remember
// the discriminator. Used by Agent → Agents and Agent → Tools.

export type ProfileSyncBody = { root: true } | { slug: string };

export function profileSyncBody(profileId: string): ProfileSyncBody {
  return profileId === "default" ? { root: true } : { slug: profileId };
}
