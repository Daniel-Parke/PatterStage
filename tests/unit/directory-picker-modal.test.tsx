/** @jest-environment jsdom */

// Regression test for "Something went wrong" error boundary on
// /orchestration/missions → New Mission → Working directories → folder icon.
//
// Root cause: safeApiCall returns { ok, data: <body> } where <body> is the
// API envelope. DirectoryPickerModal previously typed the response as
// { path, parent, entries } and accessed j.data.path directly, producing
// undefined fields. setEntries(undefined) then crashed the .map() in render.
//
// These tests assert the modal:
//   1. Renders entries from the API envelope (the regression case).
//   2. Does NOT crash when the entries payload is missing (defensive fallback).
//   3. Surfaces the error path when !ok.

import { render, waitFor, screen } from "@testing-library/react";
import DirectoryPickerModal from "@/components/missions/DirectoryPickerModal";

const mockFetch = jest.fn();

describe("DirectoryPickerModal — safeApiCall double-wrap", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders entries from /api/fs/list envelope without crashing", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      // The on-the-wire envelope is `{ data: { path, parent, entries } }`.
      // The `safeApiCall<T>` helper does NOT unwrap (see api-fetch.ts:85-98)
      // — it returns `{ ok, data: <body> }` where `data` is the whole
      // envelope. The post-fix production code types the call as
      // `safeApiCall<{ data?: { path, parent, entries } }>` and reads
      // fields via `j.data?.data?.path` (two indirections). The mock body
      // therefore matches the on-the-wire envelope shape.
      json: () =>
        Promise.resolve({
          data: {
            path: "/home/daniel",
            parent: null,
            entries: [
              { name: "patterstage", isDir: true, isFile: false },
              { name: "Desktop", isDir: true, isFile: false },
              { name: "notes.md", isDir: false, isFile: true },
            ],
          },
        }),
    });

    const onSelect = jest.fn();
    render(
      <DirectoryPickerModal open onClose={() => {}} onSelect={onSelect} />,
    );

    // Modal title is "Select folder"
    expect(screen.getByText("Select folder")).toBeInTheDocument();

    // Entries render (regression: previously crashed because setEntries(undefined))
    await waitFor(() => {
      expect(screen.getByText("patterstage")).toBeInTheDocument();
    });
    expect(screen.getByText("Desktop")).toBeInTheDocument();
    expect(screen.getByText("notes.md")).toBeInTheDocument();
  });

  it("renders empty state when API returns zero entries (not crash)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      // See above — the on-the-wire envelope is `{ data: { ... } }` and
      // `safeApiCall<T>` does NOT unwrap, so the mock body matches the
      // envelope shape.
      json: () =>
        Promise.resolve({
          data: {
            path: "/home/daniel/empty",
            parent: "/home/daniel",
            entries: [],
          },
        }),
    });

    render(<DirectoryPickerModal open onClose={() => {}} onSelect={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Empty folder")).toBeInTheDocument();
    });
  });

  it("falls back to empty entries when response envelope is missing data", async () => {
    // Defensive: API might return body without .data envelope (e.g. legacy).
    // Component should not throw — should render Empty folder instead of crashing.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    render(<DirectoryPickerModal open onClose={() => {}} onSelect={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Empty folder")).toBeInTheDocument();
    });
  });
});
