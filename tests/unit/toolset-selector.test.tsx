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
          Promise.resolve({
            data: {
              platformToolsets: {
                cli: ["hermes-cli", "web"],
                discord: ["hermes-discord"],
              },
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
