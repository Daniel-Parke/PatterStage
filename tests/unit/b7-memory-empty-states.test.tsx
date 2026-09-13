/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-require-imports -- the source reads are structural assertions, loaded where they are used rather than at the top of a jsdom file */
// ═══════════════════════════════════════════════════════════════
// B7 oracle, group memory-tab (T-0101, D60 to D63).
//
// Written before the product code moved. Contract section 3: the memory list
// says which of four things is true, and the number beside a fact is the number
// it actually is.
//
//   D60  "Press Enter to search" is printed under a bare <input> with no key
//        handler and no form around it. Enter does nothing.
//   D61  A store whose facts are all older than ninety days renders "No
//        memories yet" under a donut counting them, and the Show stale button
//        that would reveal them is inside the non-empty branch.
//   D62  A Recall that matches nothing reports an empty store, on a store that
//        may hold thousands of facts, with nothing that clears the search.
//   D63  proof_count is mapped to a field called `score` and rendered as
//        "Relevance: 100%" whenever it is 1, which is the commonest fact there
//        is. A similarity score is never produced anywhere in this product.
//
// The bridge's field is renamed with the display, so the ambiguity that made
// the branch look reasonable cannot come back.
// ═══════════════════════════════════════════════════════════════

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());

import MemoryTab from "@/components/memory/hindsight/MemoryTab";
import HindsightBrowser from "@/components/memory/HindsightBrowser";
import { SearchInput } from "@/components/ui/Input";
import { mapMemoryItem } from "@/lib/memory/hindsight-bridge";
import type { Memory } from "@/components/memory/hindsight/types";

// ── pre-B7 type shims ───────────────────────────────────────────

type TabProps = React.ComponentProps<typeof MemoryTab> & {
  activeQuery?: string | null;
  onClearQuery?: () => void;
  unreachable?: boolean;
};
const Tab = MemoryTab as unknown as React.ComponentType<TabProps>;

type SearchProps = React.ComponentProps<typeof SearchInput> & { onSubmit?: () => void };
const Search = SearchInput as unknown as React.ComponentType<SearchProps>;

/** The mapped shape after the rename; read loosely so the file compiles first. */
function proofCountOf(mapped: unknown): unknown {
  return (mapped as { proofCount?: unknown }).proofCount;
}

const FRESH: Memory[] = [
  {
    id: "m1",
    content: "The operator prefers short reports",
    type: "observation",
    tags: ["ops"],
    created_at: new Date().toISOString(),
  },
];

// ═══════════════════════════════════════════════════════════════
// D60: Enter
// ═══════════════════════════════════════════════════════════════

