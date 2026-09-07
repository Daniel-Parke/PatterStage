// ═══════════════════════════════════════════════════════════════
// ScheduledMissions: everything on the PatterStage scheduler's own timer
//
// Folded into the Missions page (replaces the standalone Schedules page). The
// scheduler tick (orchestration/scheduler) fires these via the runtime;
// PatterStage owns the timer, no Hermes jobs.json. Lists schedules with
// pause/resume/run-now/delete, plus a compact form to put an existing saved
// mission on a timer (new missions get a schedule straight from the composer's
// "Schedule" dispatch mode).
//
// Both KINDS of row live here: a recurring mission, and a host script on a
// machine with no scheduler of its own. Each row names the one it fires, which
// is the difference between a list and a list you can act on.
// ═══════════════════════════════════════════════════════════════

"use client";

import { sectionHeadingClasses } from "@/lib/theme";
import { useState } from "react";
import { CalendarClock, Plus, Play, Trash2, ChevronDown } from "lucide-react";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import ConfirmButton from "@/components/ui/ConfirmButton";
import RunProgress from "@/components/schedule/RunProgress";
import ConceptHint from "@/components/help/ConceptHint";
import { useSchedules, useMissionOptions } from "@/hooks/useSchedules";
import { describeScheduleTarget } from "@/lib/schedule/schedule-target";
import { timeUntil } from "@/lib/utils";

const PRESETS = ["every 30m", "every 1h", "0 9 * * *", "0 9 * * 1-5"];

