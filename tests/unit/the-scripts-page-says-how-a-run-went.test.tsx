/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-require-imports */

// ═══════════════════════════════════════════════════════════════
// The Scripts surface, on what it says about a run.
//
// TWO SENTENCES THAT WERE NOT TRUE.
//
//   1. Every unhappy run toasted "exited non-zero, check Logs" -- including a
//      run that never started, which has no exit code and, on a fresh script,
//      no log to check. The operator is sent to an empty room.
//   2. The outcome appeared once, in a toast, and was then gone. The row's
//      "last run" is the log file's timestamp, which says WHEN something last
//      wrote output and never says whether it worked. So "did last night's
//      backup work?" had no answer on the screen that owns the script.
//
// The row now carries the outcome the ledger recorded, and the toast says which
// of the three things happened.
// ═══════════════════════════════════════════════════════════════

import { act, fireEvent, render, screen } from "@testing-library/react";

jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());

const safeApiCall = jest.fn();
jest.mock("@/lib/api/api-fetch", () => ({
  safeApiCall: (...a: unknown[]) => safeApiCall(...a),
  // The page's writes go through runWrite since C6 (T-0143), whose call is
  // apiFetch; one double stands for both.
  apiFetch: (...a: unknown[]) => safeApiCall(...a),
  safeApiCallData: jest.fn(async () => null),
  messageFromError: (_e: unknown, f: string) => f,
}));

const useScripts = jest.fn();
jest.mock("@/hooks/useScripts", () => ({
  useScripts: () => useScripts(),
  fetchScriptLog: jest.fn(async () => ""),
}));

import ScriptsPage from "@/app/work/scripts/page";
import ScriptRow from "@/components/scripts/ScriptRow";
import type { ScriptFile } from "@/hooks/useScripts";

const HOURS_3_AGO = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

function row(over: Partial<ScriptFile> = {}): ScriptFile {
  return {
    name: "ps-db-backup.mjs",
    path: "/data/scripts/ps-db-backup.mjs",
    size: 512,
    modified: "2026-09-01T00:00:00.000Z",
    schedule: null,
    scheduleSource: null,
    scheduleId: null,
    hasLog: true,
    lastRun: HOURS_3_AGO,
    lastOutcome: null,
    lastOutcomeAt: null,
    lastExitCode: null,
    ...over,
  };
}

const mutate = jest.fn();

function stubScripts(scripts: ScriptFile[]) {
  useScripts.mockReturnValue({
    scripts,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    run: { mutate, isPending: false, variables: undefined },
    scheduler: { available: true, reason: "Host crontab." },
  });
}

/** Click Run, then hand the mutation the answer the server gave. */
function runAndAnswer(answer: unknown): void {
  render(<ScriptsPage />);
  // `^Run$`: the template gallery below the list also has a card whose name
  // contains "Runs wherever Node does".
  fireEvent.click(screen.getByRole("button", { name: /^run$/i }));
  const opts = mutate.mock.calls[0][1] as { onSuccess: (r: unknown) => void };
  act(() => opts.onSuccess(answer));
}

beforeEach(() => {
  jest.clearAllMocks();
  stubScripts([row()]);
});

// ═══════════════════════════════════════════════════════════════
// The toast names which of the three things happened
// ═══════════════════════════════════════════════════════════════

