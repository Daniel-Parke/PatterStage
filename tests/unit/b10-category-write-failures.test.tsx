/** @jest-environment jsdom */
// ═══════════════════════════════════════════════════════════════
// B10 oracle, group missions (D71).
//
// Written before the product code moved. Holds contract section 5.
//
// The defect, three parts:
//
//   1. RENAME. useMissionsApi.updateCategory awaits safeApiCall and discards
//      the result; the file's own comment says it is "fire-and-forget so the
//      result is ignored". safeApiCall never throws. So handleUpdateCategory
//      closes the inline editor and refetches whatever the server still holds:
//      a rejected rename is indistinguishable from a successful one that got
//      reverted, and the typed name is thrown away with it.
//   2. DELETE. deleteCategory uses apiFetch, which DOES throw on a non-2xx,
//      and handleDeleteCategory has no try/catch. The rejection escapes into
//      the modal's `void confirmDelete()`, the panel never closes, and nothing
//      says why.
//   3. The reassign parameter is only sent when it is truthy. The route maps
//      an EMPTY reassignToId to null and only an ABSENT one to undefined, and
//      undefined is the branch that answers 400 "reassignToId required when
//      category is in use". So choosing "Uncategorized" — the first option in
//      the select — is the one choice that cannot be carried out.
//
// The contract: the API helper returns its result and always sends the
// parameter; the hook toasts both outcomes, returns whether the write landed,
// and does not refetch over a failure; the modal keeps the editor open when it
// did not land.
// ═══════════════════════════════════════════════════════════════

import { act, renderHook } from "@testing-library/react";

// ── the wire ───────────────────────────────────────────────────

const apiFetch = jest.fn(async (_path: string, _options?: unknown) => ({ data: {} }));
const safeApiCall = jest.fn(async () => ({ ok: true, data: {} }));
const safeApiCallData = jest.fn(async () => null);

jest.mock("@/lib/api-fetch", () => ({
  // toastError and setErrorFromCaught stay REAL: this oracle is about what the
  // user is told, and mocking the thing that tells them would assert nothing.
  ...(jest.requireActual("@/lib/api-fetch") as Record<string, unknown>),
  apiFetch: (...a: unknown[]) => (apiFetch as unknown as (...a: unknown[]) => unknown)(...a),
  safeApiCall: (...a: unknown[]) => (safeApiCall as unknown as (...a: unknown[]) => unknown)(...a),
  safeApiCallData: (...a: unknown[]) => (safeApiCallData as unknown as (...a: unknown[]) => unknown)(...a),
}));

import { useMissionsApi } from "@/hooks/useMissionsApi";
import { useMissionCategories } from "@/hooks/useMissionCategories";

// ── pre-B10 shim: the two handlers start answering ─────────────
//
// Both return `Promise<void>` today and `Promise<boolean>` under the contract,
// so the oracle reads them through a shim rather than a static type.

interface AnsweringHandlers {
  handleUpdateCategory: (id: string, patch: { name?: string; color?: string }) => Promise<boolean>;
  handleDeleteCategory: (id: string, reassignToId: string | null) => Promise<boolean>;
}

function answering(hook: ReturnType<typeof useMissionCategories>): AnsweringHandlers {
  return hook as unknown as AnsweringHandlers;
}

// ── the API helper ─────────────────────────────────────────────

describe("useMissionsApi hands the answer back", () => {
  beforeEach(() => {
    apiFetch.mockClear();
    safeApiCall.mockClear();
  });

  it("returns the rename's result instead of swallowing it", async () => {
    safeApiCall.mockResolvedValueOnce({ ok: false, error: "Name already taken" } as never);
    const { result } = renderHook(() => useMissionsApi());

    const res = (await result.current.updateCategory("c-1", { name: "Ops" })) as unknown as {
      ok: boolean;
      error?: string;
    };

    expect(res).toEqual({ ok: false, error: "Name already taken" });
  });

  it("always sends reassignToId, so an explicit Uncategorized reaches the route's null branch", async () => {
    const { result } = renderHook(() => useMissionsApi());

    await result.current.deleteCategory("c-1", null);

    const url = apiFetch.mock.calls[0][0];
    // Empty means null to the route; ABSENT means undefined, which is the 400.
    expect(url).toContain("reassignToId=");
  });

  it("GREEN CONTROL: still sends a real reassign target", async () => {
    const { result } = renderHook(() => useMissionsApi());

    await result.current.deleteCategory("c-1", "c-2");

    expect(apiFetch.mock.calls[0][0]).toContain("reassignToId=c-2");
  });
});

