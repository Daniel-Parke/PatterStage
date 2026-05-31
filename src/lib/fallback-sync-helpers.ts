import { listFallbackChain } from "@/lib/fallbacks-repository";
import { syncFallbacksToHermesConfig } from "@/lib/hermes-config-sync";
import type { FallbackConfig } from "@/types/hermes";

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
