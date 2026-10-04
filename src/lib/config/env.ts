/** Deprecated inputs retained through v1.0.0, in fallback order. */
export const PS_ENV_ALIASES = {
  PS_DATA_DIR: ["CH_DATA_DIR", "CONTROL_HUB_DATA_DIR"],
  PS_SCRIPTS_DIR: ["CH_SCRIPTS_DIR"],
  PS_HARDWARE_LOG_DIR: ["CH_HARDWARE_LOG_DIR"],
  PS_ENABLE_DEPLOY_API: ["CH_ENABLE_DEPLOY_API"],
  PS_REQUEST_SIGNING_SECRET: ["CH_REQUEST_SIGNING_SECRET"],
  PS_READ_ONLY: ["CH_READ_ONLY"],
  PS_RUN_MAX_MINUTES: ["CH_RUN_MAX_MINUTES"],
  PS_UPDATE_GIT_BRANCH: ["CH_UPDATE_GIT_BRANCH"],
  PS_PULL_RECONCILE_DISK: ["CH_PULL_RECONCILE_DISK"],
  PS_LLM_API: ["CONTROL_HUB_LLM_API"],
  PS_ALLOWED_DEV_ORIGINS: ["CH_ALLOWED_DEV_ORIGINS"],
  PORT: ["CONTROL_HUB_PORT"],
  // design-lint-disable-next-line hermes-outside-adapter -- canonical and legacy env-key metadata under cross-cutting-03b; no Hermes filesystem layout, path resolution or access.
  HERMES_HOME: ["AGENT_HOME"],
} as const;

/** Select the first nonempty trimmed value from explicit keys. */
export function readEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value && String(value).trim()) return String(value).trim();
  }
  return undefined;
}

/** Preserve raw truthy selection; each caller owns parsing and defaults. */
export function readAliasedEnv(canonical: keyof typeof PS_ENV_ALIASES): string | undefined {
  for (const key of [canonical, ...PS_ENV_ALIASES[canonical]]) {
    const value = process.env[key];
    if (value) return value;
  }
  return undefined;
}