export default function ScheduledMissions() {
  const { schedules, isLoading, error, refetch, create, remove, toggle, runNow } = useSchedules();
  const missions = useMissionOptions();

  const [showForm, setShowForm] = useState(false);
  const [missionId, setMissionId] = useState("");
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState("every 30m");
  const [catchUpPolicy, setCatchUpPolicy] = useState<"fire_once" | "skip">("fire_once");
  const [formError, setFormError] = useState<string | null>(null);
  // Delete, pause and Run now used to fail in silence. This section has no
  // toast provider of its own, so the house read-failure banner is also its
  // write-failure banner (T-0104, D73).
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const failWith = (fallback: string) => (err: unknown) =>
    setActionError(err instanceof Error && err.message ? err.message : fallback);

  const enabledCount = schedules.filter((s) => s.enabled).length;
  const pausedCount = schedules.length - enabledCount;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!missionId.trim()) {
      setFormError("A mission is required");
      return;
    }
    create.mutate(
      { missionId: missionId.trim(), name: name.trim() || undefined, schedule: schedule.trim(), catchUpPolicy },
      {
        onSuccess: () => {
          setName("");
          setMissionId("");
          setShowForm(false);
        },
        onError: (err) =>
          setFormError(err instanceof Error && err.message ? err.message : "Failed to create schedule"),
      },
    );
  };

  const triggerRun = (id: string) => {
    setActionError(null);
    runNow.mutate(id, {
      onSuccess: (res) => {
        const rid = res.data?.data?.runId;
        if (rid) setActiveRunId(rid);
      },
      onError: failWith("Failed to start the run"),
    });
  };

  const inputCls =
    "w-full rounded-ps-md border border-ps-edge-hairline bg-ps-surface-panel px-3 py-2 text-body text-ps-text-primary focus:border-neon-orange/50 focus:outline-none";

  return (
    /* The panel's "Edit schedule" link targets this anchor. */
    <section id="scheduled-missions" className="mt-6">
      {/* ── Section header ── */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-neon-orange" />
          {/* "Schedules", not "Scheduled missions": the list holds script rows
              as well as mission ones, and a heading that names one kind is
              wrong about half of them. Each row says which kind it is. */}
          <h2 className={sectionHeadingClasses}>
            <ConceptHint id="schedule">Schedules</ConceptHint>
          </h2>
          {schedules.length > 0 && (
            <span className="font-mono text-micro text-ps-text-muted">
              {enabledCount} active{pausedCount > 0 ? ` · ${pausedCount} paused` : ""}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-ps-md border border-neon-orange/30 bg-neon-orange/10 px-3 py-1.5 font-mono text-micro text-neon-orange transition-colors hover:bg-neon-orange/20"
        >
          {showForm ? <ChevronDown className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} Schedule a mission
        </button>
      </div>

      {error && <LoadErrorBanner error={error} onRetry={() => refetch()} />}
      {actionError && <LoadErrorBanner error={actionError} onRetry={() => setActionError(null)} />}

      {/* ── Create form (collapsible) ── */}
      {showForm && (
        <form onSubmit={submit} className="mb-3 space-y-3 rounded-ps-lg border border-ps-edge-hairline bg-ps-surface-panel p-4">
          <p className="font-mono text-micro text-ps-text-muted">
            Put an existing saved mission on a timer. (New missions can be scheduled directly from the composer&apos;s
            &quot;Schedule&quot; dispatch mode.)
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="text-micro font-mono uppercase tracking-wider text-ps-text-muted">Mission</label>
              {missions.data && missions.data.length > 0 ? (
                <select aria-label="Mission" className={inputCls} value={missionId} onChange={(e) => setMissionId(e.target.value)}>
                  <option value="">Select a mission…</option>
                  {missions.data.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name || m.id}
                    </option>
                  ))}
                </select>
              ) : (
                <input className={inputCls} placeholder="mission id" aria-label="Mission to schedule, by id" value={missionId} onChange={(e) => setMissionId(e.target.value)} />
              )}
            </div>
            <div>
              <label className="text-micro font-mono uppercase tracking-wider text-ps-text-muted">Name (optional)</label>
              <input className={inputCls} placeholder="daily digest" aria-label="Schedule name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-micro font-mono uppercase tracking-wider text-ps-text-muted">
              Schedule (cron or &quot;every Nm/Nh/Nd&quot;)
            </label>
            <input aria-label="Schedule (cron, or every Nm/Nh/Nd)" className={inputCls} value={schedule} onChange={(e) => setSchedule(e.target.value)} />
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSchedule(p)}
                  className="rounded-ps-md border border-ps-edge px-2 py-1 font-mono text-micro text-ps-text-muted hover:bg-ps-surface-raised hover:text-ps-text-secondary"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select aria-label="Catch-up policy"
              className={`${inputCls} max-w-[180px]`}
              value={catchUpPolicy}
              onChange={(e) => setCatchUpPolicy(e.target.value as "fire_once" | "skip")}
            >
              <option value="fire_once">Catch up: fire once</option>
              <option value="skip">Catch up: skip</option>
            </select>
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded-ps-md border border-neon-orange/30 bg-neon-orange/10 px-4 py-2 font-mono text-body text-neon-orange transition-colors hover:bg-neon-orange/20 disabled:opacity-50"
            >
              {create.isPending ? "Creating…" : "Create schedule"}
            </button>
          </div>
          {formError && <div className="font-mono text-micro text-red-300">{formError}</div>}
        </form>
      )}

      {activeRunId && (
        <div className="mb-3 space-y-2">
          <div className="font-mono text-micro text-ps-text-muted">Triggered run</div>
          <RunProgress runId={activeRunId} />
        </div>
      )}

      {/* ── List ── */}
      {isLoading ? (
        <div className="py-6 text-center font-mono text-body text-ps-text-muted">Loading schedules…</div>
      ) : schedules.length === 0 ? (
        <div className="rounded-ps-lg border border-dashed border-ps-edge-hairline bg-ps-surface-panel px-4 py-6 text-center text-body text-ps-text-muted">
          No schedules yet. Use a mission&apos;s <span className="text-ps-text-muted">Schedule</span> dispatch mode, or put a saved mission on one above.
        </div>
      ) : (
        <div className="space-y-2">
          {schedules.map((s) => {
            // What this row fires, from the row itself. The headline is the
            // schedule's own name, which is a nickname an operator chose and
            // often the same on two rows over two different missions.
            const target = describeScheduleTarget(s);
            return (
              <div key={s.id} className="flex items-center gap-4 rounded-ps-lg border border-ps-edge-hairline bg-ps-surface-panel px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 rounded-ps-sm border border-ps-edge-hairline px-1.5 py-0.5 font-mono text-micro uppercase tracking-wider text-ps-text-muted">
                      {target.kindLabel}
                    </span>
                    <span className="truncate text-body text-ps-text-primary">
                      {s.name || s.scheduleDisplay || s.schedule}
                    </span>
                  </div>
                  <div className="truncate font-mono text-micro text-ps-text-muted">
                    <span className={target.missing ? "text-neon-orange" : "text-ps-text-secondary"}>
                      {target.name}
                    </span>
                    {" · "}
                    {s.schedule}
                    {" · "}
                    {s.enabled ? (s.nextRunAt ? <>next {timeUntil(s.nextRunAt)}</> : "no next run") : "paused"}
                    {s.lastStatus ? ` · last: ${s.lastStatus}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    toggle.mutate(
                      { id: s.id, enabled: !s.enabled },
                      { onError: failWith("Failed to update the schedule") },
                    );
                  }}
                  className="rounded-ps-md border border-ps-edge px-2.5 py-1 font-mono text-micro text-ps-text-muted hover:bg-ps-surface-raised"
                >
                  {s.enabled ? "Pause" : "Resume"}
                </button>
                <button
                  type="button"
                  onClick={() => triggerRun(s.id)}
                  className="flex items-center gap-1 rounded-ps-md border border-neon-cyan/30 px-2.5 py-1 font-mono text-micro text-neon-cyan hover:bg-neon-cyan/10"
                >
                  <Play className="h-3 w-3" /> Run
                </button>
                {/* Its own instance per row, so an arm on one row cannot fire on
                    another, and the armed button is never disabled (D66). */}
                <ConfirmButton
                  variant="danger"
                  size="sm"
                  aria-label={`Delete the schedule "${s.name || s.schedule}"`}
                  confirmLabel="Confirm?"
                  onConfirm={() => {
                    setActionError(null);
                    remove.mutate(s.id, { onError: failWith("Failed to delete the schedule") });
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </ConfirmButton>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
