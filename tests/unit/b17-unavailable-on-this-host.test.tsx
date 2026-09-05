/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-require-imports -- the quest modules do not exist yet; a static import would fail typecheck:tests instead of failing this test for the contract reason */

// ═══════════════════════════════════════════════════════════════
// B17 oracle: "unavailable on this host — here is why".
//
// Contract §7. Four of the thirty-two quests cannot be attempted on every
// install: chat and dispatch need a reachable agent, retaining a fact needs a
// memory provider, the Composer quests need the flag, and scheduling a host
// script needs a host scheduler — which native Windows does not have
// (decision 10). The plan is explicit about what such a quest must do: render
// "unavailable on this host — here is why", and "script scheduling on native
// Windows reads exactly that until B13's fallback exists, then completes
// through it".
//
// So the card must (a) never offer a Go the operator cannot follow, (b) say
// the reason in words a person can act on, (c) name no governance id, and
// (d) leave the quest in the count — a denominator that shrinks when a
// gateway goes down is a lie about how much of the programme is left.
//
// Written before src/lib/quests/ and src/components/quests/ exist.
// ═══════════════════════════════════════════════════════════════

import { render, screen } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  usePathname: () => "/quests",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
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

// ── the shapes the contract names ───────────────────────────────

type QuestRequirement = "gateway" | "memory" | "composer" | "host-scheduler";

interface QuestState {
  id: string;
  chapter: number;
  title: string;
  action: string;
  screen: string;
  teaches: string[];
  requires?: QuestRequirement;
  earns?: string;
  proof: { kind: "event"; event: string; target: number };
  met: boolean;
  completed: boolean;
  completedAt: string | null;
  skipped: boolean;
}

interface QuestHostCapabilities {
  gateway: boolean;
  memory: boolean;
  composer: boolean;
  hostScheduler: boolean;
}

interface RowProps {
  quest: QuestState;
  available: boolean;
  onSkip?: (id: string) => void;
  onUnskip?: (id: string) => void;
}

function questRow(): React.ComponentType<RowProps> {
  return (require("@/components/quests/QuestRow") as { default: React.ComponentType<RowProps> }).default;
}

interface DefsModule {
  HOST_REQUIREMENT_COPY: Record<QuestRequirement, string>;
  questAvailable: (def: { requires?: QuestRequirement }, host: QuestHostCapabilities) => boolean;
}
function defs(): DefsModule {
  return require("@/lib/quests/quest-defs") as DefsModule;
}

const ALL_THERE: QuestHostCapabilities = { gateway: true, memory: true, composer: true, hostScheduler: true };

function quest(over: Partial<QuestState> = {}): QuestState {
  return {
    id: "4.3",
    chapter: 4,
    title: "Schedule it",
    action: "Put the script you just ran on a timer so it runs without you.",
    screen: "/work/scripts",
    teaches: ["schedule"],
    requires: "host-scheduler",
    proof: { kind: "event", event: "script.scheduled", target: 1 },
    met: false,
    completed: false,
    completedAt: null,
    skipped: false,
    ...over,
  };
}

// ═══════════════════════════════════════════════════════════════
// the pure mapping
// ═══════════════════════════════════════════════════════════════

