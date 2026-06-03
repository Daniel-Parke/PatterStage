// Byte-equivalence contract for the cron modal populate-collapse refactor
// (session 88, List 2 — JobFormModal + SystemCronModal)
//
// Both modals had a two-branch useEffect that populated the form on
// open() — one branch for "edit mode" (read from the job) and one for
// "create mode" (reset to defaults). The refactor collapses the two
// branches into a single block by introducing a `source = job ?? null`
// binding and using `source?.field ?? default` (or `|| default` for
// falsy-only fallbacks). The test below mirrors both the original and
// refactored logic verbatim and asserts they produce the same setter
// call sequence for every reachable input shape.
//
// Why this test matters: the refactor is a byte-equivalence claim, and
// the only way to lock that claim in (so a future "fix" doesn't
// silently change behaviour) is to assert the setter sequence
// invariant. The 6 cases per modal cover: null reset, undefined-id
// reset, normal edit, empty-string edit, undefined optional fields,
// and the falsy-fallback edge case (deliver="none" / schedule="*/5 * * * *").

interface CronJobFormData {
  id?: string;
  name: string;
  schedule: string;
  prompt: string;
  deliver: string;
  model: string;
  profile_name?: string;
  repeat?: boolean;
}

function populateTwoBranch(
  job: CronJobFormData | null,
  setters: {
    setName: (v: string) => void;
    setSchedule: (v: string) => void;
    setPrompt: (v: string) => void;
    setDeliver: (v: string) => void;
    setModel: (v: string) => void;
    setProfileName: (v: string) => void;
    setRepeat: (v: boolean) => void;
  },
): void {
  if (job?.id) {
    setters.setName(job.name ?? "");
    setters.setSchedule(job.schedule ?? "");
    setters.setPrompt(job.prompt ?? "");
    setters.setDeliver(job.deliver || "none");
    setters.setModel(job.model ?? "");
    setters.setProfileName(job.profile_name || "default");
    setters.setRepeat(job.repeat ?? false);
  } else {
    setters.setName("");
    setters.setSchedule("");
    setters.setPrompt("");
    setters.setDeliver("none");
    setters.setModel("");
    setters.setProfileName("default");
    setters.setRepeat(false);
  }
}

function populateCollapsed(
  job: CronJobFormData | null,
  setters: {
    setName: (v: string) => void;
    setSchedule: (v: string) => void;
    setPrompt: (v: string) => void;
    setDeliver: (v: string) => void;
    setModel: (v: string) => void;
    setProfileName: (v: string) => void;
    setRepeat: (v: boolean) => void;
  },
): void {
  const source = job?.id ? job : null;
  setters.setName(source?.name ?? "");
  setters.setSchedule(source?.schedule ?? "");
  setters.setPrompt(source?.prompt ?? "");
  setters.setDeliver(source?.deliver || "none");
  setters.setModel(source?.model ?? "");
  setters.setProfileName(source?.profile_name || "default");
  setters.setRepeat(source?.repeat ?? false);
}

interface Call {
  setter: string;
  value: unknown;
}

function makeRecorder(): {
  setters: {
    setName: (v: string) => void;
    setSchedule: (v: string) => void;
    setPrompt: (v: string) => void;
    setDeliver: (v: string) => void;
    setModel: (v: string) => void;
    setProfileName: (v: string) => void;
    setRepeat: (v: boolean) => void;
  };
  calls: Call[];
} {
  const calls: Call[] = [];
  return {
    setters: {
      setName: (v) => calls.push({ setter: "name", value: v }),
      setSchedule: (v) => calls.push({ setter: "schedule", value: v }),
      setPrompt: (v) => calls.push({ setter: "prompt", value: v }),
      setDeliver: (v) => calls.push({ setter: "deliver", value: v }),
      setModel: (v) => calls.push({ setter: "model", value: v }),
      setProfileName: (v) => calls.push({ setter: "profile_name", value: v }),
      setRepeat: (v) => calls.push({ setter: "repeat", value: v }),
    },
    calls,
  };
}

