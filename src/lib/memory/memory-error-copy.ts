// memory-error-copy.ts: the sentences the memory surface says when it cannot
// serve a request, in one place because three surfaces read them (the store
// toast, the health banner in the provider card, the dashboard's Memory row),
// so a sentence true in only one is a bug in the other two.
//
// Two rules, both learned the hard way. NAME AN ACTION, NOT A DESTINATION: the
// copy once said "in the memory provider card", and HealthBanner is rendered
// INSIDE that card (MemoryProviderSettings.tsx is its only call site), so it
// sent the reader where they already stood; naming Host, Port and Save works
// from every reader. PROMISE ONLY CONTROLS THAT EXIST: it also said "Choose a
// different provider", and there is no provider chooser in src/components/memory
// (Save posts `type: current.type`; config-schema.ts renders `memory.provider`
// read-only). A state with no remedy says so plainly instead of inventing one.

import type { MemoryProviderType } from "./memory-providers/types";

/** The notices' openings, so the health banner can RECOGNISE them rather than
 * reprint a sentence about there being no provider as "Hindsight: <sentence>". */
const NO_PROVIDER_STEM = "No memory provider is configured";
const NO_CLIENT_STEM = "PatterStage has no client for";

/**
 * What happened, then what to do, for a provider that can serve nothing. "No
 * memory provider is configured." alone reached a person who had just pressed
 * Store and named no next action. The `none` branch names Host, Port and Save
 * because Save writes `enabled: true` for the active row; the no-client branch
 * names no remedy because the product has none.
 */
export function memoryUnavailableMessage(type: MemoryProviderType): string {
  return type === "none"
    ? `${NO_PROVIDER_STEM}, so there is nothing to store or search. ` +
        "Set Host and Port on the Memory page and press Save to switch one on."
    : `${NO_CLIENT_STEM} the '${type}' memory provider yet, so it cannot store ` +
        "or search from here. Nothing on the agent side is affected: what is " +
        "missing is a PatterStage client, not the memory itself.";
}

/** Is this string one of the notices above, rather than a provider's own words? */
export function isMemoryUnavailableMessage(text: string): boolean {
  return text.startsWith(NO_PROVIDER_STEM) || text.startsWith(NO_CLIENT_STEM);
}

/**
 * What a transport failure looks like on the wire: nothing listening answers
 * "fetch failed" (Node's phrasing) from the health route and, with undici's
 * cause appended, from the store route. Deliberately the ONE heuristic the
 * banner and the store route share, so one outage cannot be described two ways.
 */
const TRANSPORT_ERRORS = ["fetch failed", "ECONNREFUSED", "Connection refused", "ETIMEDOUT"];

/** Did the request fail to reach a provider at all? */
export function isMemoryTransportFailure(text: string): boolean {
  return TRANSPORT_ERRORS.some((token) => text.includes(token));
}

/**
 * The commonest failure: a provider is configured and not running. It says the
 * two fixes in the order a person tries them. No "configured above": the banner
 * renders ABOVE the Host and Port fields, and a toast has no above. The last
 * clause tells a first-run reader that no provider is a supported state.
 */
export const MEMORY_NOT_ANSWERING =
  "No memory provider is answering at the configured host and port. " +
  "Start your memory provider, or correct Host and Port on the Memory page and press Save. " +
  "PatterStage works without one; memory stays empty until a provider is running.";

/** Only a bare transport failure is replaced; a provider that explained itself is quoted verbatim. */
export function memoryFailureMessage(raw: string): string {
  return isMemoryTransportFailure(raw) ? MEMORY_NOT_ANSWERING : raw;
}
