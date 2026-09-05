/** @jest-environment jsdom */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithQuery } from "../helpers/render-with-query";
import ToolsetSelector from "@/components/ui/ToolsetSelector";

describe("ToolsetSelector", () => {
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
    const onChange = jest.fn();
    renderWithQuery(<ToolsetSelector value={[]} onChange={onChange} profileId="creative-lead" max={5} />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/agent/profiles/creative-lead/toolsets"),
        expect.anything(),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /Recommend Hermes toolsets/i }));
    const webOption = await screen.findByRole("button", { name: /^Web/i });
    fireEvent.click(webOption);
    expect(onChange).toHaveBeenCalledWith(["web"]);
  });
});