describe("the toast after a run", () => {
  it("says it ran when it ran", () => {
    runAndAnswer({ ok: true, data: { data: { name: "ps-db-backup.mjs", outcome: "succeeded", exitCode: 0 } } });
    expect(screen.getByText("Ran ps-db-backup.mjs")).toBeInTheDocument();
  });

  it("names the exit code, and sends the operator to the log that now has output in it", () => {
    runAndAnswer({ ok: true, data: { data: { name: "ps-db-backup.mjs", outcome: "failed", exitCode: 2 } } });
    // The row also carries the filename, so the toast is matched on the part
    // only it says.
    const toast = screen.getByText(/exit code 2/);
    expect(toast).toHaveTextContent("ps-db-backup.mjs");
    expect(toast).toHaveTextContent(/logs/i);
  });

  it("does not claim a script that never started exited non-zero", () => {
    // The server answers with the reason and no exit code. The old branch read
    // `ok !== false` and said "exited non-zero, check Logs" for this too.
    runAndAnswer({
      ok: false,
      error: "ps-db-backup.bat did not start: nothing on this machine can run .bat files",
    });
    const toast = screen.getByText(/did not start/i);
    expect(toast).toHaveTextContent("nothing on this machine can run .bat files");
    expect(toast).not.toHaveTextContent(/exited non-zero/i);
    expect(toast).not.toHaveTextContent(/check logs/i);
  });

  it("keeps a refusal's own words rather than inventing an exit code", () => {
    runAndAnswer({ ok: false, error: "Scripts cannot be run while the console is read-only." });
    expect(screen.getByText("Scripts cannot be run while the console is read-only.")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// The row remembers, after the toast has gone
// ═══════════════════════════════════════════════════════════════

const noop = jest.fn();

function renderRow(over: Partial<ScriptFile>) {
  return render(
    <ScriptRow
      script={row(over)}
      busy={false}
      onRun={noop}
      onEdit={noop}
      onLogs={noop}
      onSchedule={noop}
      onUnschedule={noop}
    />,
  );
}

describe("the row says how the last run went", () => {
  it("says a run succeeded", () => {
    renderRow({ lastOutcome: "succeeded", lastOutcomeAt: HOURS_3_AGO, lastExitCode: 0 });
    expect(screen.getByText("ran 3h ago")).toBeInTheDocument();
  });

  it("says a run failed, and with which code", () => {
    renderRow({ lastOutcome: "failed", lastOutcomeAt: HOURS_3_AGO, lastExitCode: 2 });
    expect(screen.getByText("failed 3h ago (exit code 2)")).toBeInTheDocument();
  });

  it("says a run failed even when there is no code to name", () => {
    renderRow({ lastOutcome: "failed", lastOutcomeAt: HOURS_3_AGO, lastExitCode: null });
    expect(screen.getByText("failed 3h ago")).toBeInTheDocument();
  });

  it("says a run never started", () => {
    renderRow({ lastOutcome: "not-started", lastOutcomeAt: HOURS_3_AGO, lastExitCode: null });
    expect(screen.getByText("did not start 3h ago")).toBeInTheDocument();
  });

  it("does not claim an old outcome when something has run since", () => {
    // The machine's own crontab runs the script without PatterStage in the
    // path, so the log moves and the ledger does not. Saying "ran 2d ago"
    // beside a log written this morning would read as though last night's run
    // had not happened.
    renderRow({
      lastOutcome: "succeeded",
      lastOutcomeAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      lastExitCode: 0,
      lastRun: HOURS_3_AGO,
    });
    expect(screen.getByText("last run 3h ago")).toBeInTheDocument();
    expect(screen.queryByText(/^ran /)).not.toBeInTheDocument();
  });

  it("still reads as one run when the log and the record are seconds apart", () => {
    // The log is appended before the ledger row is written, and the ledger
    // stores whole seconds, so the two timestamps for ONE run never match
    // exactly. That must not look like a second run.
    const at = new Date(Date.now() - 3 * 60 * 60 * 1000);
    renderRow({
      lastOutcome: "succeeded",
      lastOutcomeAt: at.toISOString(),
      lastExitCode: 0,
      lastRun: new Date(at.getTime() + 900).toISOString(),
    });
    expect(screen.getByText("ran 3h ago")).toBeInTheDocument();
  });

  it("falls back to the log's timestamp when the ledger holds nothing", () => {
    renderRow({ lastOutcome: null, lastOutcomeAt: null });
    expect(screen.getByText(/last run 3h ago/)).toBeInTheDocument();
  });

  it("says nothing at all about a script that has never run", () => {
    const { container } = renderRow({ lastRun: null, hasLog: false, lastOutcome: null, lastOutcomeAt: null });
    expect(container.textContent).not.toMatch(/ago/);
  });
});
