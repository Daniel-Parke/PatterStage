// model-readiness — the one answer to "do I have a model?" Three screens used
// to answer it and no two agreed: chat ANDed the registry's agent slot with the
// config file, the dashboard ORed them, the Models page read the registry
// alone, so one install showed "Model not ready for chat" above a working chat.
//
// THE RULE: what the agent can call is what its config file names, because
// that file is what the gateway reads; nothing the product sends changes it.
// The registry's agent slot is an intent, not a second opinion: setting it
// writes through to the file, and a slot that has not reached the file is its
// own state, "not-sent", rather than a synonym for "no model at all".
//
// Pure and client-safe: the server applies it once in GET /api/models/defaults
// and the screens read the answer, so no fourth opinion can grow.

type ModelReadinessState =
  /** The agent's config file names a model. It can answer. */
  | "ready"
  /** A model is chosen in the registry but has not reached the config file. */
  | "not-sent"
  /** Nothing is chosen anywhere. */
  | "none";

export interface ModelReadinessInput {
  /** `model.default` from the agent's config file: what the gateway will call. */
  configModel: string;
  /** `model.provider` from the same file. May be empty. */
  configProvider: string;
  /** Display name of the model in the registry's agent slot, or null when unset. */
  registryLabel: string | null;
}

export interface ModelReadiness {
  state: ModelReadinessState;
  /** True only when the agent has a model it can call right now. */
  ready: boolean;
  /** The model named for a header or a pill. "-" when there is none. */
  label: string;
  /** The bare model name, for use inside a sentence. "" when there is none. */
  modelName: string;
  /** One sentence saying what is wrong and what it means. "" when ready. */
  detail: string;
}

/**
 * The single readiness answer. `detail` names no screen: it renders on the
 * Models page and in the chat banner (which links there), so the sentence says
 * what happened and the surface says where to go.
 */
export function resolveModelReadiness(input: ModelReadinessInput): ModelReadiness {
  const configModel = input.configModel.trim();
  const configProvider = input.configProvider.trim();
  const registryLabel = input.registryLabel?.trim() || "";

  if (configModel) {
    return {
      state: "ready",
      ready: true,
      label: configProvider ? `${configModel} · ${configProvider}` : configModel,
      modelName: configModel,
      detail: "",
    };
  }

  if (registryLabel) {
    return {
      state: "not-sent",
      ready: false,
      label: `${registryLabel} · not sent to the agent yet`,
      modelName: registryLabel,
      detail:
        `${registryLabel} is chosen but has not reached the agent yet. ` +
        "Set the default model again to send it across.",
    };
  }

  return {
    state: "none",
    ready: false,
    label: "-",
    modelName: "",
    detail:
      "No model has been set up yet, so the agent has nothing to answer with. " +
      "Add one and set it as the default.",
  };
}

/**
 * The two config-file fields. `model` has been both a bare string and an object
 * across versions, and every caller grew its own handling; it lives here so the
 * rule and its inputs are read the same way once.
 */
export function modelFieldsFromConfig(
  config: unknown,
): { configModel: string; configProvider: string } {
  const modelField = (config as { model?: unknown } | null | undefined)?.model;
  if (typeof modelField === "string") {
    return { configModel: modelField.trim(), configProvider: "" };
  }
  if (modelField && typeof modelField === "object") {
    const record = modelField as Record<string, unknown>;
    return {
      configModel: String(record.default ?? "").trim(),
      configProvider: String(record.provider ?? "").trim(),
    };
  }
  return { configModel: "", configProvider: "" };
}