describe("cron modal populate-collapse (JobFormModal) — byte-equivalence", () => {
  const cases: Array<{ name: string; job: CronJobFormData | null }> = [
    { name: "null job (reset)", job: null },
    {
      name: "job without id (reset)",
      job: { name: "x", schedule: "s", prompt: "p", deliver: "cli", model: "m" },
    },
    {
      name: "normal edit",
      job: {
        id: "1",
        name: "Job A",
        schedule: "*/5 * * * *",
        prompt: "do thing",
        deliver: "telegram",
        model: "gpt-4",
        profile_name: "main",
        repeat: true,
      },
    },
    {
      name: "empty strings edit",
      job: {
        id: "2",
        name: "",
        schedule: "",
        prompt: "",
        deliver: "",
        model: "",
        profile_name: "",
        repeat: false,
      },
    },
    {
      name: "undefined optional fields",
      job: { id: "3", name: "x", schedule: "s", prompt: "p", deliver: "none", model: "m" },
    },
    {
      name: "deliver = 'none' (falsy fallback branch)",
      job: { id: "4", name: "x", schedule: "s", prompt: "p", deliver: "none", model: "m", profile_name: "p" },
    },
  ];

  for (const { name, job } of cases) {
    it(`produces identical setter calls for: ${name}`, () => {
      const a = makeRecorder();
      const b = makeRecorder();
      populateTwoBranch(job, a.setters);
      populateCollapsed(job, b.setters);
      expect(b.calls).toEqual(a.calls);
    });
  }
});

interface SystemCronJob {
  id?: string;
  name: string;
  schedule: string;
  command: string;
  logFile?: string;
  enabled: boolean;
}

function normalizePathSlashes(p: string): string {
  return p.replace(/\\/g, "/");
}

function populateSystemTwoBranch(
  editingJob: SystemCronJob | null,
  setters: {
    setName: (v: string) => void;
    setSchedule: (v: string) => void;
    setCommand: (v: string) => void;
    setLogFile: (v: string) => void;
    setEnabled: (v: boolean) => void;
  },
): void {
  if (editingJob) {
    setters.setName(editingJob.name);
    setters.setSchedule(editingJob.schedule);
    setters.setCommand(normalizePathSlashes(editingJob.command));
    setters.setLogFile(editingJob.logFile ?? "");
    setters.setEnabled(editingJob.enabled);
  } else {
    setters.setName("");
    setters.setSchedule("*/5 * * * *");
    setters.setCommand("");
    setters.setLogFile("");
    setters.setEnabled(true);
  }
}

function populateSystemCollapsed(
  editingJob: SystemCronJob | null,
  setters: {
    setName: (v: string) => void;
    setSchedule: (v: string) => void;
    setCommand: (v: string) => void;
    setLogFile: (v: string) => void;
    setEnabled: (v: boolean) => void;
  },
): void {
  const source = editingJob ?? null;
  setters.setName(source?.name ?? "");
  setters.setSchedule(source?.schedule ?? "*/5 * * * *");
  setters.setCommand(
    source?.command != null ? normalizePathSlashes(source.command) : "",
  );
  setters.setLogFile(source?.logFile ?? "");
  setters.setEnabled(source?.enabled ?? true);
}

function makeSystemRecorder(): {
  setters: {
    setName: (v: string) => void;
    setSchedule: (v: string) => void;
    setCommand: (v: string) => void;
    setLogFile: (v: string) => void;
    setEnabled: (v: boolean) => void;
  };
  calls: Call[];
} {
  const calls: Call[] = [];
  return {
    setters: {
      setName: (v) => calls.push({ setter: "name", value: v }),
      setSchedule: (v) => calls.push({ setter: "schedule", value: v }),
      setCommand: (v) => calls.push({ setter: "command", value: v }),
      setLogFile: (v) => calls.push({ setter: "logFile", value: v }),
      setEnabled: (v) => calls.push({ setter: "enabled", value: v }),
    },
    calls,
  };
}

describe("system cron modal populate-collapse (SystemCronModal) — byte-equivalence", () => {
  const cases: Array<{ name: string; job: SystemCronJob | null }> = [
    { name: "null job (reset)", job: null },
    {
      name: "normal edit",
      job: {
        id: "1",
        name: "Job A",
        schedule: "0 9 * * *",
        command: "/scripts/foo.sh",
        logFile: "/var/log/x.log",
        enabled: true,
      },
    },
    {
      name: "Windows path edit (normalizePathSlashes branch)",
      job: {
        id: "2",
        name: "Win",
        schedule: "0 9 * * *",
        command: "C:\\scripts\\foo.sh",
        logFile: "",
        enabled: false,
      },
    },
    {
      name: "empty strings",
      job: { id: "3", name: "", schedule: "", command: "", enabled: false },
    },
    {
      name: "undefined logFile",
      job: { id: "4", name: "x", schedule: "s", command: "c", enabled: true },
    },
    {
      name: "schedule = '*/5 * * * *' (default value)",
      job: {
        id: "5",
        name: "x",
        schedule: "*/5 * * * *",
        command: "c",
        enabled: true,
      },
    },
  ];

  for (const { name, job } of cases) {
    it(`produces identical setter calls for: ${name}`, () => {
      const a = makeSystemRecorder();
      const b = makeSystemRecorder();
      populateSystemTwoBranch(job, a.setters);
      populateSystemCollapsed(job, b.setters);
      expect(b.calls).toEqual(a.calls);
    });
  }
});
