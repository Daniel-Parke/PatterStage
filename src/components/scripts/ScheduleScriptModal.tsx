// ═══════════════════════════════════════════════════════════════
// ScheduleScriptModal — put a script on a timer
//
// The host crontab where there is one; a PatterStage `schedules` row where
// there is not, which is native Windows (T-0107, decision 10). The modal says
// which, in the sentence the API sent it, so the difference is met before it is
// relied on rather than discovered later. Its cron field and validation are
// local to the modal, as they have always been.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect } from "react";
import { CalendarClock } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import SchedulePicker from "@/components/schedule/SchedulePicker";
import { safeApiCall } from "@/lib/api-fetch";
import { stripScriptExt } from "@/lib/scripts/script-ext";
import type { ScriptFile, SchedulerAvailability } from "@/hooks/useScripts";

export default function ScheduleScriptModal({
  script,
  onClose,
  onSaved,
  onError,
  scheduler,
}: {
  script: ScriptFile;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
  scheduler: SchedulerAvailability;
}) {
  const [schedule, setSchedule] = useState("0 3 * * *");
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSchedule("0 3 * * *");
    setScheduleError(null);
  }, [script.name]);

  const [draftError, setDraftError] = useState<string | null>(null);

  const save = async () => {
    // The same defect as the mission composer, on the HOST CRONTAB. This guard
    // reads the COMMITTED value, which is the untouched default when the draft
    // is unusable, so it could never fire on bad input: typing garbage and
    // clicking Schedule wrote "0 3 * * *" to the real crontab (T-0063).
    if (draftError) {
      setScheduleError(draftError);
      return;
    }
    const fields = schedule.trim().split(/\s+/);
    if (fields.length !== 5) {
      setScheduleError("Schedule must have exactly 5 fields: min hour dom mon dow");
      return;
    }
    // The label was stripped with a .sh-only regex, so a scheduled .mjs was
    // titled "Ps Db Backup.mjs" (T-0107, D48).
    const label = stripScriptExt(script.name)
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    setSaving(true);
    try {
      const res = scheduler.available
        ? await safeApiCall("/api/cron/hardware", {
            method: "POST",
            body: { name: label, schedule: schedule.trim(), command: script.path },
          })
        : await safeApiCall("/api/schedules", {
            method: "POST",
            // No missionId key at all: the body schema is .strict(), and a
            // script schedule has no mission to name.
            body: {
              kind: "script",
              scriptName: script.name,
              name: label,
              schedule: schedule.trim(),
              scheduleDisplay: schedule.trim(),
            },
          });
      if (!res.ok) {
        onError(res.error ?? "Failed to schedule");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Schedule · ${script.name}`}
      icon={CalendarClock}
      iconColor="text-neon-orange"
      size="md"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" color="orange" size="sm" onClick={() => void save()} loading={saving}>
            Schedule
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="font-mono text-xs text-ps-text-muted">
          Runs <span className="text-ps-text-secondary">{script.name}</span>.
        </p>
        <p className="font-mono text-xs text-ps-text-faint">{scheduler.reason}</p>
        <SchedulePicker
          value={schedule}
          onChange={(v) => { setSchedule(v); setScheduleError(null); }}
          error={scheduleError ?? draftError}
          onDraftError={setDraftError}
        />
      </div>
    </Modal>
  );
}
