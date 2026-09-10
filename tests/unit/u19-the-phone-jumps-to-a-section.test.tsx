/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * U19 · The phone jumps to a section.
 *
 * Settings' sticky section list became, at 390, one row running off the
 * right edge ("Agent Settings · Display Settings · Memory Setting…") with no
 * scroll affordance (the UI review of 2026-09-08, P3). Below lg the nav is a
 * select, "Jump to section", that moves the page; from lg the list is as it
 * was. The select is the ui primitive, so the accessible name, the ring and
 * the chrome are the house's.
 */

import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());
jest.mock("next/link", () => require("../helpers/mocks").nextLinkMock());

import SettingsNav from "@/components/config/SettingsNav";
import type { SectionDef } from "@/lib/config/config-schema";

const section = (id: string, label: string) => ({ id, label }) as unknown as SectionDef;
const groups = [
  { label: "Agent", sections: [section("agent", "Agent Settings"), section("memory", "Memory Settings")] },
  { label: "Integrations", sections: [section("display", "Display Settings")] },
];

describe("U19 · the phone jumps to a section", () => {
  afterEach(() => {
    window.location.hash = "";
  });

  it("offers a select below lg that names every section, and moves the page", () => {
    render(<SettingsNav groups={groups} tools={[]} activeId="agent" />);
    const select = screen.getByRole("combobox", { name: "Jump to section" });
    expect(select.closest(".lg\\:hidden")).not.toBeNull();
    const labels = Array.from((select as HTMLSelectElement).options).map((o) => o.textContent);
    expect(labels).toEqual(expect.arrayContaining(["Agent Settings", "Memory Settings", "Display Settings"]));
    expect((select as HTMLSelectElement).value).toBe("agent");
    fireEvent.change(select, { target: { value: "memory" } });
    expect(window.location.hash).toBe("#memory");
  });

  it("keeps the list for lg and up, and hides it below", () => {
    render(<SettingsNav groups={groups} tools={[]} activeId={null} />);
    const link = screen.getByRole("link", { name: "Memory Settings" });
    const list = link.closest("ul")!.parentElement!.parentElement!;
    expect(list).toHaveClass("hidden");
    expect(list).toHaveClass("lg:block");
  });
});