// ── the hook ───────────────────────────────────────────────────

function mountCategories(over: Partial<Parameters<typeof useMissionCategories>[0]> = {}) {
  const showToast = jest.fn();
  const fetchCategories = jest.fn(async () => []);
  const createCategory = jest.fn(async () => null);
  const updateCategory = jest.fn(async () => ({ ok: true }));
  const deleteCategory = jest.fn(async () => undefined);
  const onMissionsReassigned = jest.fn(async () => undefined);

  const args = {
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    showToast,
    onMissionsReassigned,
    ...over,
  } as unknown as Parameters<typeof useMissionCategories>[0];

  const { result } = renderHook(() => useMissionCategories(args));
  return { result, showToast, fetchCategories, updateCategory, deleteCategory, onMissionsReassigned };
}

describe("a rename that was refused says so", () => {
  it("toasts the server's reason and answers false", async () => {
    const updateCategory = jest.fn(async () => ({ ok: false, error: "Name already taken" }));
    const { result, showToast, fetchCategories } = mountCategories({
      updateCategory: updateCategory as never,
    });
    fetchCategories.mockClear();

    let landed: boolean | undefined;
    await act(async () => {
      landed = await answering(result.current).handleUpdateCategory("c-1", { name: "Ops" });
    });

    expect(landed).toBe(false);
    expect(showToast).toHaveBeenCalledWith("Name already taken", "error");
    // No refetch over a failure: reloading the list is exactly what made a
    // rejected rename look like a successful one that got reverted.
    expect(fetchCategories).not.toHaveBeenCalled();
  });

  it("has its own wording when the server gives no reason", async () => {
    const updateCategory = jest.fn(async () => ({ ok: false }));
    const { result, showToast } = mountCategories({ updateCategory: updateCategory as never });

    await act(async () => {
      await answering(result.current).handleUpdateCategory("c-1", { name: "Ops" });
    });

    expect(showToast).toHaveBeenCalledWith("Failed to update category", "error");
  });

  it("confirms a rename that landed, and reloads the catalog", async () => {
    const { result, showToast, fetchCategories } = mountCategories();
    fetchCategories.mockClear();

    let landed: boolean | undefined;
    await act(async () => {
      landed = await answering(result.current).handleUpdateCategory("c-1", { name: "Ops" });
    });

    expect(landed).toBe(true);
    expect(showToast).toHaveBeenCalledWith("Category updated");
    expect(fetchCategories).toHaveBeenCalledTimes(1);
  });
});

describe("a delete that was refused says so", () => {
  it("catches the throw, toasts it, and answers false", async () => {
    const deleteCategory = jest.fn(async () => {
      throw new Error("Category is in use");
    });
    const { result, showToast, fetchCategories, onMissionsReassigned } = mountCategories({
      deleteCategory: deleteCategory as never,
    });
    fetchCategories.mockClear();

    let landed: boolean | undefined;
    await act(async () => {
      // The rejection must not escape: today it does, and the modal is left
      // open with nothing on it that says what happened.
      landed = await answering(result.current).handleDeleteCategory("c-1", null);
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
      landed = await answering(result.current).handleDeleteCategory("c-1", null);
    });

    expect(landed).toBe(true);
    expect(showToast).toHaveBeenCalledWith("Category deleted", "success");
    expect(fetchCategories).toHaveBeenCalledTimes(1);
    expect(onMissionsReassigned).toHaveBeenCalledTimes(1);
  });
});

// ── the modal keeps what did not land ──────────────────────────

describe("the category manager keeps the editor open over a failure", () => {
  it("declares handlers that answer, so the modal can tell", () => {
    // Structural: CategoryManagerModal's onUpdate/onDelete props are
    // `Promise<void>` today, which is why saveEdit/confirmDelete close
    // unconditionally. The contract makes them `Promise<boolean>` and the modal
    // returns early on false. This assertion is the type change's witness.
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
