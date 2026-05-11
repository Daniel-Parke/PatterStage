import { TEMPLATES } from "@/lib/mission-helpers";

describe("built-in mission templates", () => {
  it("ships a minimal Hermes-aligned template set", () => {
    expect(TEMPLATES.length).toBe(3);
  });

  it("has unique ids", () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
