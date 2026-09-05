/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-require-imports -- ConceptHint,
   HelpProvider and the attachment table do not exist in the tree yet, so a
   static import would not compile. Each require sits in a helper called from
   the test that needs it. */

// ═══════════════════════════════════════════════════════════════
// B16 oracle, ConceptHint.
//
// Contract section 5. The popover is where a new operator meets a word for the
// first time, which makes it the one control in the batch a keyboard user is
// most likely to land on by accident. Its contract is therefore an
// accessibility contract before it is a design one:
//
//   · the trigger is a real <button>, so Enter and Space work without code;
//   · aria-expanded says which state it is in;
//   · aria-describedby points at the panel WHILE OPEN, and the panel carries
//     that id, so a screen reader reads the definition with the term;
//   · Escape closes it and gives focus back to the trigger;
//   · closed means gone from the DOM, not hidden with an id still pointed at.
//
// And the negative half, which is the part that rots quietly: a concept id the
// corpus does not carry, or a corpus that has not been built at all, renders
// PLAIN TEXT. A control that opens an empty box is worse than no control.
//
// The last two describes pin the coverage: the nine screens and seventeen terms
// the plan names, and the data table that docs:check reads.
// ═══════════════════════════════════════════════════════════════

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";

import { allModuleRoutes } from "@/lib/modules/registry";

// ── Module doubles ──────────────────────────────────────────────

