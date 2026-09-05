/** @jest-environment jsdom */

// ═══════════════════════════════════════════════════════════════
// B13 oracle, group scripts-page (T-0107; D46, D48, D51 and decision 10).
//
// Written before the product code moved. Contract sections 1.6, 4.4-4.6, 5.
//
// THE DEFECTS, all on one page and all the same mistake:
//
//   D46  saveEditor defaults a new script's extension with
//        `!name.endsWith(".sh")`, so typing `backup.mjs` writes `backup.mjs.sh`
//        — a file that saves, lists, and then runs through bash and fails.
//   D48  unschedule strips the id with `/\.sh$/`, so `ps-db-backup.mjs` sends
//        id=ps-db-backup.mjs against a crontab entry called `ps-db-backup`.
//        DELETE answers 404 and the toast says "Failed to unschedule" against
//        a job that is still installed.
//   D51  the ConfirmButton landed in T-0096, but the thing it was supposed to
//        warn about — "a scheduled script loses its schedule with the file" —
//        is still only a source comment. The operator never reads it.
//
// Plus decision 10: where the host has no scheduler, the Schedule modal writes
// PatterStage's OWN schedule row, the row says so, and Unschedule takes it
// back off through /api/schedules rather than the crontab.
//
// The doubles: useScripts is stubbed with a fixed list (the page owns no
// fetching of its own), and safeApiCall is a jest.fn, so the URL, the verb and
// the body reach the assertions verbatim. lucide icons are stubbed so an
// icon-only control still resolves by its accessible name.
// ═══════════════════════════════════════════════════════════════

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("lucide-react", () => {
  const icon = (name: string) =>
    function Icon(props: Record<string, unknown>) {
      return <svg data-icon={name} aria-hidden="true" {...props} />;
    };
  return new Proxy({}, { get: (_t, prop: string) => icon(prop) });
});

const safeApiCall = jest.fn();
jest.mock("@/lib/api-fetch", () => ({
  safeApiCall: (...a: unknown[]) => safeApiCall(...a),
  safeApiCallData: jest.fn(async () => null),
  messageFromError: (_e: unknown, f: string) => f,
}));

const useScripts = jest.fn();
jest.mock("@/hooks/useScripts", () => ({
  useScripts: () => useScripts(),
  fetchScriptLog: jest.fn(async () => ""),
}));

import ScriptsPage from "@/app/work/scripts/page";
import ScheduleScriptModal from "@/components/scripts/ScheduleScriptModal";
import type { ScriptFile } from "@/hooks/useScripts";

// ── fixtures ───────────────────────────────────────────────────

/** Pre-B13 shim: the two fields contract 4.1 adds to a listed script. */
type Row = ScriptFile & {
  scheduleSource?: "host" | "patterstage" | null;
  scheduleId?: string | null;
};

function row(over: Partial<Row> = {}): Row {
  return {
    name: "ps-db-backup.mjs",
    path: "/data/scripts/ps-db-backup.mjs",
    size: 512,
    modified: "2026-09-01T00:00:00.000Z",
    schedule: null,
    hasLog: false,
    lastRun: null,
    scheduleSource: null,
    scheduleId: null,
    ...over,
  };
}

const HOST_ROW = row({ schedule: "0 3 * * *", scheduleSource: "host" });
const OWN_ROW = row({
  name: "ps-log-rotate.sh",
  path: "/data/scripts/ps-log-rotate.sh",
  schedule: "0 4 * * *",
  scheduleSource: "patterstage",
  scheduleId: "sch-7",
});
const UNSCHEDULED = row({ name: "http-ping.mjs", path: "/data/scripts/http-ping.mjs" });

const WINDOWS_REASON =
  "No host scheduler on native Windows. PatterStage runs script schedules itself, while PatterStage is running.";
const CRONTAB_REASON = "Host crontab. Scheduled scripts run whether PatterStage is up or not.";

