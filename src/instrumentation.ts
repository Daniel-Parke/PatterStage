// ═══════════════════════════════════════════════════════════════
// instrumentation.ts — Next.js server boot hook
//
// register() runs once when the Next.js server process starts (next start /
// next dev), BEFORE any request is handled. We use it to boot PatterStage's
// traffic-independent background loops so that the PatterStage-owned scheduler
// fires on schedule even on a fully idle host — the previous design only
// ticked when an API route happened to call ensureSyncLayer(), which meant a
// scheduled mission at 03:00 on an idle box would never run.
//
// Gated to the Node.js runtime: the Edge runtime has no filesystem / SQLite.
// ═══════════════════════════════════════════════════════════════

import { serverLog } from "@/lib/logs/server-log";

let legacyBootWarningEmitted = false;

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Proxy, routes and streams read this one process-owned generation. A
  // missing generation denies browser-session access instead of recreating
  // state from a database row after a restart.
  const { initialiseBootState } = await import("@/lib/auth/boot-state");
  initialiseBootState();

  // Mint a token on first boot without placing it in persistent logs.
  try {
    const { ensureAuthToken, getAuthMode, describeTokenSource } =
      await import("@/lib/api/auth-token");
    if (getAuthMode() === "none") {
      serverLog("auth", "warn", "PS_AUTH_MODE=none — every endpoint is UNAUTHENTICATED. Only correct behind your own access control.",
      );
    } else {
      ensureAuthToken();
      const source = describeTokenSource();
      serverLog("auth", "info", source.kind === "file"
        ? `Read the operator token locally from ${source.location}, then sign in. The token is never printed here.`
        : "Read the operator token from your service's PS_AUTH_TOKEN secret source, then sign in. The token is never printed here.");
    }
  } catch (error) {
    serverLog("auth", "error", "could not establish an access token", error);
  }

  // How this instance is configured, printed unconditionally beside the [auth]
  // line. A diagnostic that only appears when something is wrong cannot be used
  // to establish that nothing is, and three QA sessions were lost to a watchdog
  // restarting the server without their environment (T-0053).
  try {
    const { describeOperationalFlags } = await import("@/lib/deploy/boot-diagnostics");
    const { getAgentGateway } = await import("@/lib/runtime/gateway");
    const configuredGateway = [process.env.HERMES_GATEWAY_URL, process.env.PS_LLM_API, process.env.CONTROL_HUB_LLM_API].some(value => value?.trim());
    serverLog("config", "info", `${describeOperationalFlags(configuredGateway ? getAgentGateway().baseUrl : undefined)}`);
  } catch {
    /* non-fatal diagnostic */
  }

  if (!legacyBootWarningEmitted) {
    const { describeLegacyBootWarning } = await import("@/lib/config/legacy-boot");
    const { selectedLegacyHermesHomeName } = await import("@/modules/hermes/lib/home");
    const hermesHomeName = selectedLegacyHermesHomeName(process.env);
    const warning = describeLegacyBootWarning(process.env, hermesHomeName ? [hermesHomeName] : []);
    // Another register() may have completed the same imports while this one
    // waited. Claim the one-time warning synchronously at the emission point.
    if (warning && !legacyBootWarningEmitted) {
      legacyBootWarningEmitted = true;
      serverLog("config", "warn", `${warning}`);
    }
  }

  // Loud warning if we may be reading the wrong (emptier) DB than a sibling data
  // dir — e.g. an empty ~/patterstage/data shadowing a populated ~/PatterStage.
  try {
    const { shadowedDataWarning } = await import("@/lib/host/paths");
    const warning = shadowedDataWarning();
    if (warning) serverLog("paths", "warn", `${warning}`);
  } catch {
    /* non-fatal diagnostic */
  }

  // Deep Research recovery: fail standalone research runs left 'running' by a
  // crashed/restarted process (fire-and-forget jobs have no in-process resume),
  // so the page doesn't spin forever on an interrupted run.
  try {
    const { failStuckResearchRuns } = await import("@/lib/laboratory/deep-research/research-repository");
    const failed = failStuckResearchRuns();
    if (failed > 0) serverLog("deep-research", "warn", `failed ${failed} stuck research run(s) on boot`);
  } catch {
    /* non-fatal recovery */
  }

  // Chat recovery, the same shape and for the same reason. A fast-mode turn has
  // no run behind it, so reconcilePendingChatMessages cannot reach it: a tab
  // closed mid-stream left the row `streaming` for the life of the database.
  // Deep Research got this sweep years ago; chat never did (T-0052).
  try {
    const { failStuckChatMessages } = await import("@/lib/chat/chat-repository");
    const failed = failStuckChatMessages();
    if (failed > 0) serverLog("chat", "warn", `failed ${failed} interrupted chat turn(s) on boot`);
  } catch {
    /* non-fatal recovery */
  }

  // Recovery must precede fallible startup. Startup errors still reject boot.
  const { ensureSyncLayer } = await import("@/lib/sync");
  ensureSyncLayer();

  const { ensureBackgroundScheduler } = await import("@/lib/orchestration");
  ensureBackgroundScheduler();

  // Seed once if the installer's explicit seed step never ran.
  const { ensureCatalogSeededOnce } = await import("@/lib/seed/catalog-seed");
  ensureCatalogSeededOnce();
}
