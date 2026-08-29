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

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Access token: mint one on first boot so an existing install that predates
  // authentication is not locked out, and print the hand-off URL the way a
  // self-hosted tool should. src/proxy.ts enforces it on every request.
  try {
    const { ensureAuthToken, getAuthMode, getAuthTokenPath, TOKEN_QUERY_PARAM } =
      await import("@/lib/auth-token");
    if (getAuthMode() === "none") {
      console.warn(
        "[auth] PS_AUTH_MODE=none — every endpoint is UNAUTHENTICATED. Only correct behind your own access control.",
      );
    } else {
      const token = ensureAuthToken();
      const port = process.env.PORT ?? "3000";
      console.info(
        `[auth] Open PatterStage at http://127.0.0.1:${port}/?${TOKEN_QUERY_PARAM}=${token}\n` +
          `[auth] Token file: ${getAuthTokenPath()}`,
      );
    }
  } catch (error) {
    console.error("[auth] could not establish an access token", error);
  }

  // How this instance is configured, printed unconditionally beside the [auth]
  // line. A diagnostic that only appears when something is wrong cannot be used
  // to establish that nothing is, and three QA sessions were lost to a watchdog
  // restarting the server without their environment (T-0053).
  try {
    const { describeOperationalFlags } = await import("@/lib/boot-diagnostics");
    console.info(`[config] ${describeOperationalFlags()}`);
  } catch {
    /* non-fatal diagnostic */
  }

  // Loud warning if we may be reading the wrong (emptier) DB than a sibling data
  // dir — e.g. an empty ~/patterstage/data shadowing a populated ~/PatterStage.
  try {
    const { shadowedDataWarning } = await import("@/lib/paths");
    const warning = shadowedDataWarning();
    if (warning) console.warn(`[paths] ${warning}`);
  } catch {
    /* non-fatal diagnostic */
  }

  // Read-side sync layer (config / env / logs / sessions / memory drift sources).
  const { ensureSyncLayer } = await import("@/lib/sync");
  ensureSyncLayer();

  // Orchestration scheduler host (PatterStage-owned scheduling + run reconcile).
  const { ensureBackgroundScheduler } = await import("@/lib/orchestration");
  ensureBackgroundScheduler();

  // Zero-config deploy: seed the catalog (profiles, Baseline agent, bundled
  // skills + Hermes push, tool/memory catalogs) once if the installer's seed
  // step never ran. Idempotent + gated by a meta flag.
  const { ensureCatalogSeededOnce } = await import("@/lib/seed/catalog-seed");
  ensureCatalogSeededOnce();

  // Deep Research recovery: fail standalone research runs left 'running' by a
  // crashed/restarted process (fire-and-forget jobs have no in-process resume),
  // so the page doesn't spin forever on an interrupted run.
  try {
    const { failStuckResearchRuns } = await import("@/lib/laboratory/deep-research/research-repository");
    const failed = failStuckResearchRuns();
    if (failed > 0) console.warn(`[deep-research] failed ${failed} stuck research run(s) on boot`);
  } catch {
    /* non-fatal recovery */
  }

  // Chat recovery, the same shape and for the same reason. A fast-mode turn has
  // no run behind it, so reconcilePendingChatMessages cannot reach it: a tab
  // closed mid-stream left the row `streaming` for the life of the database.
  // Deep Research got this sweep years ago; chat never did (T-0052).
  try {
    const { failStuckChatMessages } = await import("@/lib/chat-repository");
    const failed = failStuckChatMessages();
    if (failed > 0) console.warn(`[chat] failed ${failed} interrupted chat turn(s) on boot`);
  } catch {
    /* non-fatal recovery */
  }
}
