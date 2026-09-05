// ═══════════════════════════════════════════════════════════════
// providers.ts — Authoritative provider list and env-var map
// ═══════════════════════════════════════════════════════════════
//
// Single source of truth for which providers Hermes accepts and the
// environment variable names it reads each provider's API key from.
//
// Mirrors the `--provider` choices in
//   hermes-agent/hermes_cli/main.py (chat_parser.add_argument)
// plus auxiliary-only providers documented in the user guide. Adding a
// new provider here is the only file change needed to teach PatterStage
// about it.

/**
 * Hermes-recognised inference providers. The first 14 must stay in
 * lock-step with the `hermes chat --provider` argparse `choices=[...]`
 * list (excluding "auto"). Auxiliary-only providers from the user-guide
 * docs follow.
 */
export const HERMES_PROVIDERS = [
  "openrouter",
  "openai-codex",
  "copilot-acp",
  "copilot",
  "anthropic",
  "gemini",
  "huggingface",
  "zai",
  "kimi-coding",
  "minimax",
  "minimax-cn",
  "kilocode",
  "xiaomi",
  // Auxiliary / direct-call providers
  "openai",
  "mistral",
  "groq",
  "deepseek",
  "azure-openai",
  "ollama",
  "lmstudio",
  "vllm",
  "custom",
  // OAuth-only providers (no API key env var needed)
  "nous",
] as const;

export type HermesProvider = (typeof HERMES_PROVIDERS)[number];

/**
 * Per-provider environment variable used by Hermes to read the API key.
 * Used by modules/hermes/lib/config-sync.ts (PR 5) when writing credentials to
 * ~/.hermes/.env.
 */
export const PROVIDER_ENV_VAR: Record<HermesProvider, string> = {
  openrouter: "OPENROUTER_API_KEY",
  "openai-codex": "OPENAI_API_KEY",
  "copilot-acp": "COPILOT_ACP_API_KEY",
  copilot: "COPILOT_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
  huggingface: "HUGGINGFACE_API_KEY",
  zai: "ZAI_API_KEY",
  "kimi-coding": "KIMI_API_KEY",
  minimax: "MINIMAX_API_KEY",
  "minimax-cn": "MINIMAX_CN_API_KEY",
  kilocode: "KILOCODE_API_KEY",
  xiaomi: "XIAOMI_API_KEY",
  openai: "OPENAI_API_KEY",
  mistral: "MISTRAL_API_KEY",
  groq: "GROQ_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  "azure-openai": "AZURE_OPENAI_API_KEY",
  ollama: "OLLAMA_API_KEY",
  lmstudio: "LMSTUDIO_API_KEY",
  vllm: "VLLM_API_KEY",
  custom: "CUSTOM_API_KEY",
  // OAuth-only — empty sentinel so callers know no env var exists
  nous: "",
};

export function isHermesProvider(provider: string): provider is HermesProvider {
  return (HERMES_PROVIDERS as readonly string[]).includes(provider);
}


/**
 * Providers Hermes can drive with no API key at all.
 *
 * Four are local or self-hosted endpoints, and `nous` authenticates by OAuth
 * through the Hermes CLI. The editor demanded a key for every new credential,
 * so pointing PatterStage at a local Ollama meant inventing one (T-0100, D15).
 *
 * Deliberately NOT derived from `PROVIDER_ENV_VAR`: `ollama` and `vllm` DO
 * have a variable, and an endpoint behind a proxy may want it set. Needing no
 * key and having nowhere to put one are different facts, and only `nous` is
 * the second.
 */
export const KEYLESS_PROVIDERS = ["ollama", "lmstudio", "vllm", "custom", "nous"] as const;

/** @public The narrowed type of a member of KEYLESS_PROVIDERS. */
export type KeylessProvider = (typeof KEYLESS_PROVIDERS)[number];

/**
 * True when this provider works without an API key.
 *
 * @public The membership test that goes with the exported list. The models
 * page hands the list itself to the editor (core may not import a module), so
 * the product asks the array; this is here so anything server-side asks the
 * same question the same way rather than open-coding an `includes`.
 */
export function isKeylessProvider(provider: string): provider is KeylessProvider {
  return (KEYLESS_PROVIDERS as readonly string[]).includes(provider);
}

/**
 * Returns the env var name for a given provider, or null if the provider
 * is not recognised by Hermes.
 */
export function envVarForProvider(provider: string): string | null {
  if (!isHermesProvider(provider)) return null;
  return PROVIDER_ENV_VAR[provider] ?? null;
}