function stubScripts(scripts: Row[], schedulerAvailable = true) {
  useScripts.mockReturnValue({
    scripts,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    run: { mutate: jest.fn(), isPending: false, variables: undefined },
    scheduler: {
      available: schedulerAvailable,
      reason: schedulerAvailable ? CRONTAB_REASON : WINDOWS_REASON,
    },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  safeApiCall.mockResolvedValue({ ok: true, data: { data: { content: "#!/usr/bin/env node\n" } } });
  stubScripts([UNSCHEDULED]);
});

/** Every call safeApiCall saw, as [url, init] pairs. */
function calls(): [string, { method?: string; body?: unknown } | undefined][] {
  return safeApiCall.mock.calls as [string, { method?: string; body?: unknown } | undefined][];
}

// ── FUSE ────────────────────────────────────────────────────────

describe("FUSE: nothing here reaches a real endpoint", () => {
  it("routes every write through the stubbed client", () => {
    render(<ScriptsPage />);
    expect(safeApiCall).not.toHaveBeenCalled();
    expect(typeof safeApiCall.mock.calls).toBe("object");
  });
});

// ═══════════════════════════════════════════════════════════════
// D46: naming a new script does not double its extension
// ═══════════════════════════════════════════════════════════════

async function saveNewScriptNamed(typed: string): Promise<string> {
  render(<ScriptsPage />);
  fireEvent.click(screen.getByRole("button", { name: /new script/i }));
  fireEvent.change(await screen.findByLabelText("Filename"), { target: { value: typed } });
  fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
  await waitFor(() => expect(safeApiCall).toHaveBeenCalled());
  const put = calls().find(([, init]) => init?.method === "PUT");
  if (!put) throw new Error(`no PUT was sent; saw ${JSON.stringify(calls())}`);
  return put[0];
}

describe("the New-script filename keeps the extension the operator typed", () => {
  it("GREEN CONTROL: a bare name still defaults to .sh", async () => {
    expect(await saveNewScriptNamed("backup")).toBe("/api/scripts/backup.sh");
  });

  it("GREEN CONTROL: an explicit .sh name is left alone", async () => {
    expect(await saveNewScriptNamed("backup.sh")).toBe("/api/scripts/backup.sh");
  });

  it("writes backup.mjs, not backup.mjs.sh (D46)", async () => {
    expect(await saveNewScriptNamed("backup.mjs")).toBe("/api/scripts/backup.mjs");
  });

  it.each([".cjs", ".js", ".ps1", ".bat", ".cmd"])("leaves a %s name alone too", async (ext) => {
    expect(await saveNewScriptNamed(`backup${ext}`)).toBe(`/api/scripts/backup${ext}`);
  });
});

// ═══════════════════════════════════════════════════════════════
// D48: Unschedule computes the id the crontab actually used
// ═══════════════════════════════════════════════════════════════

describe("Unschedule reaches the entry that is installed", () => {
  it("strips any of the seven extensions from the crontab id (D48)", async () => {
    stubScripts([HOST_ROW]);
    render(<ScriptsPage />);
    fireEvent.click(screen.getByRole("button", { name: /unschedule/i }));
    await waitFor(() => expect(safeApiCall).toHaveBeenCalled());
    expect(safeApiCall).toHaveBeenCalledWith("/api/cron/hardware?id=ps-db-backup", {
      method: "DELETE",
    });
  });

  it("takes a PatterStage-owned row off PatterStage's own scheduler, not the crontab", async () => {
    stubScripts([OWN_ROW]);
    render(<ScriptsPage />);
    fireEvent.click(screen.getByRole("button", { name: /unschedule/i }));
    await waitFor(() => expect(safeApiCall).toHaveBeenCalled());
    expect(safeApiCall).toHaveBeenCalledWith("/api/schedules/sch-7", { method: "DELETE" });
    expect(calls().some(([url]) => url.startsWith("/api/cron/hardware"))).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// decision 10: the row says where its schedule lives
// ═══════════════════════════════════════════════════════════════

describe("a row scheduled by PatterStage says so", () => {
  it("labels the PatterStage-owned row with its honest limit", () => {
    stubScripts([OWN_ROW]);
    render(<ScriptsPage />);
    expect(screen.getByText("Runs while PatterStage is running")).toBeInTheDocument();
  });

  it("GREEN CONTROL: a host-crontab row carries no such label", () => {
    stubScripts([HOST_ROW]);
    render(<ScriptsPage />);
    expect(screen.queryByText("Runs while PatterStage is running")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// D51: the delete confirmation warns about the schedule
// ═══════════════════════════════════════════════════════════════

describe("deleting a scheduled script warns that the schedule goes with it", () => {
  const WARNING = /deleting the file also removes its schedule/i;

  it("shows the warning in the editor of a scheduled script (D51)", async () => {
    stubScripts([HOST_ROW]);
    render(<ScriptsPage />);
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    await screen.findByRole("dialog");
    expect(await screen.findByText(WARNING)).toBeInTheDocument();
  });

  it("GREEN CONTROL: an unscheduled script's editor does not warn", async () => {
    stubScripts([UNSCHEDULED]);
    render(<ScriptsPage />);
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    await screen.findByRole("dialog");
    expect(screen.queryByText(WARNING)).not.toBeInTheDocument();
  });

  it("GREEN CONTROL: the two-step ConfirmButton is still the only confirmation", async () => {
    stubScripts([HOST_ROW]);
    render(<ScriptsPage />);
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    const dialog = await screen.findByRole("dialog");
    const del = screen.getByRole("button", { name: /^delete$/i });
    fireEvent.click(del);
    expect(dialog).toHaveTextContent(/delete for good\?/i);
    expect(calls().some(([, init]) => init?.method === "DELETE")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// decision 10: the Schedule modal writes wherever the host allows
// ═══════════════════════════════════════════════════════════════

/** Pre-B13 shim: the prop contract 4.6 adds. */
type ModalProps = React.ComponentProps<typeof ScheduleScriptModal> & {
  scheduler?: { available: boolean; reason: string };
};
const Schedule = ScheduleScriptModal as unknown as React.ComponentType<ModalProps>;

function openModal(available: boolean, script: Row = UNSCHEDULED) {
  const onSaved = jest.fn();
  const onError = jest.fn();
  render(
    <Schedule
      script={script}
      onClose={jest.fn()}
      onSaved={onSaved}
      onError={onError}
      scheduler={{ available, reason: available ? CRONTAB_REASON : WINDOWS_REASON }}
    />,
  );
  return { onSaved, onError };
}

function bodyOf(url: string): Record<string, unknown> {
  const call = calls().find(([u]) => u === url);
  if (!call) throw new Error(`nothing was posted to ${url}; saw ${JSON.stringify(calls())}`);
  return (call[1]?.body ?? {}) as Record<string, unknown>;
}

describe("ScheduleScriptModal, when the host has a scheduler", () => {
  beforeEach(() => safeApiCall.mockResolvedValue({ ok: true, data: {} }));

  it("GREEN CONTROL: still installs a host crontab entry", async () => {
    openModal(true, HOST_ROW);
    fireEvent.click(screen.getByRole("button", { name: "Schedule" }));
    await waitFor(() => expect(safeApiCall).toHaveBeenCalled());
    expect(bodyOf("/api/cron/hardware")).toMatchObject({
      schedule: "0 3 * * *",
      command: "/data/scripts/ps-db-backup.mjs",
    });
  });

  it("labels the job with the extension stripped, whatever it is", async () => {
    openModal(true, HOST_ROW);
    fireEvent.click(screen.getByRole("button", { name: "Schedule" }));
    await waitFor(() => expect(safeApiCall).toHaveBeenCalled());
    expect(bodyOf("/api/cron/hardware").name).toBe("Ps Db Backup");
  });
});

describe("ScheduleScriptModal, where there is no host scheduler", () => {
  beforeEach(() => safeApiCall.mockResolvedValue({ ok: true, data: {} }));

  it("says why, in the words the API gave it", () => {
    openModal(false);
    expect(screen.getByText(WINDOWS_REASON)).toBeInTheDocument();
  });

  it("writes PatterStage's own schedule row instead of a crontab line", async () => {
    openModal(false);
    fireEvent.click(screen.getByRole("button", { name: "Schedule" }));
    await waitFor(() => expect(safeApiCall).toHaveBeenCalled());
    expect(calls().some(([url]) => url.startsWith("/api/cron/hardware"))).toBe(false);
    expect(bodyOf("/api/schedules")).toMatchObject({
      kind: "script",
      scriptName: "http-ping.mjs",
      schedule: "0 3 * * *",
    });
  });

  it("sends no missionId — the create body is strict and a script row has none", async () => {
    openModal(false);
    fireEvent.click(screen.getByRole("button", { name: "Schedule" }));
    await waitFor(() => expect(safeApiCall).toHaveBeenCalled());
    expect(Object.keys(bodyOf("/api/schedules"))).not.toContain("missionId");
  });
});

describe("the page hands the modal what GET /api/scripts said about the host", () => {
  it("opens the fallback modal when the read reported no host scheduler", async () => {
    stubScripts([UNSCHEDULED], false);
    render(<ScriptsPage />);
    fireEvent.click(screen.getByRole("button", { name: /^schedule$/i }));
    expect(await screen.findByText(WINDOWS_REASON)).toBeInTheDocument();
  });
});
