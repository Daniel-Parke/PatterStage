/** @jest-environment node */
/**
 * U12 (T-0126): the pilot proof that the primitive set covers a real screen.
 *
 * Seventeen of the Rec Room's eighteen components imported nothing from
 * src/components/ui: ~4,100 lines outside the design system entirely, with
 * their own buttons, their own overlays, their own cards and their own colour.
 * The primitives exist since U8 and U11; this is the first module converted
 * wholesale, and these are the shapes a converted module must hold.
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = join(__dirname, "..", "..");
const APP = join(ROOT, "src", "app", "recroom");
const COMPONENTS = join(ROOT, "src", "modules", "rec-room", "components");

function files(dir: string, ext: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files(full, ext, out);
    else if (entry.endsWith(ext)) out.push(full);
  }
  return out;
}

const RAW_CONTROL = /<(?:button|input|select|textarea)(?=[\s/>])/;
const RAW_OVERLAY = /fixed inset-0/;
const RAW_PALETTE = /(?<![\w-])(?:bg|text|border|from|to|ring)-(?:red|green|blue|orange|yellow|cyan|emerald|purple|white)-\d{2,3}/;
const RAW_Z = /(?<![\w-])z-\[/;

describe("the two pages", () => {
  const pages = files(APP, "page.tsx").map((f) => relative(ROOT, f).replace(/\\/g, "/"));

  it("are two, and a layout", () => {
    expect(pages.sort()).toEqual([
      "src/app/recroom/story-weaver/[id]/page.tsx",
      "src/app/recroom/story-weaver/create/page.tsx",
      "src/app/recroom/story-weaver/page.tsx",
    ]);
  });

  it.each(files(APP, ".tsx").map((f) => [relative(ROOT, f).replace(/\\/g, "/")]))(
    "%s draws no raw control, no hand-rolled overlay, no literal palette and no arbitrary z",
    (rel) => {
      const lines = readFileSync(join(ROOT, rel), "utf-8").split("\n");
      const offend = (re: RegExp) => lines.map((l, i) => (re.test(l) ? `${i + 1}: ${l.trim()}` : null)).filter(Boolean);
      expect({ rel, controls: offend(RAW_CONTROL) }).toEqual({ rel, controls: [] });
      expect({ rel, overlays: offend(RAW_OVERLAY) }).toEqual({ rel, overlays: [] });
      expect({ rel, palette: offend(RAW_PALETTE) }).toEqual({ rel, palette: [] });
      expect({ rel, z: offend(RAW_Z) }).toEqual({ rel, z: [] });
    },
  );
});

describe("the module's components", () => {
  const names = readdirSync(COMPONENTS).filter((f) => f.endsWith(".tsx"));
  const src = (name: string) => readFileSync(join(COMPONENTS, name), "utf-8");

  /**
   * Four, not two. The oracle was written before the conversion and named a
   * toggle chip and a chapter row; the conversion found three more controls
   * with no primitive: a 24px chapter dot whose coloured fill IS its meaning
   * (ChapterDots), a disclosure row with a name, a summary and a role
   * (CharacterCard), and the reader's range slider (ReaderSettings). Each is
   * a real gap in the set, recorded on the task; none is a button that should
   * have been a Button. The toggle chip (Tags) turned out not to be a gap:
   * Button passes aria-pressed through, and C6 (T-0143) made the chips Buttons.
   */
  it("draw a raw control only where there is no primitive for the thing", () => {
    const withButtons = names.filter((n) => RAW_CONTROL.test(src(n))).sort();
    expect(withButtons).toEqual(["ChapterDots.tsx", "ChapterList.tsx", "CharacterCard.tsx", "ReaderSettings.tsx"]);
  });

  it("hand-roll an overlay only for the progress status, which is not a dialog", () => {
    const withOverlays = names.filter((n) => RAW_OVERLAY.test(src(n))).sort();
    expect(withOverlays).toEqual(["GenerateOverlay.tsx"]);
  });

  it.each(["ContinueStoryModal.tsx", "EditChapterModal.tsx", "StoryBiblePanel.tsx", "MobileChapterDrawer.tsx"])(
    "%s is a Dialog",
    (name) => {
      expect(src(name)).toMatch(/from "@\/components\/ui\/Dialog"/);
    },
  );

  it("carry no arbitrary z-index: the ladder has a rung for every layer they use", () => {
    const withZ = names.filter((n) => RAW_Z.test(src(n)));
    expect(withZ).toEqual([]);
  });

  it("most of them import the design system now, where one did before", () => {
    const importing = names.filter((n) => /from "@\/components\/ui\//.test(src(n)));
    expect(importing.length).toBeGreaterThanOrEqual(12);
  });

  it("the two library panels and their two editors exist", () => {
    for (const name of ["ThemeLibraryPanel.tsx", "CharacterLibraryPanel.tsx", "ThemeEditorDialog.tsx", "CharacterEditorDialog.tsx"]) {
      expect({ name, present: names.includes(name) }).toEqual({ name, present: true });
    }
  });
});
