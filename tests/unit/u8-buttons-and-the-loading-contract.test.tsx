/**
 * U8 (T-0122): the button set gets heights, disabled gets a colour, and the
 * loading contract gets a component instead of twenty-four strings.
 *
 * ── heights ───────────────────────────────────────────────────
 *
 * Twenty distinct button heights render across 25 screens, because `Button`
 * sizes itself with padding and every caller adds its own. Padding plus a font
 * gives you whatever it gives you; three declared heights give you three. 26,
 * 32 and 40, and the smallest is still over the 24x24 WCAG 2.5.8 asks.
 *
 * ── disabled ──────────────────────────────────────────────────
 *
 * `disabled:opacity-30` multiplies into the TEXT as well as the chrome. On the
 * panel rung that lands a secondary label (white 70%) at an effective 21%
 * alpha, which composites to 1.42:1 - not a dim label, an invisible one, and
 * the single worst contrast measured anywhere in the product.
 *
 * The replacement is a token rather than a multiplier: `ps-text-faint` is
 * white at 50%, which composites to 4.59:1 on the panel and 3.64:1 on the
 * raised rung. Both clear the 3:1 of WCAG 1.4.11, and it stays legible because
 * a colour cannot compound the way an opacity on an already-transparent colour
 * does. The chrome loses its fill instead of its visibility, which is the
 * honest way to say "not now".
 *
 * ── IconButton ────────────────────────────────────────────────
 *
 * An icon-only control has no text, so its accessible name has to be
 * DECLARED - `check-icon-button-names.mjs` exists because 30-odd of them once
 * had none. Making `label` a required prop moves that from a lint rule that
 * catches it afterwards to a type error that stops it being written, and the
 * square heights mean an icon button can never again be the 39x22 the rail's
 * collapsed rows were.
 *
 * ── the loading contract ──────────────────────────────────────
 *
 * Three behaviours across 26 spinner sites and 24 loading strings, and three
 * screens paint a confident `0` before their fetch resolves - a number the
 * user reads as an answer when it is really the absence of one.
 *
 *   `Skeleton` is a block the shape of what is coming.
 *   `PageLoading` is the body of a page while it loads: the header has
 *   already rendered, because AppPageShell takes it as a prop and the shell
 *   does not wait for the body.
 *   `pendingCount` is the small one that matters most: until a count is known
 *   it renders as an em dash, not a zero.
 */
import { render, screen } from "@testing-library/react";

import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import Skeleton from "@/components/ui/Skeleton";
import PageLoading from "@/components/ui/PageLoading";
import { EmptyState } from "@/components/ui/EmptyState";
import { pendingCount } from "@/components/ui/PageLoading";

const chrome = (el: Element) => (el.getAttribute("class") ?? "").split(/\s+/);
const Dot = (props: Record<string, unknown>) => <svg {...props} />;

describe("a button is one of three heights", () => {
  it.each([
    ["sm", "h-6.5"],
    ["md", "h-8"],
    ["lg", "h-10"],
  ])("%s is %s", (size, height) => {
    render(
      <Button size={size as "sm"} data-testid="b">
        go
      </Button>,
    );
    expect(chrome(screen.getByTestId("b"))).toContain(height);
  });

  /** 26px is the smallest, and it still clears the 24x24 hit target. */
  it("declares a height at every size, so padding cannot invent a fourth", () => {
    const heights = (["sm", "md", "lg"] as const).map((size) => {
      const { container } = render(<Button size={size}>go</Button>);
      return chrome(container.firstElementChild!).filter((c) => /^h-/.test(c));
    });
    for (const found of heights) expect(found).toHaveLength(1);
    expect(new Set(heights.flat()).size).toBe(3);
  });
});

describe("a disabled button is quiet, not invisible", () => {
  it("does not dim itself with an opacity", () => {
    render(<Button disabled>go</Button>);
    expect(chrome(screen.getByRole("button")).join(" ")).not.toMatch(/opacity-\d/);
  });

  it("takes the faint tier, which composites over 3:1 on both rungs", () => {
    render(<Button disabled>go</Button>);
    expect(chrome(screen.getByRole("button"))).toContain("disabled:text-ps-text-faint");
  });

  it("is still disabled, and still says so", () => {
    render(<Button disabled>go</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  /** `loading` disables too, and must not have been broken by the above. */
  it("disables while loading", () => {
    render(<Button loading>go</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

describe("IconButton cannot be nameless and cannot be small", () => {
  it("carries the name it was given", () => {
    render(<IconButton icon={Dot} label="Dismiss" />);
    const button = screen.getByRole("button", { name: "Dismiss" });
    // The name must come from `aria-label`, not from `title`. Both produce an
    // accessible name, so asking only for the ROLE and NAME passed with the
    // aria-label deleted - and `title` is the weaker of the two: it is
    // announced inconsistently and it is also a mouse tooltip, so it is a
    // fallback rather than the label.
    expect(button.getAttribute("aria-label")).toBe("Dismiss");
  });

  it.each([
    ["sm", "h-6.5", "w-6.5"],
    ["md", "h-8", "w-8"],
    ["lg", "h-10", "w-10"],
  ])("is square at %s", (size, h, w) => {
    render(<IconButton icon={Dot} label="Dismiss" size={size as "sm"} />);
    const found = chrome(screen.getByRole("button"));
    expect(found).toContain(h);
    expect(found).toContain(w);
  });

  /**
   * The name goes on the BUTTON, not the icon, and the icon is hidden from
   * the tree. An icon that announces itself beside a labelled button is the
   * same thing said twice.
   */
  it("hides the glyph from the accessibility tree", () => {
    const { container } = render(<IconButton icon={Dot} label="Dismiss" />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("the loading contract", () => {
  it("Skeleton is a block that announces itself as busy", () => {
    render(<Skeleton className="h-8 w-40" />);
    const el = screen.getByRole("status", { name: /loading/i });
    expect(chrome(el)).toEqual(expect.arrayContaining(["h-8", "w-40"]));
  });

  it("PageLoading is a body, and says what is coming", () => {
    render(<PageLoading rows={3} label="Loading sessions" />);
    expect(screen.getByRole("status", { name: "Loading sessions" })).toBeInTheDocument();
  });

  it("PageLoading draws one skeleton per row it was told to expect", () => {
    const { container } = render(<PageLoading rows={4} label="Loading" />);
    expect(container.querySelectorAll("[data-ps-skeleton]")).toHaveLength(4);
  });

  /**
   * One announcement for the group. `getByRole("status", { name })` finds the
   * wrapper whether or not the four skeletons inside it also announce, so it
   * cannot see the defect it exists to prevent: a screen reader hearing
   * "loading" five times for one page.
   */
  it("announces once, however many rows it draws", () => {
    const { container } = render(<PageLoading rows={4} label="Loading sessions" />);
    expect(container.querySelectorAll("[role=status]")).toHaveLength(1);
  });

  /**
   * The one that matters most, because a wrong number is worse than no number:
   * three screens render a confident `0` before their fetch resolves.
   */
  it.each([
    [undefined, "—"],
    [null, "—"],
    [0, "0"],
    [12, "12"],
  ])("pendingCount(%s) renders %s", (value, expected) => {
    expect(pendingCount(value as number | undefined)).toBe(expected);
  });

  it("EmptyState lives in its own file and still renders", () => {
    render(<EmptyState icon={Dot} title="No sessions yet" description="Run one." />);
    expect(screen.getByText("No sessions yet")).toBeInTheDocument();
    expect(screen.getByText("Run one.")).toBeInTheDocument();
  });
});
