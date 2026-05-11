// ═══════════════════════════════════════════════════════════════
// hermes-providers.ts — Authoritative provider list and env-var map
// ═══════════════════════════════════════════════════════════════
//
// Single source of truth for which providers Hermes accepts and the
// environment variable names it reads each provider's API key from.
//
// Mirrors the `--provider` choices in
//   hermes-agent/hermes_cli/main.py (chat_parser.add_argument)
// plus auxiliary-only providers documented in the user guide. Adding a
// new provider here is the only file change needed to teach Control Hub
// about it.

/**
 * Task slots in the models registry. Mirrors the 12
 * `is_default_<task>` columns in migration 006_models_credentials.sql.
 * `agent` is the primary mission model; the remaining 11 are Hermes
 * auxiliary slots (config.yaml `auxiliary.<task>.*`).
 */
export const TASK_TYPES = [
  "agent",
  "hindsight",
  "compression",
  "vision",
  "web_extract",
  "session_search",
  "title_generation",
  "skills_hub",
  "mcp",
  "triage_specifier",
  "approval",
  "delegation",
] as const;

export type TaskType = (typeof TASK_TYPES)[number];

/**
 * Hermes-recognised inference providers. The first 14 must stay in
 * lock-step with the `hermes chat --provider` argparse `choices=[...]`
 * list (excluding "auto"). Auxiliary-only providers from the user-guide
 * docs follow.
 */
export const HERMES_PROVIDERS = [
  // chat --provider choices (excluding "auto")
  "openrouter",
  // "nous" removed — Nous Portal is not used; MiniMax is our sole provider
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
] as const;

export type HermesProvider = (typeof HERMES_PROVIDERS)[number];

/**
 * Per-provider environment variable used by Hermes to read the API key.
 * Used by hermes-config-sync.ts (PR 5) when writing credentials to
 * ~/.hermes/.env.
 */
export const PROVIDER_ENV_VAR: Record<HermesProvider, string> = {
  openrouter: "OPENROUTER_API_KEY",
  // "nous" removed — Nous Portal is not used
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
};

export function isHermesProvider(value: unknown): value is HermesProvider {
  return typeof value === "string" && (HERMES_PROVIDERS as readonly string[]).includes(value);
}

export function isTaskType(value: unknown): value is TaskType {
  return typeof value === "string" && (TASK_TYPES as readonly string[]).includes(value);
}

export function envVarForProvider(provider: HermesProvider): string {
  return PROVIDER_ENV_VAR[provider];
}
