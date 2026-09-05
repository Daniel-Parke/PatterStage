// ═══════════════════════════════════════════════════════════════
// boot-diagnostics.ts — one line saying how this instance is configured.
//
// A live QA pass lost THREE sessions to silent flag loss. An external watchdog
// restarted the server without the session's environment, nothing on screen or
// in the log said the mode had changed, and one session produced a finding that
// had to be retracted: "read-only lets writes through". It did not. The variable
// was simply gone, and there was no way to tell from inside the product.
//
// That is not only a QA problem. An operator who sets PS_READ_ONLY in one shell
// and restarts from another has exactly the same blind spot, and the flags here
// are the ones that change what the product DOES: whether writes are refused,
// whether the deploy buttons work, whether anything is authenticated at all,
// whether a whole section of the nav exists, and which agent it is talking to.
//
// PRINTED, NOT LOGGED CONDITIONALLY. A diagnostic that only appears when
// something is wrong cannot be used to establish that nothing is.
//
// NO SECRETS. This line is meant to be pasted into a bug report, so it names
// whether a token exists and never what it is. `HERMES_GATEWAY_URL` is an
// address, not a credential, and an override is invisible without it: the QA
// pass ran its mock on :8643 and spent time confused about which gateway a
// finding belonged to.
// ═══════════════════════════════════════════════════════════════

import { isDeployApiEnabled } from "@/lib/api-auth";
import { readEnv } from "@/lib/paths";
import { isReadOnly } from "@/lib/read-only";

function onOff(value: boolean): string {
  return value ? "on" : "off";
}

/**
 * The operational flags, as one line for the boot log.
 *
 * `deploy-api` is read from the guard itself, `isDeployApiEnabled` in
 * api-auth, so the line cannot claim a state the guard does not enforce. This
 * file used to carry a mirror of that rule; two copies of one rule is how a
 * boot line and a 403 come to disagree (T-0095).
 */
export function describeOperationalFlags(): string {
  const deployApi = isDeployApiEnabled();

  const authMode = readEnv("PS_AUTH_MODE")?.toLowerCase() === "none" ? "NONE" : "token";
  const composerRaw = readEnv("PS_COMPOSER")?.toLowerCase();
  const composer = composerRaw === "0" || composerRaw === "false" ? "off" : "on";
  const gateway = readEnv("HERMES_GATEWAY_URL") ?? "default";

  return [
    `read-only=${onOff(isReadOnly())}`,
    `deploy-api=${onOff(deployApi)}`,
    `auth=${authMode}`,
    `composer=${composer}`,
    `gateway=${gateway}`,
  ].join("  ");
}
