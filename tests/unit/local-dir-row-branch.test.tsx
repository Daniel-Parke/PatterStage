/** @jest-environment jsdom */

import { act, render, waitFor } from "@testing-library/react";
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
      // The on-the-wire envelope is `{ data: { ... } }`, but the
      // session-135 migration collapsed the double-envelope type to
      // `safeApiCall<{ isGitRepo, branches, current }>` and reads
      // `j.data?.isGitRepo` directly. The `safeApiCall<T>` helper
      // unwraps the envelope before the production code sees it, so
      // the mock body matches the post-unwrap shape.
      json: () =>
        Promise.resolve({
          isGitRepo: true,
          branches: ["main", "dev"],
          current: "dev",
        }),
    } as Response);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("hides branch select until repo is git; defaults select to API current", async () => {
    const onChange = jest.fn();
    const { container, rerender } = render(
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
