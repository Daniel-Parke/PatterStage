/** @jest-environment jsdom */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithQuery } from "../helpers/render-with-query";
// The Selector became a Picker in missions/ (U11, T-0125): one caller, one shape.
import SkillsPicker from "@/components/missions/SkillsPicker";

describe("SkillsPicker enabled filter", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            skills: [
              { name: "on-skill", category: "c", description: "d", enabled: true },
              { name: "off-skill", category: "c", description: "d", enabled: false },
            ],
          },
        }),
    } as Response);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("lists only enabled skills in the dropdown", async () => {
    renderWithQuery(<SkillsPicker value={[]} onChange={() => {}} profileId="default" max={10} />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Skills" }));

    expect(await screen.findByText("on-skill")).toBeInTheDocument();
    expect(screen.queryByText("off-skill")).not.toBeInTheDocument();
  });
});
