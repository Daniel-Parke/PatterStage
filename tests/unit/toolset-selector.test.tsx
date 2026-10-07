/** @jest-environment jsdom */

import { useState } from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithQuery } from "../helpers/render-with-query";
import { composerFormState } from "../helpers/fixtures";
// The Selector became a Picker in missions/ (U11, T-0125), then folded into
// its one caller, the composer (C6): the toolsets picker is reached through
// the form's Mission parameters step.
import MissionCreateForm, {
  type MissionFormState,
} from "@/components/missions/MissionCreateForm";

function Harness({ onField }: { onField: jest.Mock }) {
  const [formState, setFormState] = useState<MissionFormState>(
    composerFormState({ newProfile: "creative-lead" }),
  );
  const setFormField = <K extends keyof MissionFormState>(
    field: K,
    value: MissionFormState[K],
  ) => {
    onField(field, value);
    setFormState((s) => ({ ...s, [field]: value }));
  };
  return (
    <MissionCreateForm
      editingId={null}
      missions={[]}
      scheduleDraftError={null}
      onScheduleDraftError={jest.fn()}
      formState={formState}
      setFormField={setFormField}
      categories={[]}
      categoryId={null}
      onCategoryChange={() => {}}
      onSubmit={() => {}}
      onSaveAsTemplate={() => {}}
      onClose={() => {}}
      dispatching={false}
      dispatchAcknowledged={false}
      onDispatchOpenChange={() => {}}
    />
  );
}

describe("ToolsetsPicker", () => {
  beforeEach(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          // Mirrors the real GET /api/agent/profiles/[id]/toolsets body
          // (route.ts:38-45). `unifiedEnabled` is the server-side union that
          // useProfileToolsets now reads instead of recomputing it client-side;
          // the stub carries both fields exactly as the route does.
          Promise.resolve({
            data: {
              profile: "creative-lead",
              platformToolsets: {
                cli: ["hermes-cli", "web"],
                discord: ["hermes-discord"],
              },
              unifiedEnabled: ["hermes-cli", "hermes-discord", "web"],
              platformsDiverged: true,
              divergedPlatforms: ["cli", "discord"],
            },
          }),
      } as Response),
    ) as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("loads toolsets for profile and allows selection", async () => {
    const onField = jest.fn();
    renderWithQuery(<Harness onField={onField} />);

    // The picker lives under the collapsed Mission parameters step.
    fireEvent.click(screen.getByRole("button", { name: /Mission parameters/ }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/agent/profiles/creative-lead/toolsets"),
        expect.anything(),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Toolsets" }));
    const webOption = await screen.findByRole("option", { name: /^Web/i });
    fireEvent.click(webOption);
    expect(onField).toHaveBeenCalledWith("newToolsets", ["web"]);
  });
});
