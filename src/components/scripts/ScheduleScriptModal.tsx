// ═══════════════════════════════════════════════════════════════
// ScheduleScriptModal — put a *.sh file on the host crontab
//
// Extracted verbatim from app/orchestration/scripts/page.tsx, where it
// was a second component declared below the page. Its cron field and
// validation are local to the modal, as they were before.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect } from "react";
import { CalendarClock } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import SchedulePicker from "@/components/schedule/SchedulePicker";
import { safeApiCall } from "@/lib/api-fetch";
import type { ScriptFile } from "@/hooks/useScripts";

export default function ScheduleScriptModal({
  script,
  onClose,
  onSaved,
  onError,
}: {
  script: ScriptFile;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [schedule, setSchedule] = useState("0 3 * * *");
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSchedule("0 3 * * *");
    setScheduleError(null);
  }, [script.name]);

  const save = async () => {
    const fields = schedule.trim().split(/\s+/);
    if (fields.length !== 5) {
      setScheduleError("Schedule must have exactly 5 fields: min hour dom mon dow");
      return;
    }
    setSaving(true);
    try {
      const res = await safeApiCall("/api/cron/hardware", {
        method: "POST",
        body: {
          name: script.name.replace(/\.sh$/, "").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          schedule: schedule.trim(),
          command: script.path,
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
          Runs <span className="text-ps-text-secondary">{script.name}</span> on the host crontab.
        </p>
        <SchedulePicker value={schedule} onChange={(v) => { setSchedule(v); setScheduleError(null); }} error={scheduleError} />
      </div>
    </Modal>
  );
}
