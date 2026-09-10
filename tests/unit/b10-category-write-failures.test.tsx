/** @jest-environment jsdom */
// ═══════════════════════════════════════════════════════════════
// B10 oracle, group missions (D71).
//
// Written before the product code moved. Holds contract section 5.
//
// The defect, three parts:
//
//   1. RENAME. The rename awaited its call and discarded the result, so a
//      rejected rename closed the inline editor and refetched whatever the
//      server still held: indistinguishable from a successful one that got
//      reverted, and the typed name was thrown away with it.
//   2. DELETE. The delete threw on a non-2xx and nothing caught it: the
//      rejection escaped into the modal's `void confirmDelete()`, the panel
//      never closed, and nothing said why.
//   3. The reassign parameter was only sent when it was truthy. The route maps
//      an EMPTY reassignToId to null and only an ABSENT one to undefined, and
//      undefined is the branch that answers 400 "reassignToId required when
//      category is in use". So choosing "Uncategorized" — the first option in
//      the select — was the one choice that could not be carried out.
//
// The contract: the hook always sends the parameter; it toasts both outcomes,
// returns whether the write landed, and does not refetch over a failure; the
// modal keeps the editor open when it did not land.
//
// Amended 2026-09-10 (C3, T-0138): the three writes are the hook's own, through
// runWrite over apiFetch; useMissionsApi keeps only the reads. The wire is
// mocked where the hook meets it.
// ═══════════════════════════════════════════════════════════════

import { act, renderHook } from "@testing-library/react";

// ── the wire ───────────────────────────────────────────────────

const apiFetch = jest.fn(async (_path: string, _options?: unknown) => ({ data: {} }));

jest.mock("@/lib/api/api-fetch", () => ({
  // messageFromError and setErrorFromCaught stay REAL: this oracle is about
  // what the user is told, and mocking the thing that tells them would assert
  // nothing.
  ...(jest.requireActual("@/lib/api/api-fetch") as Record<string, unknown>),
  apiFetch: (...a: unknown[]) => (apiFetch as unknown as (...a: unknown[]) => unknown)(...a),
}));

import { useMissionCategories } from "@/hooks/useMissionCategories";

function mountCategories() {
  const showToast = jest.fn();
  const fetchCategories = jest.fn(async () => []);
  const onMissionsReassigned = jest.fn(async () => undefined);
  const { result } = renderHook(() => useMissionCategories({ fetchCategories, showToast, onMissionsReassigned }));
  return { result, showToast, fetchCategories, onMissionsReassigned };
}

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockResolvedValue({ data: {} });
});

describe("the delete always names its reassign target", () => {
  it("sends reassignToId even when it is Uncategorized, so the route's null branch is reached", async () => {
    const { result } = mountCategories();
    await act(async () => {
      await result.current.handleDeleteCategory("c-1", null);
    });
    const [url, init] = apiFetch.mock.calls[0] as [string, { method: string }];
    expect(url).toContain("reassignToId=");
    expect(init.method).toBe("DELETE");
  });

  it("GREEN CONTROL: still sends a real reassign target", async () => {
    const { result } = mountCategories();
    await act(async () => {
      await result.current.handleDeleteCategory("c-1", "c-2");
    });
    expect(apiFetch.mock.calls[0][0]).toContain("reassignToId=c-2");
  });
});

