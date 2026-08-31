// ═══════════════════════════════════════════════════════════════
// profile-options — the Composer profile picker's option list
//
// Two lines lifted out of the Composer page so the thing they decide is
// something a test can hold: which IDENTIFIER a launched run is attributed to.
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

export function profileOptionsFor(profiles: PickableProfile[] | undefined): ProfileOption[] {
  return [
    { value: "", label: "Default profile" },
    ...(profiles ?? []).map((p) => ({ value: p.name, label: p.name })),
  ];
}
