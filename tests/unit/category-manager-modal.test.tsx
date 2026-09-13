/** @jest-environment jsdom */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";

jest.mock("lucide-react", () => ({
  ChevronDown: () => "v",
  Pencil: () => "P",
  Plus: () => "+",
  Trash2: () => "T",
}));

jest.mock("@/components/ui/Modal", () => ({
  __esModule: true,
  default: ({
    open,
    title,
    children,
  }: {
    open: boolean;
    title: string;
    children: React.ReactNode;
  }) =>
    open ? (
      <div>
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
}));

import CategoryManagerModal from "@/components/missions/CategoryManagerModal";

describe("CategoryManagerModal", () => {
  it("shows empty state when no categories", () => {
    render(
      <CategoryManagerModal
        open
        onClose={jest.fn()}
        categories={[]}
        onRefresh={jest.fn()}
        onCreateCategory={jest.fn().mockResolvedValue(null)}
        onUpdate={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    expect(screen.getByText(/No categories yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create category/i })).toBeInTheDocument();
  });

  it("calls onCreateCategory when creating from form", async () => {
    const onCreateCategory = jest.fn().mockResolvedValue("ops-id");
    render(
      <CategoryManagerModal
        open
        onClose={jest.fn()}
        categories={[]}
        onRefresh={jest.fn()}
        onCreateCategory={onCreateCategory}
        onUpdate={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Category name"), {
      target: { value: "Operations" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create category/i }));
    await waitFor(() => {
      expect(onCreateCategory).toHaveBeenCalledWith("Operations", "cyan");
    });
  });
});
