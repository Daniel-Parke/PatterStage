/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-require-imports */
// ═══════════════════════════════════════════════════════════════
// B7 oracle, group memory-tab (T-0101, the plan's "confirm on directive and
// mental-model delete").
//
// Written before the product code moved. A directive is a standing instruction
// injected into every agent prompt and a mental model is a saved query the
// operator has curated; both delete on a single click of a bare trash icon,
// with no confirmation anywhere on the path. Every other destructive row action
// in the product is two clicks (T-0096's ConfirmButton, the models table's
// PerRowDeleteButton, the credentials panel). These two were missed.
//
// The contract is the house pattern: the first click arms and names what it is
// about to delete, the second click deletes, and an armed button is never
// disabled by being armed.
// ═══════════════════════════════════════════════════════════════

import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());

import DirectivesTab from "@/components/memory/hindsight/DirectivesTab";
import MentalModelsTab from "@/components/memory/hindsight/MentalModelsTab";
import { RowDeleteButton } from "@/components/memory/hindsight/RowActionButtons";
import type { Directive, MentalModel } from "@/components/memory/hindsight/types";

// ── pre-B7 type shim: the button learns whose row it is ─────────

type DeleteProps = React.ComponentProps<typeof RowDeleteButton> & { label?: string };
const DeleteButton = RowDeleteButton as unknown as React.ComponentType<DeleteProps>;

const DIRECTIVE: Directive = {
  id: "d1",
  name: "Always cite sources",
  content: "Cite the file and line for every claim.",
  priority: 1,
  is_active: true,
  tags: [],
  created_at: "2026-09-01T00:00:00Z",
};

const MODEL: MentalModel = {
  id: "mm1",
  name: "Release readiness",
  source_query: "what blocks the release",
  content: "…",
  tags: [],
  created_at: "2026-09-01T00:00:00Z",
  last_refreshed_at: "2026-09-01T00:00:00Z",
};

describe("RowDeleteButton is two clicks", () => {
  it("the first click arms and names the row, and deletes nothing", () => {
    const onClick = jest.fn();
    render(<DeleteButton onClick={onClick} label="Always cite sources" />);

    const button = screen.getByRole("button", { name: "Delete Always cite sources" });
    fireEvent.click(button);

    expect(onClick).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Click again to confirm deleting Always cite sources" }),
    ).toBeInTheDocument();
  });

  it("the second click deletes, once", () => {
    const onClick = jest.fn();
    render(<DeleteButton onClick={onClick} label="Always cite sources" />);

    const button = screen.getByRole("button", { name: /Always cite sources/ });
    fireEvent.click(button);
    expect(button).not.toBeDisabled();
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("the two tabs that had no confirmation now have one", () => {
  it("a directive takes two clicks to delete", () => {
    const onDelete = jest.fn();
    render(
      <DirectivesTab
        directives={[DIRECTIVE]}
        loading={false}
        onCreateClick={jest.fn()}
        onRefresh={jest.fn()}
        onEdit={jest.fn()}
        onToggle={jest.fn()}
        onDelete={onDelete}
      />,
    );

    const button = screen.getByRole("button", { name: "Delete Always cite sources" });
    fireEvent.click(button);
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Click again to confirm deleting/ }));
    expect(onDelete).toHaveBeenCalledWith("d1");
  });

  it("a mental model takes two clicks to delete", () => {
    const onDelete = jest.fn();
    render(
      <MentalModelsTab
        models={[MODEL]}
        loading={false}
        refreshingModelId={null}
        onCreateClick={jest.fn()}
        onRefresh={jest.fn()}
        onEdit={jest.fn()}
        onRefreshModel={jest.fn()}
        onDelete={onDelete}
      />,
    );

    const button = screen.getByRole("button", { name: "Delete Release readiness" });
    fireEvent.click(button);
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Click again to confirm deleting/ }));
    expect(onDelete).toHaveBeenCalledWith("mm1");
  });

  it("GREEN CONTROL: Edit is still one click and still named", () => {
    const onEdit = jest.fn();
    render(
      <DirectivesTab
        directives={[DIRECTIVE]}
        loading={false}
        onCreateClick={jest.fn()}
        onRefresh={jest.fn()}
        onEdit={onEdit}
        onToggle={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByTitle("Edit"));

    expect(onEdit).toHaveBeenCalledWith(DIRECTIVE);
  });
});
