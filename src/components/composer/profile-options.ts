// ═══════════════════════════════════════════════════════════════
// profile-options — the Composer profile picker's option list
//
// Two lines lifted out of the Composer page so the thing they decide is
// something a test can hold: which IDENTIFIER a launched run is attributed to.
//
// They used to send `p.name` -- the DISPLAY name. A run launched under "Bob
// (local default)" stored that string in `runs.profile_name`, where every
// per-agent aggregate looks for a slug. The run was not mis-attributed; it
// matched nothing and was dropped from every number about that agent, which is
// one of the four causes behind the reported `runsCompleted: 0` (T-0081).
//
// The operator picks a name; the product sends the identifier.
// ═══════════════════════════════════════════════════════════════

/** The subset of a UI profile this picker needs. */
export interface PickableProfile {
  id: string;
  name: string;
}

export interface ProfileOption {
  value: string;
  label: string;
}

export function profileOptionsFor(
  profiles: PickableProfile[] | null | undefined,
): ProfileOption[] {
  return [
    { value: "", label: "Default profile" },
    ...(profiles ?? []).map((p) => ({ value: p.id, label: p.name })),
  ];
}
