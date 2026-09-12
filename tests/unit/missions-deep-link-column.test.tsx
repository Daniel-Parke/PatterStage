/**
 * @jest-environment jsdom
 *
 * The board's Completed and Failed columns start collapsed to five rows.
 * A mission old enough to have a session in the sessions list is usually
 * past row five, so the `?mission=<id>` deep link could open a detail panel
 * inside a column that never renders it: the link would land on the board
 * and look like it had done nothing, which is the failure it was added to
 * remove. `useMissionsFiltering` expands the column the deep-linked mission
 * lands in, and only for the deep link.
 */

import { renderHook } from "@testing-library/react";

import { useMissionsFiltering } from "@/hooks/useMissionsFiltering";
import type { MissionRow } from "@/hooks/missions-page-types";

/** Minimal rows: only the fields the collapse effect reads. */
const missions = [
  { id: "done-1", status: "successful" },
  { id: "burned-1", status: "failed" },
  { id: "draft-1", status: "queued", queuedForRun: false },
] as unknown as MissionRow[];

function render(deepLinkedMissionId: string | null) {
  return renderHook(() =>
    useMissionsFiltering({
      missions,
      templates: [],
      categories: [],
      deepLinkedMissionId,
    }),
  );
}

describe("missions board collapse vs the ?mission= deep link", () => {
  it("collapses Completed and Failed by default", () => {
    const { result } = render(null);
    expect(result.current.collapsedColumns).toEqual({
      successful: true,
      failed: true,
    });
  });

  it("expands the column a deep-linked mission lands in", () => {
    const { result } = render("done-1");
    expect(result.current.collapsedColumns.successful).toBe(false);
    // Only the column that needed it. Expanding both would undo a
    // preference the user never expressed.
    expect(result.current.collapsedColumns.failed).toBe(true);
  });

  it("expands the Failed column for a failed mission", () => {
    const { result } = render("burned-1");
    expect(result.current.collapsedColumns.failed).toBe(false);
    expect(result.current.collapsedColumns.successful).toBe(true);
  });

  it("leaves the collapse state alone for an unknown id", () => {
    // A deleted mission is reported by the toast, not by rearranging the
    // board around a row that is not there.
    const { result } = render("gone-9");
    expect(result.current.collapsedColumns).toEqual({
      successful: true,
      failed: true,
    });
  });

  it("leaves the collapse state alone when a column is not collapsible", () => {
    const { result } = render("draft-1");
    expect(result.current.collapsedColumns).toEqual({
      successful: true,
      failed: true,
    });
  });
});