describe("a rename that was refused says so", () => {
  it("toasts the server's reason and answers false", async () => {
    apiFetch.mockRejectedValueOnce(new Error("Name already taken"));
    const { result, showToast, fetchCategories } = mountCategories();
    fetchCategories.mockClear();

    let landed: boolean | undefined;
    await act(async () => {
      landed = await result.current.handleUpdateCategory("c-1", { name: "Ops" });
    });

    expect(landed).toBe(false);
    expect(showToast).toHaveBeenCalledWith("Name already taken", "error");
    // No refetch over a failure: reloading the list is exactly what made a
    // rejected rename look like a successful one that got reverted.
    expect(fetchCategories).not.toHaveBeenCalled();
  });

  it("has its own wording when the server gives no reason", async () => {
    apiFetch.mockRejectedValueOnce(new Error(""));
    const { result, showToast } = mountCategories();

    await act(async () => {
      await result.current.handleUpdateCategory("c-1", { name: "Ops" });
    });

    expect(showToast).toHaveBeenCalledWith("Failed to update category", "error");
  });

  it("confirms a rename that landed, sends the patch by id, and reloads the catalog", async () => {
    const { result, showToast, fetchCategories } = mountCategories();
    fetchCategories.mockClear();

    let landed: boolean | undefined;
    await act(async () => {
      landed = await result.current.handleUpdateCategory("c-1", { name: "Ops" });
    });

    expect(landed).toBe(true);
    expect(showToast).toHaveBeenCalledWith("Category updated", "success");
    expect(fetchCategories).toHaveBeenCalledTimes(1);
    const [url, init] = apiFetch.mock.calls[0] as [string, { method: string; body: string }];
    expect(url).toBe("/api/mission-categories");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ id: "c-1", name: "Ops" });
  });
});

describe("a delete that was refused says so", () => {
  it("catches the throw, toasts it, and answers false", async () => {
    apiFetch.mockRejectedValueOnce(new Error("Category is in use"));
    const { result, showToast, fetchCategories, onMissionsReassigned } = mountCategories();
    fetchCategories.mockClear();

    let landed: boolean | undefined;
    await act(async () => {
      landed = await result.current.handleDeleteCategory("c-1", null);
    });

    expect(landed).toBe(false);
    expect(showToast).toHaveBeenCalledWith("Category is in use", "error");
    expect(fetchCategories).not.toHaveBeenCalled();
    expect(onMissionsReassigned).not.toHaveBeenCalled();
  });

  it("confirms a delete that landed, and refreshes the slices it moved", async () => {
    const { result, showToast, fetchCategories, onMissionsReassigned } = mountCategories();
    fetchCategories.mockClear();

    let landed: boolean | undefined;
    await act(async () => {
      landed = await result.current.handleDeleteCategory("c-1", null);
    });

    expect(landed).toBe(true);
    expect(showToast).toHaveBeenCalledWith("Category deleted", "success");
    expect(fetchCategories).toHaveBeenCalledTimes(1);
    expect(onMissionsReassigned).toHaveBeenCalledTimes(1);
  });
});

describe("a create answers with the id, or with nothing", () => {
  it("returns the new id and reloads", async () => {
    apiFetch.mockResolvedValueOnce({ data: { category: { id: "c-9" } } });
    const { result, fetchCategories } = mountCategories();
    fetchCategories.mockClear();
    let id: string | null = null;
    await act(async () => {
      id = await result.current.handleCreateCategory("Ops", "#fff");
    });
    expect(id).toBe("c-9");
    expect(fetchCategories).toHaveBeenCalledTimes(1);
    expect(JSON.parse((apiFetch.mock.calls[0][1] as { body: string }).body)).toEqual({ name: "Ops", color: "#fff" });
  });

  it("answers null and says why when the create was refused", async () => {
    apiFetch.mockRejectedValueOnce(new Error("Name already taken"));
    const { result, showToast } = mountCategories();
    let id: string | null = "unset";
    await act(async () => {
      id = await result.current.handleCreateCategory("Ops");
    });
    expect(id).toBeNull();
    expect(showToast).toHaveBeenCalledWith("Name already taken", "error");
  });
});

// ── the modal keeps what did not land ──────────────────────────

describe("the category manager keeps the editor open over a failure", () => {
  it("declares handlers that answer, so the modal can tell", () => {
    // Structural: CategoryManagerModal's onUpdate/onDelete props are
    // `Promise<boolean>` and the modal returns early on false. This assertion
    // is the type change's witness.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- read at call time so a deleted export is a red, not a compile error
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- same
    const { join } = require("node:path") as typeof import("node:path");
    const src = readFileSync(
      join(__dirname, "..", "..", "src/components/missions/CategoryManagerModal.tsx"),
      "utf8",
    );

    expect(src).toContain("Promise<boolean>");
  });
});