describe("Enter runs the search the label promises", () => {
  it("SearchInput fires onSubmit for Enter and for nothing else", () => {
    const onSubmit = jest.fn();
    render(<Search value="cats" onChange={jest.fn()} ariaLabel="Search memories" onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Search memories");

    fireEvent.keyDown(input, { key: "a" });
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("GREEN CONTROL: a SearchInput with no onSubmit still types without throwing", () => {
    const onChange = jest.fn();
    render(<SearchInput value="" onChange={onChange} ariaLabel="Search things" />);
    const input = screen.getByLabelText("Search things");

    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.change(input, { target: { value: "x" } });

    expect(onChange).toHaveBeenCalledWith("x");
  });

  it("pressing Enter in the memory search recalls", async () => {
    const calls: string[] = [];
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push(url);
      const body = url.includes("action=health")
        ? { data: { available: true, mode: "ok" } }
        : { data: { memories: [], total: 0, mode: "ok" } };
      return { ok: true, status: 200, json: async () => body, text: async () => "{}" } as unknown as Response;
    }) as unknown as typeof fetch;

    render(<HindsightBrowser />);
    await waitFor(() => expect(calls.some((c) => c.includes("action=list"))).toBe(true));

    const box = screen.getByPlaceholderText(/Search memories/i);
    fireEvent.change(box, { target: { value: "reports" } });
    fireEvent.keyDown(box, { key: "Enter" });

    await waitFor(() => expect(calls.some((c) => c.includes("action=recall"))).toBe(true));
    expect(calls.find((c) => c.includes("action=recall"))).toContain("reports");
  });
});

describe("the browser hands the search down to the list", () => {
  it("a recall that matched nothing names the query on the page", async () => {
    // Sweep survivor `browser-sends-no-query`. The tab's own tests pass
    // activeQuery in by hand, so nothing proved the browser passes it at all
    // and a search that missed still read as an empty store.
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      const body = url.includes("action=health")
        ? { data: { available: true, mode: "ok" } }
        : { data: { memories: [], total: 0, mode: "ok" } };
      return { ok: true, status: 200, json: async () => body, text: async () => "{}" } as unknown as Response;
    }) as unknown as typeof fetch;

    render(<HindsightBrowser />);
    const box = await screen.findByPlaceholderText(/Search memories/i);
    fireEvent.change(box, { target: { value: "quantum" } });
    fireEvent.keyDown(box, { key: "Enter" });

    expect(await screen.findByText('No memories matched "quantum"')).toBeInTheDocument();
  });

  it("Enter twice while a recall is in flight runs it once", async () => {
    // Sweep survivor `browser-recalls-a-blank-query`: the guard is two
    // conditions and only the blank half is covered by runRecall's own check.
    let release: ((v: unknown) => void) | null = null;
    const calls: string[] = [];
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push(url);
      const answer = {
        ok: true,
        status: 200,
        json: async () => ({ data: { memories: [], total: 0, mode: "ok" } }),
        text: async () => "{}",
      } as unknown as Response;
      if (url.includes("action=recall")) {
        return new Promise((resolve) => {
          release = () => resolve(answer);
        }) as unknown as Response;
      }
      return answer;
    }) as unknown as typeof fetch;

    render(<HindsightBrowser />);
    const box = await screen.findByPlaceholderText(/Search memories/i);
    fireEvent.change(box, { target: { value: "reports" } });
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(calls.filter((c) => c.includes("action=recall"))).toHaveLength(1));

    fireEvent.keyDown(box, { key: "Enter" });
    fireEvent.keyDown(box, { key: "Enter" });

    expect(calls.filter((c) => c.includes("action=recall"))).toHaveLength(1);
    await act(async () => {
      release?.(null);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// D61, D62 and the fourth state
// ═══════════════════════════════════════════════════════════════

describe("an empty list says which kind of empty it is", () => {
  const stale = { showStale: false, onToggle: jest.fn(), hiddenCount: 12, thresholdDays: 90 };

  it("a store that is entirely stale says so, and offers the way to see it", () => {
    render(<Tab memories={[]} loading={false} loadingInitial={false} showStaleToggle={stale} />);

    expect(screen.getByText(/Every memory is older than 90 days/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Show stale/i })).toBeInTheDocument();
    expect(screen.queryByText(/No memories yet/i)).toBeNull();
  });

  it("a search that matched nothing names the query and offers to clear it", () => {
    const onClearQuery = jest.fn();
    render(
      <Tab
        memories={[]}
        loading={false}
        loadingInitial={false}
        activeQuery="quantum"
        onClearQuery={onClearQuery}
      />,
    );

    expect(screen.getByText('No memories matched "quantum"')).toBeInTheDocument();
    expect(screen.queryByText(/No memories yet/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Clear search/i }));
    expect(onClearQuery).toHaveBeenCalledTimes(1);
  });

  it("a store nothing is answering for says it is not connected", () => {
    render(<Tab memories={[]} loading={false} loadingInitial={false} unreachable />);

    expect(screen.getByText(/Memory is not connected/i)).toBeInTheDocument();
    expect(screen.queryByText(/No memories yet/i)).toBeNull();
  });

  it("GREEN CONTROL: a genuinely empty, reachable, unsearched store still says 'No memories yet'", () => {
    render(<Tab memories={[]} loading={false} loadingInitial={false} />);

    expect(screen.getByText(/No memories yet/i)).toBeInTheDocument();
  });

  it("the stale banner stays quiet when it is hiding nothing", () => {
    // Found on the proof walk: hoisting the banner above the empty branch put
    // "Hiding 0 memories older than 90 days" on a store with nothing in it,
    // which is noise and is not true either.
    render(
      <Tab
        memories={[]}
        loading={false}
        loadingInitial={false}
        showStaleToggle={{ ...stale, hiddenCount: 0 }}
      />,
    );

    expect(screen.queryByText(/Hiding 0 memories/i)).toBeNull();
    expect(screen.getByText(/No memories yet/i)).toBeInTheDocument();
  });

  it("but says so while the filter is off, so it can be put back on", () => {
    render(
      <Tab
        memories={[]}
        loading={false}
        loadingInitial={false}
        showStaleToggle={{ ...stale, hiddenCount: 0, showStale: true }}
      />,
    );

    expect(screen.getByRole("button", { name: /Hide stale/i })).toBeInTheDocument();
  });

  it("the stale banner is above the list, not inside the non-empty branch", () => {
    render(<Tab memories={FRESH} loading={false} loadingInitial={false} showStaleToggle={stale} />);

    expect(screen.getByText(/Hiding 12 memories older than 90 days/i)).toBeInTheDocument();
    expect(screen.getByText(FRESH[0].content)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// D63: a proof count is a proof count
// ═══════════════════════════════════════════════════════════════

describe("the number beside a fact is the number it is", () => {
  it("the bridge maps proof_count to a field called proofCount", () => {
    const mapped = mapMemoryItem({ id: 1, text: "x", proof_count: 3 });

    expect(proofCountOf(mapped)).toBe(3);
    expect((mapped as { score?: unknown }).score).toBeUndefined();
  });

  it("one proof reads 'Proof count: 1', never a percentage", () => {
    render(
      <Tab
        memories={[{ ...FRESH[0], proofCount: 1 } as unknown as Memory]}
        loading={false}
        loadingInitial={false}
      />,
    );

    expect(screen.getByText("Proof count: 1")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Relevance/);
    expect(document.body.textContent).not.toMatch(/%/);
  });

  it("a fact with no proofs shows no count at all", () => {
    render(
      <Tab
        memories={[{ ...FRESH[0], proofCount: 0 } as unknown as Memory]}
        loading={false}
        loadingInitial={false}
      />,
    );

    expect(screen.queryByText(/Proof count/)).toBeNull();
  });

  it("neither the tab nor the bridge mentions relevance any more", () => {
    const { readFileSync } = require("fs") as typeof import("fs");
    const { join } = require("path") as typeof import("path");
    const root = join(__dirname, "..", "..");
    const tab = readFileSync(join(root, "src", "components", "memory", "hindsight", "MemoryTab.tsx"), "utf-8");
    const bridge = readFileSync(join(root, "src", "lib", "memory", "hindsight-bridge.ts"), "utf-8");

    expect({ tab: /Relevance/.test(tab), bridge: /\bscore\b/.test(bridge) }).toEqual({
      tab: false,
      bridge: false,
    });
  });
});
