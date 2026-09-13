import { screen } from "@testing-library/react";

/**
 * The header's subtitle: the <p> under the page's one h1.
 *
 * Since U18 (T-0132) the subtitle is body prose with any count inside it in
 * its own mono span, so `getByText(/8 profiles/)` no longer matches: the
 * sentence is not one text node. Read the paragraph and assert on its text
 * content, which joins the spans back into the sentence a person reads.
 */
export function pageSubtitle(): HTMLElement {
  const h1 = screen.getByRole("heading", { level: 1 });
  const p = h1.nextElementSibling;
  if (!p || p.tagName !== "P") throw new Error("no subtitle under the h1");
  return p as HTMLElement;
}
