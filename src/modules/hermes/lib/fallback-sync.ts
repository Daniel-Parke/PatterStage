import { listFallbackChain, getFallbackConfig } from "@/lib/fallbacks-repository";
import { syncFallbacksToHermesConfig } from "./hermes-fallback-config";
import { appendAuditLine } from "@/lib/audit-log";
import type { FallbackConfig } from "@/types/console";

export function syncEnabledFallbackChainToHermes(
  config: FallbackConfig
): { backupPath: string | null; configPath: string; hermesHome: string } | null {
  const chain = listFallbackChain()
    .filter((e) => e.enabled)
    .map((e) => ({
      modelId: e.modelIdString,
      provider: e.provider,
      baseUrl: null as string | null,
      overrideBaseUrl: e.overrideBaseUrl,
      apiKey: null as string | null,
    }));
  if (chain.length === 0) return null;
  return syncFallbacksToHermesConfig(chain, {
    restorePrimaryOnFallback: config.restorePrimaryOnFallback,
    fallbackNotification: config.fallbackNotification,
    apiMaxRetries: config.apiMaxRetries,
  });
}

/**
 * Apply a fallback-chain mutation's two side-effects: sync the chain to
 * Hermes and append an audit line. Centralises the boilerplate that was
 * duplicated across 5 routes (POST fallbacks, POST reorder, POST toggle,
 * POST custom, PUT/DELETE [id]).
 *
 *   try {
 *     const entry = addFallbackEntry(...);
 *     commitFallbackChange("fallback.add", entry.id);
 *     return NextResponse.json(...);
 *   } catch (error) { ... }
 *
 * Both `appendAuditLine` and `syncEnabledFallbackChainToHermes` are
 * non-throwing (audit has an internal try/catch; sync returns null on an
 * empty chain), so this helper itself never throws.
 */
export function commitFallbackChange(
  action: string,
  resource: string
): void {
  syncEnabledFallbackChainToHermes(getFallbackConfig());
  appendAuditLine({ action, resource, ok: true });
}
