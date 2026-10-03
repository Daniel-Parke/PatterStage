// Keep this selector aligned with the pre-rename readers until their
// post-v1.0.0 retirement. It reports names, never configuration values.

type Environment = Readonly<Record<string, string | undefined>>;
type Selection = { keys: readonly string[]; replacement: string; nonblank?: boolean; effective?: (value: string) => boolean };

const selections: readonly Selection[] = [
  { keys: ["PS_DATA_DIR", "CH_DATA_DIR", "CONTROL_HUB_DATA_DIR"], replacement: "PS_DATA_DIR", nonblank: true },
  { keys: ["PS_SCRIPTS_DIR", "CH_SCRIPTS_DIR"], replacement: "PS_SCRIPTS_DIR", nonblank: true },
  { keys: ["PS_HARDWARE_LOG_DIR", "CH_HARDWARE_LOG_DIR"], replacement: "PS_HARDWARE_LOG_DIR", nonblank: true },
  { keys: ["PS_ENABLE_DEPLOY_API", "CH_ENABLE_DEPLOY_API"], replacement: "PS_ENABLE_DEPLOY_API", nonblank: true, effective: (value) => ["1", "true", "yes", "0", "false", "no"].includes(value.trim().toLowerCase()) },
  { keys: ["PS_REQUEST_SIGNING_SECRET", "CH_REQUEST_SIGNING_SECRET"], replacement: "PS_REQUEST_SIGNING_SECRET", nonblank: true },
  { keys: ["PS_READ_ONLY", "CH_READ_ONLY"], replacement: "PS_READ_ONLY", nonblank: true, effective: (value) => ["1", "true"].includes(value.trim().toLowerCase()) },
  { keys: ["PS_RUN_MAX_MINUTES", "CH_RUN_MAX_MINUTES"], replacement: "PS_RUN_MAX_MINUTES", effective: (value) => Boolean(Number(value)) },
  { keys: ["PS_UPDATE_GIT_BRANCH", "CH_UPDATE_GIT_BRANCH"], replacement: "PS_UPDATE_GIT_BRANCH", effective: (value) => /[a-zA-Z0-9._/-]/.test(value) },
  { keys: ["PS_PULL_RECONCILE_DISK", "CH_PULL_RECONCILE_DISK"], replacement: "PS_PULL_RECONCILE_DISK", effective: (value) => value === "1" },
  { keys: ["PS_LLM_API", "CONTROL_HUB_LLM_API"], replacement: "PS_LLM_API", effective: (value) => Boolean(value.trim()) },
  { keys: ["PS_ALLOWED_DEV_ORIGINS", "CH_ALLOWED_DEV_ORIGINS"], replacement: "PS_ALLOWED_DEV_ORIGINS", effective: (value) => value.split(",").some((entry) => Boolean(entry.trim().replace(/^https?:\/\//, ""))) },
];

function selectedLegacyBootNames(environment: Environment): string[] {
  const selected: string[] = [];
  for (const { keys, nonblank, replacement, effective } of selections) {
    const winner = keys.find((key) => {
      const value = environment[key];
      return nonblank ? Boolean(value?.trim()) : Boolean(value);
    });
    // A raw legacy input may be chosen yet ignored by the consumer's parser.
    // The run deadline, for example, falls back to 120 for NaN or zero.
    if (winner && winner !== replacement && (!effective || effective(environment[winner] ?? ""))) {
      selected.push(`${winner} → ${replacement}`);
    }
  }
  return selected;
}

export function describeLegacyBootWarning(
  environment: Environment,
  selectedAdapterNames: readonly string[] = [],
): string | null {
  const names = [...selectedLegacyBootNames(environment), ...selectedAdapterNames];
  if (names.length === 0) return null;
  return `Pre-rename configuration selected: ${names.join(", ")}. These names work through v1.0.0 and retire in the first later release; move to the named replacements.`;
}