describe("questAvailable maps a requirement onto this host", () => {
  it("is true for a quest that requires nothing, whatever the host is missing", () => {
    const nothing: QuestHostCapabilities = { gateway: false, memory: false, composer: false, hostScheduler: false };
    expect(defs().questAvailable({}, nothing)).toBe(true);
  });

  it("reads each of the four requirements off its own capability", () => {
    const d = defs();
    expect(d.questAvailable({ requires: "gateway" }, { ...ALL_THERE, gateway: false })).toBe(false);
    expect(d.questAvailable({ requires: "memory" }, { ...ALL_THERE, memory: false })).toBe(false);
    expect(d.questAvailable({ requires: "composer" }, { ...ALL_THERE, composer: false })).toBe(false);
    expect(d.questAvailable({ requires: "host-scheduler" }, { ...ALL_THERE, hostScheduler: false })).toBe(false);
    for (const req of ["gateway", "memory", "composer", "host-scheduler"] as QuestRequirement[]) {
      expect(d.questAvailable({ requires: req }, ALL_THERE)).toBe(true);
    }
  });

  it("does not confuse one capability with another", () => {
    // A gateway that is down must not hide the Composer quests.
    expect(defs().questAvailable({ requires: "composer" }, { ...ALL_THERE, gateway: false })).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// the copy
// ═══════════════════════════════════════════════════════════════

describe("the four reasons are written for a person, not for a maintainer", () => {
  it("says what would change it, in one sentence each", () => {
    const copy = defs().HOST_REQUIREMENT_COPY;
    for (const req of ["gateway", "memory", "composer", "host-scheduler"] as QuestRequirement[]) {
      const line = copy[req];
      expect(typeof line).toBe("string");
      expect(line.trim().endsWith(".")).toBe(true);
      expect(line).not.toMatch(/[—]/); // docs/COPY.md: no em dash
      expect(line).not.toMatch(/\b(ADR-\d|WG-[A-Z]|RUL-[A-Z]|T-\d{4})\b/); // no governance id on a screen
    }
  });

  it("names the native-Windows boundary decision 10 records, and the way round it", () => {
    const line = defs().HOST_REQUIREMENT_COPY["host-scheduler"];
    expect(line).toMatch(/windows/i);
    expect(line).toMatch(/wsl2|scheduler/i);
  });

  it("names the switch for the Composer, so the operator can go and find it", () => {
    expect(defs().HOST_REQUIREMENT_COPY.composer).toMatch(/composer/i);
  });
});

// ═══════════════════════════════════════════════════════════════
// the card
// ═══════════════════════════════════════════════════════════════

describe("the row of a quest this host cannot run", () => {
  it("says it is unavailable on this host, and why", () => {
    const Row = questRow();
    render(<Row quest={quest()} available={false} />);
    expect(screen.getByText(/unavailable on this host/i)).toBeInTheDocument();
    expect(screen.getByText(defs().HOST_REQUIREMENT_COPY["host-scheduler"])).toBeInTheDocument();
  });

  it("offers no Go the operator cannot follow", () => {
    const Row = questRow();
    render(<Row quest={quest()} available={false} />);
    expect(screen.queryByRole("link", { name: /^go$/i })).toBeNull();
  });

  it("still shows the quest: its title and what it asks for", () => {
    const Row = questRow();
    render(<Row quest={quest()} available={false} />);
    expect(screen.getByText("Schedule it")).toBeInTheDocument();
    expect(screen.getByText(quest().action)).toBeInTheDocument();
  });

  it("never claims it is complete", () => {
    const Row = questRow();
    const { container } = render(<Row quest={quest()} available={false} />);
    expect(container.textContent ?? "").not.toMatch(/complete/i);
  });

  it("becomes an ordinary row the moment the host can run it", () => {
    // B13's fallback flips hostScheduler true and 4.3 completes through it
    // with no change to this component.
    const Row = questRow();
    render(<Row quest={quest()} available={true} />);
    expect(screen.queryByText(/unavailable on this host/i)).toBeNull();
    expect(screen.getByRole("link", { name: /^go$/i })).toHaveAttribute("href", "/work/scripts");
  });

  it("shows the reason for each of the four requirements, not one generic line", () => {
    const Row = questRow();
    for (const req of ["gateway", "memory", "composer", "host-scheduler"] as QuestRequirement[]) {
      const { unmount } = render(<Row quest={quest({ requires: req })} available={false} />);
      expect(screen.getByText(defs().HOST_REQUIREMENT_COPY[req])).toBeInTheDocument();
      unmount();
    }
  });

  it("says nothing about the host for a quest that requires nothing", () => {
    const Row = questRow();
    render(<Row quest={quest({ id: "2.2", requires: undefined, screen: "/work/missions" })} available={false} />);
    expect(screen.queryByText(/unavailable on this host/i)).toBeNull();
  });
});
