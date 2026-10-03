/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-require-imports */

// ═══════════════════════════════════════════════════════════════
// "Active" has to be about the model it is drawn next to.
//
// The badge was drawn on `readiness.state === "ready"` AND the registry slot
// being filled. `ready` only proves that the agent's config file names SOME
// model, never that it names THAT one, so on a drifted install (config.yaml
// says MiniMax-M3, the agent slot points at gpt-4o) the section read
//
//     Default Model  [gpt-4o]  openai/gpt-4o  ✓ Active
//
// while the dashboard header, off the same readiness object, said MiniMax-M3.
// The model the agent is really running was never mentioned on the page whose
// job is to say so.
//
// That state is not a corner case: detectConfigDrift() reports it as
// `primaryDiffers`, and PUT /api/models/defaults creates it deliberately every
// time the database write succeeds and the yaml write is refused.
// ═══════════════════════════════════════════════════════════════

import { render, screen } from "@testing-library/react";

import ModelsAgentDefaultSection from "@/components/models/ModelsAgentDefaultSection";
import type { ApiModel } from "@/components/models/types";
import type { ModelReadiness } from "@/lib/models/model-readiness";

jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());

// Two rows, so "the slot points at one model and the agent runs the other" is
// expressible. Both are real registry rows; only config.yaml decides which one
// the gateway will call.
const MODELS: ApiModel[] = [
  {
    id: "m_gpt",
    name: "gpt-4o",
    provider: "openai",
    modelId: "gpt-4o",
    apiStyle: null,
    baseUrl: null,
    contextLength: null,
    credentialsId: null,
    defaults: {} as ApiModel["defaults"],
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "m_minimax",
    name: "MiniMax-M3",
    provider: "minimax",
    modelId: "MiniMax-M3",
    apiStyle: null,
    baseUrl: null,
    contextLength: null,
    credentialsId: null,
    defaults: {} as ApiModel["defaults"],
    createdAt: "",
    updatedAt: "",
  },
];

/** What GET /api/models/defaults answers when config.yaml names MiniMax-M3. */
const RUNNING_MINIMAX: ModelReadiness = {
  state: "ready",
  ready: true,
  label: "MiniMax-M3 · minimax",
  modelName: "MiniMax-M3",
  detail: "",
};

/** The same, for an install whose config.yaml names gpt-4o. */
const RUNNING_GPT: ModelReadiness = {
  state: "ready",
  ready: true,
  label: "gpt-4o · openai",
  modelName: "gpt-4o",
  detail: "",
};

const noop = async () => undefined;

function renderSection(agentSlot: string | null, readiness: ModelReadiness | null) {
  return render(
    <ModelsAgentDefaultSection
      models={MODELS}
      modelOptions={MODELS.map((m) => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        modelId: m.modelId,
      }))}
      defaults={{ agent: agentSlot } as never}
      readiness={readiness}
      busyTaskType={null}
      onBulkAuxiliaryChange={noop}
      onSetDefault={noop}
    />,
  );
}

describe("the Active badge names the model the agent is running", () => {
  it("does not stamp Active on a slot the agent's config file does not name", () => {
    // The drifted install: slot = gpt-4o, config.yaml = MiniMax-M3.
    renderSection("m_gpt", RUNNING_MINIMAX);

    expect(screen.queryByText(/Active/)).toBeNull();
  });

  it("names the model that IS running, on the page whose job is to say so", () => {
    const { container } = renderSection("m_gpt", RUNNING_MINIMAX);

    expect(container.textContent).toContain("MiniMax-M3");
    expect(container.textContent).toMatch(/not the model chosen here/);
  });

  it("GREEN CONTROL: the slot the config file names still reads Active", () => {
    renderSection("m_minimax", RUNNING_MINIMAX);

    expect(screen.getByText(/Active/)).toBeInTheDocument();
    // And it does not also claim something else is running.
    expect(screen.queryByText(/not the model chosen here/)).toBeNull();
  });

  it("GREEN CONTROL: the other install, the other way round", () => {
    renderSection("m_gpt", RUNNING_GPT);

    expect(screen.getByText(/Active/)).toBeInTheDocument();
  });

  it("draws no badge at all when readiness is unknown", () => {
    // What a config file the server could not read now yields. An unknown
    // answer is not a green tick, and it is not an accusation either.
    const { container } = renderSection("m_gpt", null);

    expect(screen.queryByText(/Active/)).toBeNull();
    expect(container.textContent).toContain("gpt-4o");
  });
});
