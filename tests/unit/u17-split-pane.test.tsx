/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * U17 · SplitPane, the one two-column shape.
 *
 * Chat, Logs, Composer and Research are the same screen built four times: a
 * list on the left that chooses, and the thing chosen on the right. The
 * records carried the shared layout since T-0124 and every batch deferred it.
 * On a phone the cost came due: Chat kept its 240px list beside a 100px
 * transcript, so a failed run read one word per line and the send button was
 * a sliver (the UI review of 2026-09-08, P1).
 *
 * The primitive: two columns from lg; below lg the aside goes behind a
 * button that opens it as a Dialog sheet, and the sheet closes itself when
 * the caller's selection changes, because choosing is what the list was for.
 * The children take the whole width. One component, four screens, and the
 * phone gate in tests/e2e/phone.spec.ts measures each of them.
 *
 * The three states are told apart by matchMedia, stubbed per width the way
 * the U14 rail suite stubs it.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { matchMediaMock } from "../helpers/mocks";

jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());

import SplitPane from "@/components/ui/SplitPane";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

function mockViewport(width: number) {
  matchMediaMock((query) => {
    const max = query.match(/max-width:\s*(\d+)px/);
    const min = query.match(/min-width:\s*(\d+)px/);
    return (!max || width <= Number(max[1])) && (!min || width >= Number(min[1])) && Boolean(max || min);
  });
}

function mount(selected: string | null = "a", width = 1440) {
  mockViewport(width);
  const ui = (sel: string | null) => (
    <SplitPane
      aside={
        <ul>
          <li>Alpha</li>
          <li>Beta</li>
        </ul>
      }
      asideLabel="Conversations (2)"
      closeOnChange={sel}
      fill
    >
      <p>The transcript</p>
    </SplitPane>
  );
  const view = render(ui(selected));
  return { ...view, rerender: (sel: string | null) => view.rerender(ui(sel)) };
}

describe("U17 · SplitPane", () => {
  it("at 1440 both columns are on the page and there is no button", () => {
    mount("a", 1440);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("The transcript")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Conversations (2)" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("at 390 the aside is behind a button that opens it as a sheet", async () => {
    mount("a", 390);
    await waitFor(() => expect(screen.queryByText("Alpha")).toBeNull());
    expect(screen.getByText("The transcript")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Conversations (2)" });
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    const dialog = screen.getByRole("dialog", { name: "Conversations (2)" });
    expect(within(dialog).getByText("Alpha")).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("the sheet closes itself when the selection changes", async () => {
    const view = mount("a", 390);
    await waitFor(() => expect(screen.queryByText("Alpha")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Conversations (2)" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    view.rerender("b");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // Not a sheet that closes on every render: the same selection again
    // leaves it open.
    fireEvent.click(screen.getByRole("button", { name: "Conversations (2)" }));
    view.rerender("b");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("Escape closes the sheet and focus returns to the button", async () => {
    mount("a", 390);
    await waitFor(() => expect(screen.queryByText("Alpha")).toBeNull());
    const button = screen.getByRole("button", { name: "Conversations (2)" });
    button.focus();
    fireEvent.click(button);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(button);
  });

  it("at 1000 the aside is still behind the button: the split is lg, like the grids it replaces", async () => {
    mount("a", 1000);
    await waitFor(() => expect(screen.queryByText("Alpha")).toBeNull());
    expect(screen.getByRole("button", { name: "Conversations (2)" })).toBeInTheDocument();
  });

  it("marks its main pane so the phone gate can measure it", () => {
    const { container } = mount("a", 1440);
    const main = container.querySelector('[data-ps-split="main"]');
    expect(main).not.toBeNull();
    expect(main).toHaveTextContent("The transcript");
    expect(main).toHaveClass("min-w-0");
    expect(main).toHaveClass("flex-1");
  });

  it("is built on the primitives, not beside them", () => {
    const src = read("src/components/ui/SplitPane.tsx");
    expect(src).toMatch(/from "@\/components\/ui\/Dialog"/);
    expect(src).toMatch(/from "@\/components\/ui\/Button"/);
    expect(src).toMatch(/placement="sheet"/);
    expect(src).not.toMatch(/<button\b/);
    expect(src).toMatch(/"\(max-width: 1023px\)"/);
  });

  it("the four screens are it, and none of them keeps its own two columns", () => {
    const callers = {
      "src/app/work/chat/page.tsx": true,
      "src/app/results/logs/page.tsx": true,
      "src/app/work/composer/page.tsx": false,
      "src/app/work/research/page.tsx": false,
    } as const;
    for (const [file, fills] of Object.entries(callers)) {
      const src = read(file);
      expect(src).toMatch(/from "@\/components\/ui\/SplitPane"/);
      expect(src).toMatch(/<SplitPane\b/);
      expect(src).toMatch(/closeOnChange=/);
      // The two that fill the viewport say so; the two on a scrolling page do not.
      // [^>]* spans lines on its own; the opening tag runs to its first `>`.
      const fill = /<SplitPane\b[^>]*\bfill\b/.test(src.slice(src.indexOf("<SplitPane"), src.indexOf(">", src.indexOf("<SplitPane"))));
      expect(fill).toBe(fills);
    }
    expect(read("src/app/work/chat/page.tsx")).not.toMatch(/w-60 shrink-0 border-r/);
    expect(read("src/app/results/logs/page.tsx")).not.toMatch(/lg:flex-row/);
    expect(read("src/app/work/composer/page.tsx")).not.toMatch(/lg:grid-cols-\[3/);
    expect(read("src/app/work/research/page.tsx")).not.toMatch(/lg:grid-cols-\[3/);
    // The picker's width is the pane's now, not its own.
    expect(read("src/components/logs/LogFilePicker.tsx")).not.toMatch(/lg:w-72/);
  });

  it("is in the primitive table", () => {
    expect(read("docs/contributing/design-tokens.md")).toContain("`SplitPane`");
  });

  // Sharpened after the walk: with the list behind a button, the button was
  // under the sticky header at 390, because scrollIntoView on the transcript's
  // end also scrolled <main> by the mobile header's 48px.
  it("the chat's transcript scrolls itself, not main", () => {
    const send = read("src/hooks/useChatSend.ts");
    // The call, not the word: the comment beside the fix names what it replaced.
    expect(send).not.toMatch(/\.scrollIntoView\(/);
    expect(send).toMatch(/scroller\?\.scrollTo\?\.\(\{ top: scroller\.scrollHeight \}\)/);
    // Smoothness moved to the scroller's CSS, where reduced motion can reach it.
    expect(read("src/app/work/chat/page.tsx")).toMatch(/overflow-y-auto scroll-smooth/);
  });
});
