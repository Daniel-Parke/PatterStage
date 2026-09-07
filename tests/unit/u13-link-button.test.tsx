/** @jest-environment jsdom */
/**
 * U13 (T-0127): LinkButton, the primitive S4 named and nobody had built.
 *
 * A link that looks like a button was hand-rolled wherever one was wanted:
 * the quest row's Go, the Start here card's Go and All quests, the Progress
 * line's Quests, the dashboard's Session browser. Each was its own class
 * string at its own height, and none of them was one of Button's three. This
 * is Next's Link wearing Button's chrome, so a link and a button beside each
 * other are the same height and the same shape.
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import { render, screen } from "@testing-library/react";

jest.mock("lucide-react", () => {
  const passthrough = () => () => null;
  return new Proxy({}, { get: () => passthrough() });
});

import LinkButton from "@/components/ui/LinkButton";

const ROOT = join(__dirname, "..", "..");

describe("LinkButton", () => {
  it("is a link, on the button chrome, at the medium height by default", () => {
    render(<LinkButton href="/quests">Quests</LinkButton>);
    const link = screen.getByRole("link", { name: "Quests" });
    expect(link).toHaveAttribute("href", "/quests");
    expect(link.className).toMatch(/\binline-flex\b/);
    expect(link.className).toMatch(/\brounded-ps-md\b/);
    expect(link.className).toMatch(/\bfont-mono\b/);
    expect(link.className).toMatch(/\bh-8\b/);
  });

  it.each([
    ["sm", /\bh-6\.5\b/],
    ["md", /\bh-8\b/],
    ["lg", /\bh-10\b/],
  ] as const)("takes Button's %s height", (size, height) => {
    render(<LinkButton href="/x" size={size}>Go</LinkButton>);
    expect(screen.getByRole("link").className).toMatch(height);
  });

  it("takes a variant and a colour, and passes a name and a title through", () => {
    render(
      <LinkButton href="/x" variant="primary" color="orange" aria-label="Open the quest" title="Go">
        Go
      </LinkButton>,
    );
    const link = screen.getByRole("link", { name: "Open the quest" });
    expect(link).toHaveAttribute("title", "Go");
    expect(link.className).toMatch(/orange/);
  });

  it("renders its icon before its label", () => {
    const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
    render(<LinkButton href="/x" icon={Icon}>Go</LinkButton>);
    const link = screen.getByRole("link");
    expect(link.firstElementChild).toBe(screen.getByTestId("icon"));
  });
});

function files(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files(full, out);
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("its callers", () => {
  it("are at least three, outside ui/, which is what earns a primitive its place", () => {
    const callers = files(join(ROOT, "src"))
      .filter((f) => !f.replace(/\\/g, "/").includes("/components/ui/"))
      .filter((f) => /from "@\/components\/ui\/LinkButton"/.test(readFileSync(f, "utf-8")))
      .map((f) => relative(ROOT, f).replace(/\\/g, "/"));
    expect(callers.length).toBeGreaterThanOrEqual(3);
  });
});
