/**
 * The Categories tile must agree with the category rows beneath it.
 *
 * This tile sits directly above the list it describes, so the two have to be
 * counted the same way. They were not: the tile kept a private
 * `category.toLowerCase()` Set while the list grouped through
 * `groupByCategory`. That matched only while the grouping key was also a bare
 * lowercase. T-0037 taught the key to fold hyphens, underscores and whitespace
 * runs, and the tile immediately began disagreeing with the rows: "Control Hub"
 * and "control-hub" render as ONE row and were counted as TWO.
 *
 * Caught by review before it shipped. It is the same defect class the Sessions
 * tiles are being fixed for, on the page the grouping fix was fixing, which is
 * why it is pinned here rather than left to a comment.
 */
import { render, screen } from "@testing-library/react";
import SkillsInsights from "@/components/skills/SkillsInsights";
import { groupByCategory } from "@/lib/skills-grouping";

const skill = (category: string) => ({ category });

describe("SkillsInsights category count", () => {
  it("counts spellings that render as one row as one category", () => {
    // These three fold to the same bucket and render a single row.
    const skills = [skill("Control Hub"), skill("control-hub"), skill("CONTROL_HUB")];
    render(<SkillsInsights skills={skills} activeCount={3} />);
    // The old private Set counted 3 here. The list has always rendered 1.
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("agrees with groupByCategory for a mixed catalogue", () => {
    const skills = [
      skill("Creative"), skill("creative"),
      skill("Fine-Tuning"), skill("Fine Tuning"),
      skill("Research"),
    ];
    const rows = groupByCategory(skills, "Other").length;
    expect(rows).toBe(3); // creative, fine tuning, research
    render(<SkillsInsights skills={skills} activeCount={0} />);
    expect(screen.getByText(String(rows))).toBeInTheDocument();
  });

  it("counts an uncategorised skill in the same bucket the page shows it in", () => {
    // The page groups with "Other" as its fallback, so the tile must too;
    // otherwise a catalogue of only uncategorised skills reads as 0 categories
    // above a visible Other row.
    const skills = [{ category: undefined }, { category: undefined }];
    render(<SkillsInsights skills={skills} activeCount={0} />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders nothing at all for an empty catalogue", () => {
    const { container } = render(<SkillsInsights skills={[]} activeCount={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