jest.mock("next/navigation", () => ({
  usePathname: () => "/work/missions",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock("lucide-react", () => {
  const icon = (name: string) =>
    function Icon(props: Record<string, unknown>) {
      return <svg data-icon={name} aria-hidden="true" {...props} />;
    };
  return new Proxy({}, { get: (_t, prop: string) => icon(prop) });
});

// ── The components under contract ───────────────────────────────

interface ConceptEntry {
  id: string;
  term: string;
  short: string;
  slug: string;
}

type ProviderProps = {
  screens: Record<string, string>;
  concepts: Record<string, ConceptEntry>;
  children: ReactNode;
};

function helpProvider(): ComponentType<ProviderProps> {
  let mod: { HelpProvider?: unknown };
  try {
    mod = require("@/components/help/HelpProvider") as { HelpProvider?: unknown };
  } catch (err) {
    throw new Error(
      "B16 owes src/components/help/HelpProvider.tsx (contract 4.1). require() said: " + String(err),
    );
  }
  if (typeof mod.HelpProvider !== "function") {
    throw new Error("src/components/help/HelpProvider.tsx must export HelpProvider (contract 4.1).");
  }
  return mod.HelpProvider as ComponentType<ProviderProps>;
}

function conceptHint(): ComponentType<{ id: string; children?: ReactNode; className?: string }> {
  let mod: { default?: unknown };
  try {
    mod = require("@/components/help/ConceptHint") as { default?: unknown };
  } catch (err) {
    throw new Error(
      "B16 owes src/components/help/ConceptHint.tsx (contract 5.1). require() said: " + String(err),
    );
  }
  if (typeof mod.default !== "function") {
    throw new Error(
      "src/components/help/ConceptHint.tsx must default-export ConceptHint (contract 5.1).",
    );
  }
  return mod.default as ComponentType<{ id: string; children?: ReactNode; className?: string }>;
}

function attachments(): ReadonlyArray<{ screen: string; conceptIds: string[] }> {
  let mod: { CONCEPT_ATTACHMENTS?: unknown };
  try {
    mod = require("@/lib/help/concept-attachments") as { CONCEPT_ATTACHMENTS?: unknown };
  } catch (err) {
    throw new Error(
      "B16 owes src/lib/help/concept-attachments.ts (contract 2.3). require() said: " + String(err),
    );
  }
  if (!Array.isArray(mod.CONCEPT_ATTACHMENTS)) {
    throw new Error(
      "src/lib/help/concept-attachments.ts must export CONCEPT_ATTACHMENTS (contract 2.3).",
    );
  }
  return mod.CONCEPT_ATTACHMENTS as ReadonlyArray<{ screen: string; conceptIds: string[] }>;
}

// ── Fixtures ────────────────────────────────────────────────────

const AGENT: ConceptEntry = {
  id: "agent",
  term: "Agent",
  short: "The thing that does the work: a model, a prompt and a set of tools.",
  slug: "concepts/agent",
};

function withConcepts(children: ReactNode, concepts: Record<string, ConceptEntry> = { agent: AGENT }) {
  const Provider = helpProvider();
  return render(
    <Provider screens={{}} concepts={concepts}>
      {children}
    </Provider>,
  );
}

const ROOT = join(__dirname, "..", "..");

// ── The declared coverage (contract 5.2) ────────────────────────

/** Nine screens, seventeen terms. The plan's B16 bullet, spelled out. */
const ATTACHMENTS: ReadonlyArray<{ screen: string; dirs: string[]; conceptIds: string[] }> = [
  {
    screen: "/work/chat",
    dirs: ["src/app/work/chat", "src/components/chat"],
    conceptIds: ["agent", "prompt"],
  },
  {
    screen: "/work/missions",
    dirs: ["src/app/work/missions", "src/components/missions"],
    conceptIds: ["mission", "run", "schedule"],
  },
  {
    screen: "/agent/profiles",
    dirs: ["src/app/agent/profiles", "src/components/profiles", "src/components/agents"],
    conceptIds: ["profile", "personality"],
  },
  {
    screen: "/agent/skills",
    dirs: ["src/app/agent/skills", "src/components/skills"],
    conceptIds: ["skill"],
  },
  {
    screen: "/agent/tools",
    dirs: ["src/app/agent/tools", "src/components/tools"],
    conceptIds: ["tool", "toolset"],
  },
  {
    screen: "/agent/memory",
    dirs: ["src/app/agent/memory", "src/components/memory"],
    conceptIds: ["memory"],
  },
  {
    screen: "/agent/models",
    dirs: ["src/app/agent/models", "src/components/models"],
    conceptIds: ["model", "provider", "api-key"],
  },
  {
    screen: "/work/composer",
    dirs: ["src/app/work/composer", "src/components/composer"],
    conceptIds: ["workflow", "gate"],
  },
  {
    screen: "/work/research",
    dirs: ["src/app/work/research", "src/components/research"],
    conceptIds: ["artifact"],
  },
];

const DECLARED_IDS = [...new Set(ATTACHMENTS.flatMap((a) => a.conceptIds))].sort();

// ── Closed, open, and closed again (contract 5.1) ───────────────

describe("ConceptHint is a button with a description, not a hover trick", () => {
  it("starts closed: no description, no panel, and it says so", () => {
    const Hint = conceptHint();
    withConcepts(<Hint id="agent">agent</Hint>);
    const trigger = screen.getByRole("button", { name: "agent" });
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).toHaveAttribute("type", "button");
    expect(trigger).not.toHaveAttribute("tabindex", "-1");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByText(AGENT.short)).toBeNull();
  });

  it("wires aria-describedby to the panel that carries the definition", () => {
    const Hint = conceptHint();
    withConcepts(<Hint id="agent">agent</Hint>);
    const trigger = screen.getByRole("button", { name: "agent" });
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const describedBy = trigger.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const panel = document.getElementById(describedBy!);
    expect(panel).not.toBeNull();
    expect(panel).toHaveTextContent(AGENT.short);
    expect(panel).toHaveTextContent("Agent");
  });

  it("offers the whole concept page from inside the panel", () => {
    const Hint = conceptHint();
    withConcepts(<Hint id="agent">agent</Hint>);
    fireEvent.click(screen.getByRole("button", { name: "agent" }));
    expect(screen.getByRole("link", { name: /read more about agent/i })).toHaveAttribute(
      "href",
      "/help/concepts/agent",
    );
  });

  it("closes on Escape and gives focus back to the trigger", () => {
    const Hint = conceptHint();
    withConcepts(<Hint id="agent">agent</Hint>);
    const trigger = screen.getByRole("button", { name: "agent" });
    trigger.focus();
    fireEvent.click(trigger);

    const link = screen.getByRole("link", { name: /read more about agent/i });
    link.focus();
    expect(document.activeElement).toBe(link);

    fireEvent.keyDown(link, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByText(AGENT.short)).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes when the pointer goes elsewhere", () => {
    const Hint = conceptHint();
    withConcepts(<Hint id="agent">agent</Hint>);
    const trigger = screen.getByRole("button", { name: "agent" });
    fireEvent.click(trigger);
    expect(screen.getByText(AGENT.short)).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    fireEvent.click(document.body);
    expect(screen.queryByText(AGENT.short)).toBeNull();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("gives two hints for the same word two panel ids", () => {
    const Hint = conceptHint();
    withConcepts(
      <>
        <Hint id="agent">agent</Hint>
        <Hint id="agent">agent</Hint>
      </>,
    );
    const [first, second] = screen.getAllByRole("button", { name: "agent" });
    fireEvent.click(first);
    fireEvent.click(second);
    const ids = [first, second].map((b) => b.getAttribute("aria-describedby"));
    expect(ids[0]).toBeTruthy();
    expect(ids[0]).not.toBe(ids[1]);
    expect(document.getElementById(ids[1]!)).not.toBeNull();
  });
});

// ── The two empties (contract 5.1, 5.4) ─────────────────────────

describe("a word the corpus does not define is a word, not a broken control", () => {
  it("renders plain text for an id that is not in concepts.json", () => {
    const Hint = conceptHint();
    withConcepts(<Hint id="quantum-flux">quantum flux</Hint>);
    expect(screen.getByText("quantum flux")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders plain text when Help has not been built at all", () => {
    const Hint = conceptHint();
    withConcepts(<Hint id="agent">agent</Hint>, {});
    expect(screen.getByText("agent")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders plain text with no provider above it", () => {
    const Hint = conceptHint();
    render(<Hint id="agent">agent</Hint>);
    expect(screen.getByText("agent")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

// ── It is not a dialog (contract 5.1) ───────────────────────────

describe("the popover is not a modal, and must not pretend to be one", () => {
  it("paints no full-screen overlay and traps no focus", () => {
    const file = join(ROOT, "src", "components", "help", "ConceptHint.tsx");
    if (!existsSync(file)) {
      throw new Error("B16 owes src/components/help/ConceptHint.tsx (contract 5.1).");
    }
    const src = readFileSync(file, "utf-8");
    expect(src).not.toMatch(/fixed inset-0/);
    expect(src).not.toMatch(/useDialogA11y/);
    expect(src).not.toMatch(/aria-modal/);
  });
});

// ── Where it attaches (contract 5.2) ────────────────────────────

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...filesUnder(full));
    else if (full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** Every `<ConceptHint … id="x">` in the tree, id by id. */
function usedConceptIds(): string[] {
  const out: string[] = [];
  for (const file of filesUnder(join(ROOT, "src"))) {
    const src = readFileSync(file, "utf-8");
    const re = /<ConceptHint\b[\s\S]{0,240}?\bid="([a-z0-9-]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) out.push(m[1]);
  }
  return out;
}

describe("the nine screens and seventeen terms the plan names", () => {
  it("finds the screen directories, so an empty walk cannot read as a pass", () => {
    for (const a of ATTACHMENTS) {
      const files = a.dirs.flatMap((d) => filesUnder(join(ROOT, ...d.split("/"))));
      expect({ screen: a.screen, files: files.length > 0 }).toEqual({ screen: a.screen, files: true });
    }
  });

  it("names a registry route for each one", () => {
    const routes = new Set(allModuleRoutes());
    expect(ATTACHMENTS.map((a) => a.screen).filter((s) => !routes.has(s))).toEqual([]);
  });

  it("attaches every declared term on its own screen", () => {
    const missing: Array<{ screen: string; id: string }> = [];
    for (const a of ATTACHMENTS) {
      const sources = a.dirs
        .flatMap((d) => filesUnder(join(ROOT, ...d.split("/"))))
        .map((f) => readFileSync(f, "utf-8"));
      for (const id of a.conceptIds) {
        const re = new RegExp(`<ConceptHint\\b[\\s\\S]{0,240}?\\bid="${id}"`);
        if (!sources.some((s) => re.test(s))) missing.push({ screen: a.screen, id });
      }
    }
    expect(missing).toEqual([]);
  });

  it("uses no concept id outside the declared seventeen", () => {
    const used = usedConceptIds();
    expect(used.length).toBeGreaterThanOrEqual(17);
    expect([...new Set(used)].filter((id) => !DECLARED_IDS.includes(id)).sort()).toEqual([]);
  });
});

describe("the attachment table is data, so docs:check can read it", () => {
  it("carries the same nine screens and the same terms as the contract", () => {
    const table = attachments()
      .map((a) => ({ screen: a.screen, conceptIds: [...a.conceptIds] }))
      .sort((x, y) => x.screen.localeCompare(y.screen));
    const expected = ATTACHMENTS.map((a) => ({ screen: a.screen, conceptIds: [...a.conceptIds] })).sort(
      (x, y) => x.screen.localeCompare(y.screen),
    );
    expect(table).toEqual(expected);
  });

  it("names seventeen distinct concept ids", () => {
    const ids = [...new Set(attachments().flatMap((a) => a.conceptIds))].sort();
    expect(ids).toEqual(DECLARED_IDS);
    expect(ids).toHaveLength(17);
  });
});
