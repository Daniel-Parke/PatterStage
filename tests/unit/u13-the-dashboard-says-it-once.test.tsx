/** @jest-environment jsdom */
/**
 * U13 (T-0127): the dashboard says each fact once.
 *
 * Six pills sat under a Subsystems panel that already said two of them with
 * their reasons (Gateway, Memory) and above an Errors panel that already
 * listed the third (Errors). The recon measured it: "Gateway, Memory and
 * Errors each appear twice on one screen", and three of the six clipped their
 * own subtext in 133px boxes on a row with 200px spare. The row is the three
 * facts nothing else on the board carries - Scheduler, Spend, Processes - at a
 * width their subtext fits; the Errors count moves into the Errors panel's own
 * header; and the Subsystems panel, now the only place Gateway and Memory are
 * said, gains the read contract it lacked: a failed check is an error with
 * Retry, not "Checking..." forever.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("lucide-react", () => {
  const passthrough = () => () => null;
  return new Proxy({}, { get: () => passthrough() });
});

const ROOT = join(__dirname, "..", "..");
const page = readFileSync(join(ROOT, "src", "app", "page.tsx"), "utf-8");

describe("the stat row, in the page's source", () => {
  it("is three pills: Scheduler, Spend, Processes, in that order", () => {
    const labels = [...page.matchAll(/<StatPill[\s\S]*?label="([^"]+)"/g)].map((m) => m[1]);
    expect(labels).toEqual(["Scheduler", "Spend", "Processes"]);
  });

  it("no longer derives a pill for a subsystem row: the panel above says it", () => {
    expect(page.includes("subsystemPill(")).toBe(false);
  });

  it("loads on the loading contract: the header, then a skeleton, never a spinner", () => {
    expect(page).toMatch(/from "@\/components\/ui\/PageLoading"/);
    expect(page.includes("LoadingSpinner")).toBe(false);
  });
});

describe("the Errors panel", () => {
  const errors = [
    { source: "gateway", message: "connection refused", severity: "error" as const, timestamp: "10:00" },
    { source: "memory", message: "store unreachable", severity: "warning" as const, timestamp: "10:01" },
  ];

  it("carries the monitor's count in its own header, so the number the pill said is not lost", async () => {
    const { default: ErrorsPanel } = await import("@/components/dashboard/ErrorsPanel");
    render(<ErrorsPanel errors={errors} count={3} severity="all" onSelectSeverity={() => {}} />);
    expect(screen.getByText(/3 recent/)).toBeInTheDocument();
  });

  it("says 'recent error', singular, for one", async () => {
    const { default: ErrorsPanel } = await import("@/components/dashboard/ErrorsPanel");
    render(<ErrorsPanel errors={[errors[0]]} count={1} severity="all" onSelectSeverity={() => {}} />);
    expect(screen.getByText(/1 recent error\b/)).toBeInTheDocument();
  });
});

describe("the Subsystems panel", () => {
  it("says the check failed, with a Retry, rather than checking forever", async () => {
    const { default: SubsystemsPanel } = await import("@/components/dashboard/SubsystemsPanel");
    const onRetry = jest.fn();
    render(<SubsystemsPanel subsystems={null} checkedAt={null} error="subsystems unreachable" onRetry={onRetry} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/subsystems unreachable/);
    expect(screen.queryByText(/Checking/)).toBeNull();
    fireEvent.click(within(alert).getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("still has its calm state while the first check is in flight", async () => {
    const { default: SubsystemsPanel } = await import("@/components/dashboard/SubsystemsPanel");
    render(<SubsystemsPanel subsystems={null} checkedAt={null} error={null} onRetry={() => {}} />);
    expect(screen.getByText(/Checking/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("a pill", () => {
  it("top-aligns its content, so a pill with a subtitle and one without share a baseline", async () => {
    const { StatPill } = await import("@/components/dashboard/StatPill");
    const Icon = () => null;
    const { container } = render(<StatPill icon={Icon} label="Spend" value="$1.25" color="yellow" subtitle="this month" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/\bitems-start\b/);
    expect(root.className).not.toMatch(/\bitems-center\b/);
  });
});
