/** @jest-environment jsdom */

import { render } from "@testing-library/react";
import { SimpleMarkdown } from "@/components/skills/SimpleMarkdown";

describe("SimpleMarkdown", () => {
  it("renders fenced code blocks with language label", () => {
    const { container } = render(
      <SimpleMarkdown content={"```bash\necho hello\n```"} />,
    );
    // The language label
    expect(container.textContent).toContain("bash");
    // The code body
    expect(container.textContent).toContain("echo hello");
    // And the <pre> is present
    expect(container.querySelector("pre")).toBeInTheDocument();
  });

  it("renders GFM tables with header and rows", () => {
    const md = [
      "| Path | Purpose |",
      "|------|---------|",
      "| /api/sessions | List sessions |",
      "| /api/cron | List cron jobs |",
    ].join("\n");
    const { container } = render(<SimpleMarkdown content={md} />);

    // Has a <table>
    expect(container.querySelector("table")).toBeInTheDocument();
    // Has thead with the two column headers
    const headers = container.querySelectorAll("th");
    expect(headers.length).toBe(2);
    expect(headers[0].textContent).toBe("Path");
    expect(headers[1].textContent).toBe("Purpose");
    // Has tbody with two rows
    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain("/api/sessions");
    expect(rows[1].textContent).toContain("/api/cron");
  });

  it("honors GFM column alignment markers", () => {
    const md = [
      "| Left | Center | Right |",
      "|:-----|:------:|------:|",
      "| a | b | c |",
    ].join("\n");
    const { container } = render(<SimpleMarkdown content={md} />);
    const cells = container.querySelectorAll("td");
    expect(cells[0]).toHaveStyle({ textAlign: "left" });
    expect(cells[1]).toHaveStyle({ textAlign: "center" });
    expect(cells[2]).toHaveStyle({ textAlign: "right" });
  });

  it("renders headings, lists, inline code, bold, and italic together", () => {
    const md = [
      "# Title",
      "",
      "Para with **bold** and *italic* and `code`.",
      "",
      "- list item 1",
      "- list item 2",
    ].join("\n");
    const { container } = render(<SimpleMarkdown content={md} />);

    expect(container.querySelector("h1")?.textContent).toBe("Title");
    expect(container.querySelector("strong")?.textContent).toBe("bold");
    expect(container.querySelector("em")?.textContent).toBe("italic");
    expect(container.querySelector("code")?.textContent).toBe("code");
    expect(container.textContent).toContain("list item 1");
  });

  it("renders links as <a> elements with target=_blank", () => {
    const { container } = render(
      <SimpleMarkdown content={"Visit [Hermes](https://example.com) for more."} />,
    );
    const link = container.querySelector("a");
    expect(link).toBeInTheDocument();
    expect(link?.getAttribute("href")).toBe("https://example.com");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.textContent).toBe("Hermes");
  });

  it("does NOT treat a one-line pipe as a table (no separator)", () => {
    const { container } = render(
      <SimpleMarkdown content={"| not | a | table |"} />,
    );
    // No <table> should appear — a header row without a separator
    // following it is just text.
    expect(container.querySelector("table")).not.toBeInTheDocument();
  });

  it("flushes an in-progress table at end of input", () => {
    const md = [
      "| A | B |",
      "|---|---|",
      "| 1 | 2 |",
    ].join("\n");
    const { container } = render(<SimpleMarkdown content={md} />);
    expect(container.querySelector("table")).toBeInTheDocument();
  });
});
