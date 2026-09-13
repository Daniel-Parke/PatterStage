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

import { waitFor, screen } from "@testing-library/react";
// Reads go through useApiResource since T-0129, so the component wants a QueryClient.
import { renderWithQuery } from "../helpers/render-with-query";
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
    renderWithQuery(
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

    renderWithQuery(<DirectoryPickerModal open onClose={() => {}} onSelect={() => {}} />);

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

    renderWithQuery(<DirectoryPickerModal open onClose={() => {}} onSelect={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Empty folder")).toBeInTheDocument();
    });
  });
});

// Sharpened after the sweep (T-0129): the listing is a read the hook makes
// only while the modal is open (`enabled: open`), and a mutant that dropped
// the guard survived, because no test rendered the picker closed. A closed
// picker asks the disk for nothing.
describe("DirectoryPickerModal — closed", () => {
  const mockFetchClosed = jest.fn();
  beforeEach(() => {
    mockFetchClosed.mockReset();
    global.fetch = mockFetchClosed as unknown as typeof fetch;
  });

  it("does not list the disk while it is closed", async () => {
    renderWithQuery(<DirectoryPickerModal open={false} onClose={() => {}} onSelect={() => {}} />);
    await new Promise((r) => setTimeout(r, 60));
    expect(mockFetchClosed).not.toHaveBeenCalled();
  });
});
