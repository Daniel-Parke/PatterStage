/** @jest-environment node */

import { renderToStaticMarkup } from "react-dom/server";
import { Field } from "../../src/components/ui/field/Field";
import { Select } from "../../src/components/ui/field/Select";
import { NumberInput, Input } from "../../src/components/ui/field";
import AutoTextarea from "../../src/components/ui/AutoTextarea";

function associatedId(html: string, control: "button" | "input" | "textarea"): string {
  const forId = html.match(/<label[^>]*for="([^"]+)"/)?.[1];
  const controlId = html.match(new RegExp(`<${control}[^>]*id="([^"]+)"`))?.[1];
  expect(forId).toBeTruthy();
  expect(controlId).toBe(forId);
  return controlId ?? "";
}

describe("T-0162 · house controls keep visible labels associated", () => {
  it("Field associates its label with the Select button", () => {
    const html = renderToStaticMarkup(<Field label="Provider"><Select value="a" onChange={() => undefined} options={[{ value: "a", label: "A" }]} /></Field>);
    expect(associatedId(html, "button")).toBeTruthy();
  });

  it("NumberInput associates its own label with the spinbutton", () => {
    const html = renderToStaticMarkup(<NumberInput label="Limit" value={2} onChange={() => undefined} />);
    expect(associatedId(html, "input")).toBeTruthy();
  });

  it("TextInput associates its own label with the textbox", () => {
    const html = renderToStaticMarkup(<Field label="Name"><Input value="" onChange={() => undefined} /></Field>);
    expect(associatedId(html, "input")).toBeTruthy();
  });

  it("Field associates its label with AutoTextarea", () => {
    const html = renderToStaticMarkup(<Field label="Prompt"><AutoTextarea value="" onChange={() => undefined} /></Field>);
    expect(associatedId(html, "textarea")).toBeTruthy();
  });

  it("AutoTextarea does not override a Field label with its placeholder", () => {
    const html = renderToStaticMarkup(<Field label="Prompt"><AutoTextarea value="" onChange={() => undefined} placeholder="Example text" /></Field>);
    expect(html).not.toContain('aria-label="Example text"');
    expect(associatedId(html, "textarea")).toBeTruthy();
  });
});
