/** @jest-environment jsdom */

import { waitFor } from "@testing-library/react";
import { renderWithQuery } from "../helpers/render-with-query";
// The Selector became a Picker in missions/ (U11, T-0125): one caller, one shape.
import SkillsPicker from "@/components/missions/SkillsPicker";

describe("SkillsPicker profile refetch", () => {
  beforeEach(() => {
    global.fetch = jest.fn((url: string | Request) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("profile=alpha")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                skills: [
                  { name: "a", category: "c", description: "", enabled: true },
                  { name: "b", category: "c", description: "", enabled: false },
                ],
              },
            }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              skills: [{ name: "z", category: "c", description: "", enabled: true }],
            },
          }),
      } as Response);
    }) as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("refetches when profileId changes without opening dropdown", async () => {
    const { rerender } = renderWithQuery(
      <SkillsPicker value={[]} onChange={() => {}} profileId="alpha" max={10} />,
    );
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("profile=alpha"),
        expect.anything(),
      );
    });

    rerender(<SkillsPicker value={[]} onChange={() => {}} profileId="beta" max={10} />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("profile=beta"),
        expect.anything(),
      );
    });
  });
});
