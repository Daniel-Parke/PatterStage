/** @jest-environment jsdom */

import { act, waitFor } from "@testing-library/react";
import { renderWithQuery } from "../helpers/render-with-query";
import LocalDirRow from "@/components/missions/LocalDirRow";

jest.mock("@/components/missions/DirectoryPickerModal", () => ({
  __esModule: true,
  default: function MockModal() {
    return null;
  },
}));

describe("LocalDirRow branch UI", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      // The on-the-wire envelope is `{ data: { isGitRepo, branches, current } }`.
      // The `safeApiCall<T>` helper does NOT unwrap (see api-fetch.ts:85-98)
      // — it returns `{ ok, data: <body> }` where `data` is the whole
      // envelope. The post-fix production code in LocalDirRow types the
      // call as `safeApiCall<{ data?: { isGitRepo, branches, current } }>`
      // and reads fields via `j.data?.data?.isGitRepo` (two indirections).
      // The mock body therefore matches the on-the-wire envelope shape.
      json: () =>
        Promise.resolve({
          data: {
            isGitRepo: true,
            branches: ["main", "dev"],
            current: "dev",
          },
        }),
    } as Response);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("hides branch select until repo is git; defaults select to API current", async () => {
    const onChange = jest.fn();
    const { container, rerender } = renderWithQuery(
      <LocalDirRow mode="draft" entry={{ path: "", branch: null }} onChange={onChange} />,
    );

    expect(container.querySelectorAll("select")).toHaveLength(0);

    rerender(
      <LocalDirRow mode="draft" entry={{ path: "/projects/repo", branch: null }} onChange={onChange} />,
    );

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => {
      const selects = container.querySelectorAll("select");
      expect(selects.length).toBeGreaterThanOrEqual(1);
    });

    const branchSelect = container.querySelectorAll("select")[0] as HTMLSelectElement;
    expect(branchSelect.value).toBe("dev");
  });
});
